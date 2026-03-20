import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import {
  getDayType,
  calculateDay,
  loadHolidays,
  type Event,
  type DaySummary,
} from '../calculator.js'

/**
 * Extract HH:MM from an ISO timestamp or return as-is if already short.
 */
function toHHMM(ts: string): string {
  if (!ts) return ts
  if (ts.length <= 5) return ts
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts.substring(0, 5)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function registerDaysRoutes(app: FastifyInstance, db: Database.Database) {
  // GET /api/days?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get<{ Querystring: { from?: string; to?: string } }>(
    '/api/days',
    async (req, reply) => {
      const { from, to } = req.query
      if (!from || !to) {
        return reply.status(400).send({ error: 'from and to query params required' })
      }

      const rows = db
        .prepare(
          'SELECT * FROM daily_summary WHERE work_day >= ? AND work_day <= ? ORDER BY work_day ASC'
        )
        .all(from, to) as DaySummary[]

      return rows
    }
  )

  // GET /api/days/:date
  app.get<{ Params: { date: string } }>('/api/days/:date', async (req) => {
    const { date } = req.params

    let events = db
      .prepare('SELECT * FROM events WHERE work_day = ? ORDER BY timestamp ASC')
      .all(date) as Event[]

    const summary = db
      .prepare('SELECT * FROM daily_summary WHERE work_day = ?')
      .get(date) as DaySummary | undefined

    // If persisted summary exists, return it directly
    if (summary) {
      return {
        summary: {
          ...summary,
          work_day: date,
          first_active: summary.first_active ? toHHMM(summary.first_active) : null,
          last_active: summary.last_active ? toHHMM(summary.last_active) : null,
        },
        events,
      }
    }

    // Calculate on the fly
    const holidays = loadHolidays()
    const dayType = getDayType(date, holidays)
    const calculated = calculateDay(events, dayType)

    return {
      summary: {
        ...calculated,
        work_day: date,
        first_active: calculated.first_active ? toHHMM(calculated.first_active) : null,
        last_active: calculated.last_active ? toHHMM(calculated.last_active) : null,
      },
      events,
    }
  })

  // PUT /api/days/:date — manual edit
  app.put<{ Params: { date: string }; Body: { first_active: string; last_active: string } }>(
    '/api/days/:date',
    async (req, reply) => {
      const { date } = req.params
      const { first_active, last_active } = req.body ?? {}

      if (!first_active || !last_active) {
        return reply
          .status(400)
          .send({ error: 'first_active and last_active are required' })
      }

      // Build synthetic events from the manual times to recalculate
      // Input times are HH:MM — combine with date to form full timestamps
      const fa = first_active.includes('T') ? first_active : `${date}T${first_active}:00`
      const la = last_active.includes('T') ? last_active : `${date}T${last_active}:00`

      const syntheticEvents: Event[] = [
        { type: 'screen_unlock', timestamp: fa, work_day: date },
        { type: 'screen_lock', timestamp: la, work_day: date },
      ]

      const holidays = loadHolidays()
      const dayType = getDayType(date, holidays)
      const summary = calculateDay(syntheticEvents, dayType)
      summary.source = 'manual'
      summary.work_day = date
      // Store display-friendly HH:MM times
      summary.first_active = first_active.length <= 5 ? first_active : first_active.substring(0, 5)
      summary.last_active = last_active.length <= 5 ? last_active : last_active.substring(0, 5)

      db.prepare(`
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
      `).run(
        summary.work_day,
        summary.first_active,
        summary.last_active,
        summary.raw_minutes,
        summary.break_minutes,
        summary.effective_minutes,
        summary.overtime_minutes,
        summary.day_type,
        summary.source
      )

      return summary
    }
  )
}
