import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { registerTool } from '@my-toolbox/shared'
import { initDb } from './db.js'
import { getWorkDay, getDayType, calculateDay, loadHolidays, type Event } from './calculator.js'
import { registerHealthRoute } from './routes/health.js'
import { registerTodayRoute } from './routes/today.js'
import { registerDaysRoutes } from './routes/days.js'
import { registerStatsRoute } from './routes/stats.js'
import { registerHolidaysRoutes } from './routes/holidays.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3007', 10)
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'

async function main() {
  const db = initDb()
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  // Swift daemon state
  let daemonProcess: ChildProcess | null = null
  let daemonRunning = false

  const daemonStatus = () => daemonRunning

  // Spawn the Swift monitor daemon
  const monitorSwiftPath = path.resolve(__dirname, '../../src/native/monitor.swift')
  try {
    daemonProcess = spawn('swift', [monitorSwiftPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    daemonRunning = true

    daemonProcess.on('exit', (code) => {
      daemonRunning = false
      app.log.warn(`Swift daemon exited with code ${code}`)
    })

    daemonProcess.on('error', (err) => {
      daemonRunning = false
      app.log.error(`Swift daemon error: ${err.message}`)
    })

    // Parse stdout line by line for JSON events
    if (daemonProcess.stdout) {
      const rl = createInterface({ input: daemonProcess.stdout })
      const insertStmt = db.prepare(
        'INSERT INTO events (type, timestamp, work_day) VALUES (?, ?, ?)'
      )
      const upsertSummary = db.prepare(`
        INSERT INTO daily_summary (work_day, first_active, last_active, raw_minutes, break_minutes, effective_minutes, overtime_minutes, day_type, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(work_day) DO UPDATE SET
          first_active = excluded.first_active,
          last_active = excluded.last_active,
          raw_minutes = excluded.raw_minutes,
          break_minutes = excluded.break_minutes,
          effective_minutes = excluded.effective_minutes,
          overtime_minutes = excluded.overtime_minutes,
          day_type = excluded.day_type,
          source = excluded.source
      `)

      rl.on('line', (line) => {
        try {
          const event = JSON.parse(line) as { type: string; timestamp?: string }
          const timestamp = event.timestamp || new Date().toISOString()
          const workDay = getWorkDay(timestamp)

          // Insert the event
          insertStmt.run(event.type, timestamp, workDay)

          // Recalculate the day summary
          // For manual-source days: inject the manual start time as a synthetic event
          const existing = db
            .prepare('SELECT source, first_active FROM daily_summary WHERE work_day = ?')
            .get(workDay) as { source: string; first_active: string } | undefined

          let dayEvents = db
            .prepare('SELECT * FROM events WHERE work_day = ? ORDER BY timestamp ASC')
            .all(workDay) as Event[]

          const holidays = loadHolidays()
          const dayType = getDayType(workDay, holidays)

          if (existing?.source === 'manual' && existing.first_active) {
            // Build a full timestamp from the stored HH:MM
            const manualStart = existing.first_active.includes('T')
              ? existing.first_active
              : `${workDay}T${existing.first_active}:00`
            // Prepend a synthetic unlock event so calculateDay uses the manual start
            dayEvents = [
              { type: 'screen_unlock', timestamp: manualStart, work_day: workDay },
              ...dayEvents,
            ]
          }

          const summary = calculateDay(dayEvents, dayType)

          if (existing?.source === 'manual') {
            summary.source = 'manual'
            // Store the display-friendly HH:MM
            summary.first_active = existing.first_active
          }

          upsertSummary.run(
            workDay,
            summary.first_active,
            summary.last_active,
            summary.raw_minutes,
            summary.break_minutes,
            summary.effective_minutes,
            summary.overtime_minutes,
            summary.day_type,
            summary.source
          )
        } catch (err) {
          app.log.error(`Failed to parse daemon event: ${line}`)
        }
      })
    }

    if (daemonProcess.stderr) {
      daemonProcess.stderr.on('data', (data: Buffer) => {
        app.log.warn(`Swift daemon stderr: ${data.toString().trim()}`)
      })
    }
  } catch (err) {
    app.log.error(`Failed to spawn Swift daemon: ${err}`)
    daemonRunning = false
  }

  // Register routes
  registerHealthRoute(app, daemonStatus)
  registerTodayRoute(app, db, daemonStatus)
  registerDaysRoutes(app, db)
  registerStatsRoute(app, db)
  registerHolidaysRoutes(app)

  // Serve frontend SPA in production
  const webDir = path.resolve(__dirname, '../web')
  try {
    await app.register(fastifyStatic, {
      root: webDir,
      prefix: '/',
      wildcard: false,
      decorateReply: false,
    })
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html', webDir)
    })
  } catch {
    app.log.warn('No built frontend found — skipping static file serving')
  }

  await app.listen({ port: PORT, host: '0.0.0.0' })

  registerTool({
    portalUrl: PORTAL_URL,
    manifest: {
      name: 'work-hours',
      displayName: 'Work Hours',
      description: '工时追踪器，自动记录上下班时间并计算加班',
      version: '0.1.0',
      url: `http://localhost:${PORT}`,
      health: '/api/health',
      pm2Name: 'work-hours',
    },
  })

  app.log.info(`Work Hours running at http://localhost:${PORT}`)

  // Cleanup on exit
  const cleanup = () => {
    if (daemonProcess && !daemonProcess.killed) {
      daemonProcess.kill()
      app.log.info('Swift daemon killed')
    }
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', cleanup)
}

main().catch((err) => {
  console.error('Failed to start Work Hours:', err)
  process.exit(1)
})
