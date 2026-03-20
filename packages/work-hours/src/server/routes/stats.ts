import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import type { DaySummary } from '../calculator.js'

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  // getDay(): 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseTimeToMinutes(timestamp: string): number {
  // Handle both HH:MM and full ISO timestamps
  if (timestamp.includes('T')) {
    const d = new Date(timestamp)
    return d.getHours() * 60 + d.getMinutes()
  }
  const [h, m] = timestamp.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function minutesToTimeStr(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function toHHMM(ts: string): string {
  if (!ts) return ts
  if (ts.length <= 5) return ts
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts.substring(0, 5)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function registerStatsRoute(app: FastifyInstance, db: Database.Database) {
  app.get<{ Querystring: { period?: string } }>('/api/stats', async (req, reply) => {
    const period = req.query.period || 'week'

    if (period !== 'week' && period !== 'month') {
      return reply.status(400).send({ error: 'period must be "week" or "month"' })
    }

    const now = new Date()
    let from: string
    let to: string

    if (period === 'week') {
      const monday = getMonday(now)
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      from = formatDate(monday)
      to = formatDate(sunday)
    } else {
      // month: first day to last day of current month
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      from = formatDate(firstDay)
      to = formatDate(lastDay)
    }

    const rows = db
      .prepare(
        'SELECT * FROM daily_summary WHERE work_day >= ? AND work_day <= ? ORDER BY work_day ASC'
      )
      .all(from, to) as DaySummary[]

    const daysWorked = rows.filter((r) => r.effective_minutes > 0)

    if (daysWorked.length === 0) {
      return {
        period: `${from} ~ ${to}`,
        total_effective_hours: 0,
        total_overtime_hours: 0,
        total_onsite_hours: 0,
        avg_effective_hours: 0,
        avg_start_time: null,
        avg_end_time: null,
        earliest_start: null,
        latest_end: null,
        days_worked: 0,
      }
    }

    const totalEffective = daysWorked.reduce((s, r) => s + r.effective_minutes, 0)
    const totalOvertime = daysWorked.reduce((s, r) => s + r.overtime_minutes, 0)
    const totalBreak = daysWorked.reduce((s, r) => s + (r.break_minutes ?? 0), 0)

    // Collect start/end times for averaging
    const startMinutes: number[] = []
    const endMinutes: number[] = []
    let earliestStart: string | null = null
    let latestEnd: string | null = null

    for (const row of daysWorked) {
      if (row.first_active) {
        const sm = parseTimeToMinutes(row.first_active)
        startMinutes.push(sm)
        if (!earliestStart || row.first_active < earliestStart) {
          earliestStart = row.first_active
        }
      }
      if (row.last_active) {
        const em = parseTimeToMinutes(row.last_active)
        endMinutes.push(em)
        if (!latestEnd || row.last_active > latestEnd) {
          latestEnd = row.last_active
        }
      }
    }

    const avgStartMin =
      startMinutes.length > 0
        ? startMinutes.reduce((a, b) => a + b, 0) / startMinutes.length
        : 0
    const avgEndMin =
      endMinutes.length > 0
        ? endMinutes.reduce((a, b) => a + b, 0) / endMinutes.length
        : 0

    return {
      period: `${from} ~ ${to}`,
      total_effective_hours: +(totalEffective / 60).toFixed(1),
      total_overtime_hours: +(totalOvertime / 60).toFixed(1),
      total_onsite_hours: +((totalEffective + totalBreak) / 60).toFixed(1),
      avg_effective_hours: +(totalEffective / 60 / daysWorked.length).toFixed(1),
      avg_start_time: startMinutes.length > 0 ? minutesToTimeStr(avgStartMin) : null,
      avg_end_time: endMinutes.length > 0 ? minutesToTimeStr(avgEndMin) : null,
      earliest_start: earliestStart ? toHHMM(earliestStart) : null,
      latest_end: latestEnd ? toHHMM(latestEnd) : null,
      days_worked: daysWorked.length,
    }
  })
}
