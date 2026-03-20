import { useState, useEffect, useRef, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
import * as refreshBus from '../refreshBus'

/* ── types ── */
interface TodayData {
  work_day: string
  day_type: string
  first_active: string | null
  last_active: string | null
  status: 'working' | 'idle' | 'left' | 'not_started'
  raw_minutes: number
  break_minutes: number
  effective_minutes: number
  overtime_minutes: number
  daemon_running: boolean
}

interface DaySummary {
  work_day: string
  first_active: string | null
  last_active: string | null
  raw_minutes: number
  break_minutes: number
  effective_minutes: number
  overtime_minutes: number
  day_type: string
  source: string
}

/* ── helpers ── */

/** Custom bar shape that renders diagonal stripes for break time */
function StripedBar(props: any) {
  const { x, y, width, height } = props
  if (!height || height <= 0) return null
  const id = `break-stripe-${Math.round(x)}-${Math.round(y)}`
  const isDark = document.documentElement.classList.contains('theme-dark')
  const bg = isDark ? '#3a3730' : '#E5E5E5'
  const line = isDark ? 'rgba(255,255,255,0.09)' : '#D1D5DB'
  return (
    <g>
      <defs>
        <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill={bg} />
          <line x1="0" y1="0" x2="0" y2="4" stroke={line} strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id})`} rx={3} ry={3} />
    </g>
  )
}
function fmtMinutes(m: number): string {
  if (m <= 0) return '0h'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}m`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}

function fmtHoursDecimal(m: number): string {
  return (m / 60).toFixed(1)
}

const STATUS_CONFIG: Record<string, { color: string; label: string; pulse: boolean }> = {
  working:     { color: '#22c55e', label: 'Working',     pulse: true },
  idle:        { color: '#eab308', label: 'Idle',        pulse: false },
  left:        { color: '#9CA3AF', label: 'Left',        pulse: false },
  not_started: { color: 'transparent', label: 'Not started', pulse: false },
}

/* ── widget size hook ── */
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(e.contentRect.width)
    })
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [ref])
  return width
}

/* ── monday of current week ── */
function getMonday(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  return copy
}

function dateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/* ── break stripe pattern (SVG) ── */
function breakStripeBackground(): string {
  const isDark = document.documentElement.classList.contains('theme-dark')
  const bg = isDark ? '#3a3730' : '#E5E5E5'
  const line = isDark ? 'rgba(255,255,255,0.15)' : '#D1D5DB'
  return `repeating-linear-gradient(45deg, ${bg}, ${bg} 2px, ${line} 2px, ${line} 4px)`
}

