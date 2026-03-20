import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, CartesianGrid } from 'recharts'

interface DaySummary {
  work_day: string
  effective_minutes: number
  overtime_minutes: number
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type RangeOption = 30 | 60 | 90

export function TrendView({ widget }: { widget?: boolean }) {
  const [range, setRange] = useState<RangeOption>(30)
  const [showOvertime, setShowOvertime] = useState(false)
  const [days, setDays] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - range + 1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/days?from=${dateStr(from)}&to=${dateStr(today)}`)
      if (res.ok) setDays(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [range])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Build chart data for every day in range (fill gaps with 0)
  const chartData: { date: string; label: string; hours: number; overtime: number }[] = []
  const cursor = new Date(from)
  while (cursor <= today) {
    const ds = dateStr(cursor)
    const found = days.find(d => d.work_day === ds)
    const dow = cursor.getDay()
    // Only include weekdays in the chart (skip weekends with no data)
    const isWeekend = dow === 0 || dow === 6
    const eff = found ? found.effective_minutes / 60 : 0
    const ot = found ? found.overtime_minutes / 60 : 0

    if (!isWeekend || eff > 0) {
      chartData.push({
        date: ds,
        label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
        hours: parseFloat(eff.toFixed(1)),
        overtime: parseFloat(ot.toFixed(1)),
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  const avgHours = chartData.length > 0
    ? chartData.reduce((s, d) => s + d.hours, 0) / chartData.filter(d => d.hours > 0).length
    : 0

  return (
    <div style={{ padding: widget ? 10 : 0, paddingTop: widget ? 8 : 24, ...(widget ? { height: '100%', display: 'flex', flexDirection: 'column' as const } : {}) }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: widget ? 8 : 16, marginBottom: widget ? 6 : 24, flexWrap: 'wrap', flexShrink: 0 }}>
        {/* Range toggles */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([30, 60, 90] as RangeOption[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: widget ? '3px 8px' : '5px 12px',
                fontSize: widget ? 10 : 12,
                fontWeight: range === r ? 600 : 400,
                color: range === r ? '#FFFFFF' : 'var(--wh-text-secondary)',
                background: range === r ? 'var(--wh-primary)' : 'transparent',
                border: range === r ? 'none' : '1px solid var(--wh-border)',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {r}d
            </button>
          ))}
        </div>

        {/* Overtime toggle */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: widget ? 10 : 12,
          color: 'var(--wh-text-secondary)',
          cursor: 'pointer',
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={showOvertime}
            onChange={e => setShowOvertime(e.target.checked)}
            style={{ accentColor: 'var(--wh-overtime)' }}
          />
          OT
        </label>

        {/* Average */}
        {chartData.length > 0 && (
          <span style={{ fontSize: widget ? 10 : 12, color: 'var(--wh-text-secondary)', marginLeft: 'auto' }}>
            Avg: {avgHours.toFixed(1)}h
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--wh-text-secondary)', padding: 20 }}>...</div>
      ) : chartData.length === 0 ? (
        <div style={{ color: 'var(--wh-text-secondary)', padding: '40px 0', textAlign: 'center', fontSize: widget ? 11 : 14 }}>
          No data for this period
        </div>
      ) : (
        <div style={widget ? { flex: 1, minHeight: 0 } : { height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: widget ? -24 : -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--wh-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: widget ? 8 : 10, fill: 'var(--wh-text-secondary)' }}
                axisLine={false}
                tickLine={false}
                interval={Math.max(0, Math.floor(chartData.length / (widget ? 6 : 10)) - 1)}
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
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.date}</div>
                      <div style={{ color: 'var(--wh-primary)' }}>Hours: {d.hours}h</div>
                      {d.overtime > 0 && (
                        <div style={{ color: 'var(--wh-overtime)' }}>OT: {d.overtime}h</div>
                      )}
                    </div>
                  )
                }}
              />
              <ReferenceLine
                y={8}
                stroke="var(--wh-text-secondary)"
                strokeDasharray="6 4"
                strokeWidth={1}
                label={{ value: '8h', position: 'right', fontSize: 10, fill: 'var(--wh-text-secondary)' }}
              />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="var(--wh-primary)"
                strokeWidth={2}
                dot={{ r: widget ? 1.5 : 2.5, fill: 'var(--wh-primary)', strokeWidth: 0 }}
                activeDot={{ r: widget ? 3 : 4, fill: 'var(--wh-primary)', strokeWidth: 2, stroke: 'var(--wh-surface)' }}
              />
              {showOvertime && (
                <Line
                  type="monotone"
                  dataKey="overtime"
                  stroke="var(--wh-overtime)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={{ r: widget ? 1 : 2, fill: 'var(--wh-overtime)', strokeWidth: 0 }}
                  activeDot={{ r: widget ? 2.5 : 3.5, fill: 'var(--wh-overtime)', strokeWidth: 2, stroke: 'var(--wh-surface)' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
