import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface Event {
  id?: number
  type: string
  timestamp: string
  work_day: string
}

export interface DaySummary {
  work_day: string
  first_active: string
  last_active: string
  raw_minutes: number
  break_minutes: number
  effective_minutes: number
  overtime_minutes: number
  day_type: string
  source: string
}

export interface HolidayYear {
  holidays: string[]
  adjusted_workdays: string[]
}

export interface HolidayData {
  [year: string]: HolidayYear
}

export type DayType = 'workday' | 'weekend' | 'holiday' | 'adjusted_workday' | 'month_end_saturday'

/**
 * Determine the logical work day for a timestamp.
 * Events between 0:00-3:59 belong to the previous calendar day.
 */
export function getWorkDay(timestamp: string): string {
  const d = new Date(timestamp)
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1)
  }
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Check if a date string is the last Saturday of its month.
 */
export function isMonthEndSaturday(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00')
  // Saturday = 6
  if (d.getDay() !== 6) return false
  // Check if adding 7 days would still be in the same month
  const nextSat = new Date(d)
  nextSat.setDate(nextSat.getDate() + 7)
  return nextSat.getMonth() !== d.getMonth()
}

/**
 * Determine the type of a given date.
 * Priority: holidays list > adjusted_workdays list > month-end Saturday > weekday/weekend
 */
export function getDayType(date: string, holidays: HolidayData): DayType {
  const year = date.slice(0, 4)
  const yearData = holidays[year]

  if (yearData) {
    if (yearData.holidays.includes(date)) return 'holiday'
    if (yearData.adjusted_workdays.includes(date)) return 'adjusted_workday'
  }

  if (isMonthEndSaturday(date)) return 'month_end_saturday'

  const d = new Date(date + 'T12:00:00')
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return 'weekend'

  return 'workday'
}

interface BreakPeriod {
  startMinutes: number // minutes from midnight
  endMinutes: number
}

const BREAKS: BreakPeriod[] = [
  { startMinutes: 12 * 60 + 30, endMinutes: 14 * 60 },   // 12:30-14:00 lunch (90 min)
  { startMinutes: 18 * 60, endMinutes: 18 * 60 + 30 },    // 18:00-18:30 dinner (30 min)
]

function toMinutesFromMidnight(timestamp: string): number {
  const d = new Date(timestamp)
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

/**
 * Calculate overlap in minutes between two ranges [a1,a2] and [b1,b2].
 */
function overlapMinutes(a1: number, a2: number, b1: number, b2: number): number {
  const start = Math.max(a1, b1)
  const end = Math.min(a2, b2)
  return Math.max(0, end - start)
}

const ACTIVE_START_TYPES = ['screen_unlock', 'idle_end']
const ACTIVE_END_TYPES = ['screen_lock', 'idle_start']

/**
 * Calculate a day's summary from its events and day type.
 */
export function calculateDay(events: Event[], dayType: DayType): DaySummary {
  const workDay = events.length > 0 ? events[0].work_day : ''

  if (events.length === 0) {
    return {
      work_day: workDay,
      first_active: '',
      last_active: '',
      raw_minutes: 0,
      break_minutes: 0,
      effective_minutes: 0,
      overtime_minutes: 0,
      day_type: dayType,
      source: 'auto',
    }
  }

  // Sort events by timestamp
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // first_active: earliest screen_unlock or idle_end
  const firstActiveEvent = sorted.find((e) => ACTIVE_START_TYPES.includes(e.type))
  const firstActive = firstActiveEvent ? firstActiveEvent.timestamp : sorted[0].timestamp

  // last_active: latest screen_lock or idle_start, or latest event overall
  // For idle_start events, backtrack by the idle threshold (300s) to reflect
  // the actual last-active moment rather than when idle was detected.
  const endEvents = sorted.filter((e) => ACTIVE_END_TYPES.includes(e.type))
  const lastActiveEvent = endEvents.length > 0 ? endEvents[endEvents.length - 1] : sorted[sorted.length - 1]
  let lastActive = lastActiveEvent.timestamp
  if (lastActiveEvent.type === 'idle_start') {
    const t = new Date(lastActive)
    t.setSeconds(t.getSeconds() - 300)
    lastActive = t.toISOString()
  }

  const firstMin = toMinutesFromMidnight(firstActive)
  let lastMin = toMinutesFromMidnight(lastActive)

  // Handle cross-midnight: if lastMin < firstMin, the work extended past midnight
  // Add 24h to lastMin so the math works
  if (lastMin < firstMin) {
    lastMin += 24 * 60
  }

  const rawMinutes = Math.round(lastMin - firstMin)

  // Calculate break deductions: overlap of work span with each break period
  let breakMinutes = 0
  for (const brk of BREAKS) {
    breakMinutes += overlapMinutes(firstMin, lastMin, brk.startMinutes, brk.endMinutes)
  }
  breakMinutes = Math.round(breakMinutes)

  const effectiveMinutes = Math.max(0, rawMinutes - breakMinutes)

  let overtimeMinutes: number
  switch (dayType) {
    case 'workday':
    case 'adjusted_workday':
      overtimeMinutes = Math.max(0, effectiveMinutes - 480)
      break
    case 'weekend':
    case 'holiday':
      overtimeMinutes = effectiveMinutes
      break
    case 'month_end_saturday':
      // Fixed 480 effective, 0 overtime
      return {
        work_day: workDay,
        first_active: firstActive,
        last_active: lastActive,
        raw_minutes: rawMinutes,
        break_minutes: breakMinutes,
        effective_minutes: 480,
        overtime_minutes: 0,
        day_type: dayType,
        source: 'auto',
      }
    default:
      overtimeMinutes = 0
  }

  return {
    work_day: workDay,
    first_active: firstActive,
    last_active: lastActive,
    raw_minutes: rawMinutes,
    break_minutes: breakMinutes,
    effective_minutes: effectiveMinutes,
    overtime_minutes: overtimeMinutes,
    day_type: dayType,
    source: 'auto',
  }
}

/**
 * Load holidays data from the JSON file.
 */
export function loadHolidays(): HolidayData {
  const filePath = path.resolve(__dirname, '../../data/holidays.json')
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as HolidayData
  } catch {
    return {}
  }
}
