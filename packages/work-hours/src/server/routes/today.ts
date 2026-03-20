import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import {
  getWorkDay,
  getDayType,
  calculateDay,
  loadHolidays,
  type Event,
} from '../calculator.js'

const ACTIVE_START_TYPES = ['screen_unlock', 'idle_end']
const ACTIVE_END_TYPES = ['screen_lock', 'idle_start']

/**
 * Extract HH:MM from an ISO timestamp or return as-is if already short.
 */
function toHHMM(ts: string): string {
  if (!ts) return ts
  if (ts.length <= 5) return ts
  // Parse as Date to get correct local time regardless of timezone format
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts.substring(0, 5)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function registerTodayRoute(
  app: FastifyInstance,
  db: Database.Database,
  daemonStatus: () => boolean
) {
  // POST /api/today/refresh — inject events at current time to update last_active
  app.post('/api/today/refresh', async () => {
    const now = new Date()
    const nowIso = now.toISOString()
    const today = getWorkDay(nowIso)

    // Insert screen_lock at now (updates last_active) then screen_unlock (keeps status as working)
    const insertStmt = db.prepare('INSERT INTO events (type, timestamp, work_day) VALUES (?, ?, ?)')
    insertStmt.run('screen_lock', nowIso, today)
    const unlockTime = new Date(now.getTime() + 1000).toISOString()
    insertStmt.run('screen_unlock', unlockTime, today)

    // Recalculate summary
    let events = db
      .prepare('SELECT * FROM events WHERE work_day = ? ORDER BY timestamp ASC')
      .all(today) as Event[]

    const holidays = loadHolidays()
    const dayType = getDayType(today, holidays)

    const existing = db
      .prepare('SELECT source, first_active FROM daily_summary WHERE work_day = ?')
      .get(today) as { source: string; first_active: string } | undefined

    if (existing?.source === 'manual' && existing.first_active) {
      const manualStart = existing.first_active.includes('T')
        ? existing.first_active
        : `${today}T${existing.first_active}:00`
      events = [
        { type: 'screen_unlock', timestamp: manualStart, work_day: today },
        ...events,
      ]
    }

    const summary = calculateDay(events, dayType)

    if (existing?.source === 'manual') {
      summary.source = 'manual'
      summary.first_active = existing.first_active
    }

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
      today,
      summary.first_active,
      summary.last_active,
      summary.raw_minutes,
      summary.break_minutes,
      summary.effective_minutes,
      summary.overtime_minutes,
      summary.day_type,
      summary.source
    )

    return { ok: true, last_active: toHHMM(summary.last_active) }
  })

  app.get('/api/today', async () => {
    const today = getWorkDay(new Date().toISOString())
    let events = db
      .prepare('SELECT * FROM events WHERE work_day = ? ORDER BY timestamp ASC')
      .all(today) as Event[]

    const holidays = loadHolidays()
    const dayType = getDayType(today, holidays)

    // Check if this day has a manual start time
    const existing = db
      .prepare('SELECT source, first_active FROM daily_summary WHERE work_day = ?')
      .get(today) as { source: string; first_active: string } | undefined

    if (existing?.source === 'manual' && existing.first_active) {
      const manualStart = existing.first_active.includes('T')
        ? existing.first_active
        : `${today}T${existing.first_active}:00`
      events = [
        { type: 'screen_unlock', timestamp: manualStart, work_day: today },
        ...events,
      ]
    }

    const summary = calculateDay(events, dayType)

    // Determine current status from the last event
    let status: 'working' | 'idle' | 'left' | 'not_started' = 'not_started'
    if (events.length > 0) {
      const lastEvent = events[events.length - 1]
      if (ACTIVE_START_TYPES.includes(lastEvent.type)) {
        status = 'working'
      } else if (lastEvent.type === 'idle_start') {
        status = 'idle'
      } else if (lastEvent.type === 'screen_lock') {
        status = 'left'
      } else {
        // For any other event type, infer from context
        status = 'working'
      }
    }

    return {
      work_day: today,
      day_type: dayType,
      first_active: existing?.source === 'manual' && existing.first_active
        ? existing.first_active
        : summary.first_active ? toHHMM(summary.first_active) : null,
      last_active: summary.last_active ? toHHMM(summary.last_active) : null,
      status,
      raw_minutes: summary.raw_minutes,
      break_minutes: summary.break_minutes,
      effective_minutes: summary.effective_minutes,
      overtime_minutes: summary.overtime_minutes,
      daemon_running: daemonStatus(),
    }
  })
}
