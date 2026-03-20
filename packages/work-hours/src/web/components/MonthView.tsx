import { useState, useEffect, useCallback } from 'react'

interface DaySummary {
  work_day: string
  effective_minutes: number
  overtime_minutes: number
  day_type: string
}

function fmtMinutes(m: number): string {
  if (m <= 0) return '0h'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}m`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonthRange(year: number, month: number): { first: Date; last: Date } {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  return { first, last }
}

function isLastSaturdayOfMonth(d: Date): boolean {
  if (d.getDay() !== 6) return false
  const nextSat = new Date(d)
  nextSat.setDate(nextSat.getDate() + 7)
  return nextSat.getMonth() !== d.getMonth()
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function cellColor(eff: number, dayType: string, dark?: boolean): string {
  if (dayType === 'weekend' || dayType === 'holiday') return dark ? 'rgba(255,255,255,0.04)' : '#F3F4F6'
  if (eff <= 0) return dark ? 'rgba(255,255,255,0.02)' : '#FAFAF8'
  const hours = eff / 60
  // Green (<=8h) → amber → red (>=14h), every 0.5h a step
  // 13 stops: 8.0, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0
  const lightStops = [
    '#5a9e6f', // 8.0h  sage green
    '#6b9c60', // 8.5h
    '#7d9a52', // 9.0h  olive-green
    '#8f9850', // 9.5h
    '#a1964e', // 10.0h olive-amber
    '#b0904c', // 10.5h
    '#b8884a', // 11.0h amber
    '#be7e4a', // 11.5h
    '#c4744a', // 12.0h terracotta
    '#c46a50', // 12.5h
    '#c06058', // 13.0h muted red
    '#b85660', // 13.5h
    '#b04c5a', // 14.0h deep muted red
  ]
  const darkStops = [
    [90,158,111],   // 8.0h
    [107,156,96],   // 8.5h
    [125,154,82],   // 9.0h
    [143,152,80],   // 9.5h
    [161,150,78],   // 10.0h
    [176,144,76],   // 10.5h
    [184,136,74],   // 11.0h
    [190,126,74],   // 11.5h
    [196,116,74],   // 12.0h
    [196,106,80],   // 12.5h
    [192,96,88],    // 13.0h
    [184,86,96],    // 13.5h
    [176,76,90],    // 14.0h
  ]
  const N = lightStops.length - 1 // 12
  if (hours <= 8) {
    return dark ? `rgba(${darkStops[0].join(',')},0.45)` : lightStops[0]
  }
  if (hours >= 14) {
    return dark ? `rgba(${darkStops[N].join(',')},0.65)` : lightStops[N]
  }
  // Map hours to index: (hours - 8) * 2 → 0..12
  const idx = Math.min(Math.floor((hours - 8) * 2), N - 1)
  const t = (hours - 8) * 2 - idx
  if (dark) {
    const opacity = 0.45 + idx * 0.017 + t * 0.017
    const from = darkStops[idx]
    const to = darkStops[idx + 1]
    const r = Math.round(from[0] + (to[0] - from[0]) * t)
    const g = Math.round(from[1] + (to[1] - from[1]) * t)
    const b = Math.round(from[2] + (to[2] - from[2]) * t)
    return `rgba(${r},${g},${b},${opacity.toFixed(2)})`
  }
  const fromRgb = hexToRgb(lightStops[idx])
  const toRgb = hexToRgb(lightStops[idx + 1])
  const r = Math.round(fromRgb[0] + (toRgb[0] - fromRgb[0]) * t)
  const g = Math.round(fromRgb[1] + (toRgb[1] - fromRgb[1]) * t)
  const b = Math.round(fromRgb[2] + (toRgb[2] - fromRgb[2]) * t)
  return `rgb(${r},${g},${b})`
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function cellTextColor(eff: number, dayType: string, dark?: boolean): string {
  if (dayType === 'weekend' || dayType === 'holiday') return dark ? 'var(--wh-text-secondary)' : '#9CA3AF'
  if (eff <= 0) return dark ? 'rgba(255,255,255,0.15)' : '#D1D5DB'
  const hours = eff / 60
  if (dark) return hours >= 8 ? '#ede8de' : 'var(--wh-text)'
  if (hours >= 9) return '#FFFFFF'
  return '#1F2937'
}

export function MonthView({ onDayClick, widget }: { onDayClick: (date: string) => void; widget?: boolean }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [days, setDays] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null)

  const { first, last } = getMonthRange(year, month)

  const fetchMonth = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/days?from=${dateStr(first)}&to=${dateStr(last)}`)
      if (res.ok) setDays(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [year, month])

  useEffect(() => {
    fetchMonth()
  }, [fetchMonth])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  const goToday = () => {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  // Build calendar grid
  // Monday = 0, Sunday = 6
  const firstDow = (first.getDay() + 6) % 7 // convert Sun=0 to Mon=0
  const totalDays = last.getDate()
  const weeks: (Date | null)[][] = []
  let currentWeek: (Date | null)[] = []

  // Leading empty cells
  for (let i = 0; i < firstDow; i++) currentWeek.push(null)

  for (let d = 1; d <= totalDays; d++) {
    currentWeek.push(new Date(year, month, d))
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  // Trailing empty cells
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    weeks.push(currentWeek)
  }

  const todayString = dateStr(new Date())
  const totalEffective = days.reduce((s, d) => s + d.effective_minutes, 0)
  const totalOvertime = days.reduce((s, d) => s + d.overtime_minutes, 0)

  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth()
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('theme-dark')

  return (
    <div style={{ padding: widget ? 10 : 0, paddingTop: widget ? 8 : 24, ...(widget ? { height: '100%', display: 'flex', flexDirection: 'column' as const } : {}) }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: widget ? 6 : 12, marginBottom: widget ? 6 : 24, flexShrink: 0 }}>
        <button onClick={prevMonth} style={widget ? navBtnSmall : navBtnStyle}>←</button>
        <span style={{ fontSize: widget ? 11 : 15, fontWeight: 600, color: 'var(--wh-text)', minWidth: widget ? 90 : 140, textAlign: 'center' }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={nextMonth} style={widget ? navBtnSmall : navBtnStyle}>→</button>
        {!isCurrentMonth && (
          <button
            onClick={goToday}
            style={{
              fontSize: widget ? 10 : 12,
              color: 'var(--wh-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            This month
          </button>
        )}
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: widget ? 16 : 32, marginBottom: widget ? 6 : 24, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: widget ? 9 : 11, color: 'var(--wh-text-secondary)', marginBottom: 2 }}>Total</div>
          <div style={{ fontSize: widget ? 16 : 22, fontWeight: 700, color: 'var(--wh-text)', letterSpacing: '-0.02em' }}>
            {fmtMinutes(totalEffective)}
          </div>
        </div>
        {totalOvertime > 0 && (
          <div>
            <div style={{ fontSize: widget ? 9 : 11, color: 'var(--wh-text-secondary)', marginBottom: 2 }}>Overtime</div>
            <div style={{ fontSize: widget ? 16 : 22, fontWeight: 700, color: 'var(--wh-overtime)', letterSpacing: '-0.02em' }}>
              {fmtMinutes(totalOvertime)}
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: widget ? 9 : 11, color: 'var(--wh-text-secondary)', marginBottom: 2 }}>Days</div>
          <div style={{ fontSize: widget ? 16 : 22, fontWeight: 700, color: 'var(--wh-text)', letterSpacing: '-0.02em' }}>
            {days.filter(d => d.effective_minutes > 0).length}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--wh-text-secondary)', padding: 20 }}>...</div>
      ) : (
        <div style={widget ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const } : {}}>
          {/* Weekday headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: widget ? 1 : 4,
            marginBottom: widget ? 1 : 4,
            flexShrink: 0,
          }}>
            {WEEKDAY_HEADERS.map(d => (
              <div key={d} style={{
                textAlign: 'center',
                fontSize: widget ? 8 : 11,
                fontWeight: 500,
                color: 'var(--wh-text-secondary)',
                padding: widget ? '1px 0' : '2px 0',
              }}>
                {widget ? d.charAt(0) : d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: widget ? 1 : 4,
            ...(widget ? { flex: 1, minHeight: 0, gridAutoRows: '1fr' } : {}),
          }}>
            {weeks.flat().map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} style={{ borderRadius: widget ? 3 : 6, ...(widget ? {} : { aspectRatio: '1' }) }} />
              }

              const ds = dateStr(date)
              const found = days.find(d => d.work_day === ds)
              const eff = found?.effective_minutes ?? 0
              const dayType = found?.day_type ?? (date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : 'workday')
              const isToday = ds === todayString
              const isMonthEndSat = isLastSaturdayOfMonth(date)
              const bg = cellColor(eff, dayType, isDark)
              const textColor = cellTextColor(eff, dayType, isDark)

              return (
                <div
                  key={ds}
                  onClick={widget ? undefined : () => onDayClick(ds)}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.05)'
                    if (widget && eff > 0) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoverInfo({ x: rect.left + rect.width / 2, y: rect.top, text: `${(eff / 60).toFixed(1)}h` })
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)'
                    if (widget) setHoverInfo(null)
                  }}
                  style={{                    ...(widget ? {} : { aspectRatio: '1' }),
                    borderRadius: widget ? 3 : 6,
                    background: bg,
                    border: isToday
                      ? '2px solid var(--wh-primary)'
                      : isMonthEndSat
                        ? '1.5px dashed var(--wh-primary-dark)'
                        : '1px solid transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: widget ? 'default' : 'pointer',
                    transition: 'transform .1s',
                    position: 'relative',
                  }}
                >
                  <span style={{
                    fontSize: widget ? 9 : 13,
                    fontWeight: isToday ? 700 : 500,
                    color: textColor,
                    lineHeight: 1,
                  }}>
                    {date.getDate()}
                  </span>
                  {eff > 0 && !widget && (
                    <span style={{
                      fontSize: 9,
                      color: textColor,
                      opacity: 0.8,
                      marginTop: 2,
                    }}>
                      {(eff / 60).toFixed(1)}h
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {widget && hoverInfo && (
        <div style={{
          position: 'fixed',
          left: hoverInfo.x,
          top: hoverInfo.y - 28,
          transform: 'translateX(-50%)',
          background: 'var(--wh-surface)',
          border: '1px solid var(--wh-border)',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--wh-text)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 100,
        }}>
          {hoverInfo.text}
        </div>
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--wh-border)',
  borderRadius: 6,
  background: 'var(--wh-surface)',
  color: 'var(--wh-text-secondary)',
  cursor: 'pointer',
  fontSize: 14,
}

const navBtnSmall: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--wh-border)',
  borderRadius: 5,
  background: 'var(--wh-surface)',
  color: 'var(--wh-text-secondary)',
  cursor: 'pointer',
  fontSize: 12,
}
