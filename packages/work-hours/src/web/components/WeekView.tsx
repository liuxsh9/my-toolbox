import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts'
import * as refreshBus from '../refreshBus'

interface DaySummary {
  work_day: string
  effective_minutes: number
  overtime_minutes: number
  break_minutes: number
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

function getMonday(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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

export function WeekView({ widget }: { widget?: boolean }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [days, setDays] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const monday = getMonday(new Date())
  monday.setDate(monday.getDate() + weekOffset * 7)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)

  const fetchWeek = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const res = await fetch(`/api/days?from=${dateStr(monday)}&to=${dateStr(sunday)}`)
      if (res.ok) setDays(await res.json())
    } catch { /* ignore */ }
    if (!opts?.silent) setLoading(false)
  }, [weekOffset])

  useEffect(() => {
    fetchWeek()
  }, [fetchWeek])

  useEffect(() => {
    return refreshBus.subscribeGlobalRefresh(async () => {
      setRefreshing(true)
      try {
        await fetchWeek({ silent: true })
      } finally {
        setRefreshing(false)
      }
    })
  }, [fetchWeek])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    refreshBus.emitGlobalRefresh('week')
  }, [])

  const chartData = WEEKDAY_SHORT.map((day, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    const ds = dateStr(d)
    const found = days.find(w => w.work_day === ds)
    const eff = found ? found.effective_minutes / 60 : 0
    const ot = found ? found.overtime_minutes / 60 : 0
    const brk = found ? found.break_minutes / 60 : 0
    return {
      day,
      date: ds.substring(5),
      normal: Math.max(0, eff - ot),
      overtime: ot,
      breakTime: brk,
      total: eff,
      onsite: eff + brk,
    }
  })

  const totalEffective = days.reduce((s, d) => s + d.effective_minutes, 0)
  const totalOvertime = days.reduce((s, d) => s + d.overtime_minutes, 0)
  const totalOnsite = days.reduce((s, d) => s + d.effective_minutes + d.break_minutes, 0)

  const weekLabel = `${dateStr(monday).substring(5)} — ${dateStr(sunday).substring(5)}`

  const p = widget ? 10 : 24

  return (
    <div style={{ padding: p, paddingTop: widget ? 8 : 24, ...(widget ? { height: '100%', display: 'flex', flexDirection: 'column' as const } : {}) }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: widget ? 6 : 12, marginBottom: widget ? 6 : 24, flexShrink: 0 }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={widget ? navBtnSmall : navBtnStyle}>←</button>
        <span style={{ fontSize: widget ? 11 : 14, fontWeight: 500, color: 'var(--wh-text)', minWidth: widget ? 80 : 120, textAlign: 'center' }}>
          {weekLabel}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} style={widget ? navBtnSmall : navBtnStyle}>→</button>
        <button
          onClick={handleRefresh}
          style={{
            ...(widget ? navBtnSmall : navBtnStyle),
            opacity: refreshing ? 0.5 : 1,
          }}
          title="Refresh current week"
          aria-label="↻"
          disabled={loading || refreshing}
        >
          ↻
        </button>
        {weekOffset !== 0 && (
          <button
            onClick={() => setWeekOffset(0)}
            style={{
              fontSize: widget ? 10 : 12,
              color: 'var(--wh-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            This week
          </button>
        )}
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: widget ? 12 : 28, marginBottom: widget ? 6 : 24, flexShrink: 0, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: widget ? 9 : 11, color: 'var(--wh-text-secondary)', marginBottom: 2 }}>Effective</div>
          <div style={{ fontSize: widget ? 14 : 22, fontWeight: 700, color: 'var(--wh-text)', letterSpacing: '-0.02em' }}>
            {fmtMinutes(totalEffective)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: widget ? 9 : 11, color: 'var(--wh-text-secondary)', marginBottom: 2 }}>On-site</div>
          <div style={{ fontSize: widget ? 14 : 22, fontWeight: 700, color: 'var(--wh-text-secondary)', letterSpacing: '-0.02em' }}>
            {fmtMinutes(totalOnsite)}
          </div>
        </div>
        {totalOvertime > 0 && (
          <div>
            <div style={{ fontSize: widget ? 9 : 11, color: 'var(--wh-text-secondary)', marginBottom: 2 }}>Overtime</div>
            <div style={{ fontSize: widget ? 14 : 22, fontWeight: 700, color: 'var(--wh-overtime)', letterSpacing: '-0.02em' }}>
              {fmtMinutes(totalOvertime)}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--wh-text-secondary)', padding: 20 }}>...</div>
      ) : (
        <div style={widget ? { flex: 1, minHeight: 0 } : { height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={widget ? 18 : 36} margin={{ top: 4, right: 4, bottom: 0, left: widget ? -24 : -8 }}>
              <XAxis
                dataKey="day"
                tick={({ x, y, payload }: any) => {
                  const item = chartData.find(c => c.day === payload.value)
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={widget ? 9 : 12} fill="var(--wh-text)" fontWeight={500}>
                        {payload.value}
                      </text>
                      {!widget && (
                        <text x={0} y={0} dy={28} textAnchor="middle" fontSize={10} fill="var(--wh-text-secondary)">
                          {item?.date}
                        </text>
                      )}
                    </g>
                  )
                }}
                axisLine={false}
                tickLine={false}
                height={widget ? 20 : 40}
              />
              <YAxis
                tick={{ fontSize: widget ? 9 : 11, fill: 'var(--wh-text-secondary)' }}
                axisLine={false}
                tickLine={false}
                domain={[0, (max: number) => Math.max(12, Math.ceil(max + 1))]}
                tickFormatter={v => `${v}h`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div style={{
                      background: 'var(--wh-surface)',
                      border: '1px solid var(--wh-border)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 11,
                      color: 'var(--wh-text)',
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.day} {d.date}</div>
                      <div>Effective: {d.total.toFixed(1)}h</div>
                      {d.breakTime > 0 && <div style={{ color: 'var(--wh-text-secondary)' }}>Break: {d.breakTime.toFixed(1)}h</div>}
                      <div style={{ color: 'var(--wh-text-secondary)' }}>On-site: {d.onsite.toFixed(1)}h</div>
                      {d.overtime > 0 && <div style={{ color: 'var(--wh-overtime)' }}>OT: {d.overtime.toFixed(1)}h</div>}
                    </div>
                  )
                }}
              />
              <ReferenceLine
                y={8}
                stroke="var(--wh-text-secondary)"
                strokeDasharray="4 4"
                strokeWidth={0.8}
                label={{ value: '8h', position: 'right', fontSize: 10, fill: 'var(--wh-text-secondary)' }}
              />
              <Bar dataKey="normal" stackId="a" fill="var(--wh-primary)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="overtime" stackId="a" fill="var(--wh-overtime)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="breakTime" stackId="a" shape={<StripedBar />} />
            </BarChart>
          </ResponsiveContainer>
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