/* ── Timeline bar ── */
function TimelineBar({ firstActive, lastActive, breakMinutes }: {
  firstActive: string | null
  lastActive: string | null
  breakMinutes: number
}) {
  const startHour = 8
  const endHour = 26 // 2:00 next day
  const totalHours = endHour - startHour

  function timeToFraction(t: string): number {
    const [hh, mm] = t.split(':').map(Number)
    let h = hh
    if (h < startHour) h += 24
    return Math.max(0, Math.min(1, (h + mm / 60 - startHour) / totalHours))
  }

  const hourMarkers = []
  for (let h = startHour; h <= endHour; h += 2) {
    const label = h >= 24 ? `${h - 24}:00` : `${h}:00`
    hourMarkers.push({ h, label, frac: (h - startHour) / totalHours })
  }

  const hasData = firstActive && lastActive

  // Break slots: 12:30-14:00 and 18:00-18:30
  const breakSlots = [
    { start: '12:30', end: '14:00' },
    { start: '18:00', end: '18:30' },
  ]

  return (
    <div style={{ position: 'relative' }}>
      {/* Hour labels */}
      <div style={{ position: 'relative', height: 16, marginBottom: 4 }}>
        {hourMarkers.map(m => (
          <span key={m.h} style={{
            position: 'absolute',
            left: `${m.frac * 100}%`,
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: 'var(--wh-text-secondary)',
          }}>
            {m.label}
          </span>
        ))}
      </div>

      {/* Bar track */}
      <div style={{
        position: 'relative',
        height: 28,
        background: 'var(--wh-track)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {/* Work segment */}
        {hasData && (
          <div style={{
            position: 'absolute',
            left: `${timeToFraction(firstActive) * 100}%`,
            width: `${(timeToFraction(lastActive) - timeToFraction(firstActive)) * 100}%`,
            top: 0,
            bottom: 0,
            background: 'var(--wh-primary)',
            borderRadius: 4,
            opacity: 0.85,
          }} />
        )}

        {/* Break slots overlay */}
        {hasData && breakSlots.map((slot, i) => {
          const slotStart = timeToFraction(slot.start)
          const slotEnd = timeToFraction(slot.end)
          const workStart = timeToFraction(firstActive)
          const workEnd = timeToFraction(lastActive)
          const overlapStart = Math.max(slotStart, workStart)
          const overlapEnd = Math.min(slotEnd, workEnd)
          if (overlapEnd <= overlapStart) return null
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `${overlapStart * 100}%`,
              width: `${(overlapEnd - overlapStart) * 100}%`,
              top: 0,
              bottom: 0,
              background: breakStripeBackground(),
              borderRadius: 2,
            }} />
          )
        })}

        {/* Hour grid lines */}
        {hourMarkers.map(m => (
          <div key={m.h} style={{
            position: 'absolute',
            left: `${m.frac * 100}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'var(--wh-border)',
          }} />
        ))}
      </div>
    </div>
  )
}

/* ── Status Dot ── */
function StatusDot({ status, size = 10 }: { status: string; size?: number }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: cfg.color,
      border: status === 'not_started' ? '1.5px solid #D1D5DB' : 'none',
      animation: cfg.pulse ? 'pulse-dot 2s ease-in-out infinite' : 'none',
      flexShrink: 0,
    }} />
  )
}

/* ── Main Component ── */
export function TodayView({ widget }: { widget?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const width = useContainerWidth(containerRef)
  const [data, setData] = useState<TodayData | null>(null)
  const [weekData, setWeekData] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)

  const isSmall = widget && width < 300
  const isLarge = widget && width >= 300

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch('/api/today')
      if (res.ok) setData(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const fetchWeek = useCallback(async () => {
    const now = new Date()
    const mon = getMonday(now)
    const sun = new Date(mon)
    sun.setDate(sun.getDate() + 6)
    try {
      const res = await fetch(`/api/days?from=${dateStr(mon)}&to=${dateStr(sun)}`)
      if (res.ok) setWeekData(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchToday()
    const id = setInterval(fetchToday, 30_000)
    return () => clearInterval(id)
  }, [fetchToday])

  useEffect(() => {
    if (!isSmall) fetchWeek()
  }, [isSmall, fetchWeek])

  useEffect(() => {
    return refreshBus.subscribeGlobalRefresh(async () => {
      await fetchToday()
      if (!isSmall) await fetchWeek()
    })
  }, [fetchToday, fetchWeek, isSmall])

  if (loading) {
    return (
      <div ref={containerRef} style={{ padding: widget ? 12 : 24, color: 'var(--wh-text-secondary)' }}>
        ...
      </div>
    )
  }

  if (!data) {
    return (
      <div ref={containerRef} style={{ padding: widget ? 12 : 24, color: 'var(--wh-text-secondary)' }}>
        No data available
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.not_started

  /* ── Widget: small ── */
  if (isSmall) {
    return (
      <div ref={containerRef} style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: '100%',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot status={data.status} size={8} />
          <span style={{
            fontSize: 11,
            color: 'var(--wh-text-secondary)',
          }}>
            {statusCfg.label}
          </span>
        </div>
        <div style={{
          fontSize: 32,
          fontWeight: 700,
          color: 'var(--wh-text)',
          lineHeight: 1,
          letterSpacing: '-0.03em',
        }}>
          {fmtHoursDecimal(data.effective_minutes)}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--wh-text-secondary)' }}>h</span>
        </div>
        {data.first_active && (
          <div style={{ fontSize: 12, color: 'var(--wh-text-secondary)' }}>
            Started {data.first_active}
          </div>
        )}
      </div>
    )
  }

  /* ── Widget: large ── */
  if (isLarge) {
    const mon = getMonday(new Date())
    const chartData = WEEKDAY_SHORT.map((day, i) => {
      const d = new Date(mon)
      d.setDate(d.getDate() + i)
      const ds = dateStr(d)
      const found = weekData.find(w => w.work_day === ds)
      const eff = found ? found.effective_minutes / 60 : 0
      const ot = found ? found.overtime_minutes / 60 : 0
      const brk = found ? found.break_minutes / 60 : 0
      return { day, normal: Math.max(0, eff - ot), overtime: ot, breakTime: brk }
    })

    return (
      <div ref={containerRef} style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        height: '100%',
        overflow: 'hidden',
      }}>
        {/* Top summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot status={data.status} size={8} />
          <span style={{ fontSize: 11, color: 'var(--wh-text-secondary)' }}>
            {statusCfg.label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--wh-text)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
          }}>
            {fmtHoursDecimal(data.effective_minutes)}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--wh-text-secondary)' }}>h</span>
          </span>
          {data.first_active && (
            <span style={{ fontSize: 11, color: 'var(--wh-text-secondary)' }}>
              from {data.first_active}
            </span>
          )}
        </div>

        {/* Mini weekly chart */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={14} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--wh-text-secondary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--wh-text-secondary)' }} axisLine={false} tickLine={false} domain={[0, 12]} />
              <ReferenceLine y={8} stroke="var(--wh-text-secondary)" strokeDasharray="3 3" strokeWidth={0.5} />
              <Bar dataKey="normal" stackId="a" fill="var(--wh-primary)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="overtime" stackId="a" fill="var(--wh-overtime)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="breakTime" stackId="a" shape={<StripedBar />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  /* ── Full page: Today view ── */
  const mon = getMonday(new Date())
  const chartData = WEEKDAY_SHORT.map((day, i) => {
    const d = new Date(mon)
    d.setDate(d.getDate() + i)
    const ds = dateStr(d)
    const found = weekData.find(w => w.work_day === ds)
    const eff = found ? found.effective_minutes / 60 : 0
    const ot = found ? found.overtime_minutes / 60 : 0
    const brk = found ? found.break_minutes / 60 : 0
    return { day, normal: Math.max(0, eff - ot), overtime: ot, breakTime: brk }
  })

  return (
    <div ref={containerRef} style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      gap: 32,
      paddingTop: 24,
    }}>
      {/* Left column: summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusDot status={data.status} />
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--wh-text)' }}>
            {statusCfg.label}
          </span>
        </div>

        {/* Effective hours */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--wh-text-secondary)', marginBottom: 4 }}>Effective hours</div>
          <div style={{
            fontSize: 42,
            fontWeight: 700,
            color: 'var(--wh-text)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
          }}>
            {fmtHoursDecimal(data.effective_minutes)}<span style={{ fontSize: 18, fontWeight: 400, color: 'var(--wh-text-secondary)' }}>h</span>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DetailRow label="Start" value={data.first_active ?? '--'} />
          <DetailRow label="End" value={data.last_active ?? '--'} />
          <DetailRow label="On-site" value={fmtMinutes(data.effective_minutes + data.break_minutes)} />
          <DetailRow label="Break" value={fmtMinutes(data.break_minutes)} />
          <DetailRow label="Overtime" value={data.overtime_minutes > 0 ? fmtMinutes(data.overtime_minutes) : '0h'} valueColor={data.overtime_minutes > 0 ? 'var(--wh-overtime)' : undefined} />
          <DetailRow label="Day type" value={data.day_type.replace(/_/g, ' ')} />
          <DetailRow label="Status" value={statusCfg.label} />
        </div>
      </div>

      {/* Right column: timeline + weekly chart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Timeline */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--wh-text-secondary)', marginBottom: 10 }}>Timeline</div>
          <TimelineBar
            firstActive={data.first_active}
            lastActive={data.last_active}
            breakMinutes={data.break_minutes}
          />
        </div>

        {/* Weekly mini chart */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--wh-text-secondary)', marginBottom: 10 }}>This week</div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={24} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--wh-text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--wh-text-secondary)' }} axisLine={false} tickLine={false} domain={[0, 12]} />
                <ReferenceLine y={8} stroke="var(--wh-text-secondary)" strokeDasharray="4 4" strokeWidth={0.8} label={{ value: '8h', position: 'right', fontSize: 10, fill: 'var(--wh-text-secondary)' }} />
                <Bar dataKey="normal" stackId="a" fill="var(--wh-primary)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="overtime" stackId="a" fill="var(--wh-overtime)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="breakTime" stackId="a" shape={<StripedBar />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--wh-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: valueColor ?? 'var(--wh-text)' }}>{value}</span>
    </div>
  )
}
