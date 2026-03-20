import { useState, useEffect } from 'react'

interface Stats {
  period: string
  total_effective_hours: number
  total_overtime_hours: number
  total_onsite_hours: number
  avg_effective_hours: number
  avg_start_time: string | null
  avg_end_time: string | null
  earliest_start: string | null
  latest_end: string | null
  days_worked: number
}

export function SummaryCards() {
  const [weekStats, setWeekStats] = useState<Stats | null>(null)
  const [monthStats, setMonthStats] = useState<Stats | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [wRes, mRes] = await Promise.all([
          fetch('/api/stats?period=week'),
          fetch('/api/stats?period=month'),
        ])
        if (wRes.ok) setWeekStats(await wRes.json())
        if (mRes.ok) setMonthStats(await mRes.json())
      } catch { /* ignore */ }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  const cards: { label: string; value: string; sub?: string }[] = [
    {
      label: 'This week',
      value: weekStats ? `${weekStats.total_effective_hours.toFixed(1)}h` : '--',
      sub: weekStats && weekStats.total_onsite_hours > 0 ? `${weekStats.total_onsite_hours.toFixed(1)}h on-site` : undefined,
    },
    {
      label: 'This month',
      value: monthStats ? `${monthStats.total_effective_hours.toFixed(1)}h` : '--',
      sub: monthStats && monthStats.total_onsite_hours > 0 ? `${monthStats.total_onsite_hours.toFixed(1)}h on-site` : undefined,
    },
    {
      label: 'Avg daily',
      value: weekStats ? `${weekStats.avg_effective_hours.toFixed(1)}h` : '--',
    },
    {
      label: 'Avg start',
      value: weekStats?.avg_start_time ?? '--',
    },
    {
      label: 'Avg end',
      value: weekStats?.avg_end_time ?? '--',
    },
  ]

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      {cards.map(card => (
        <div
          key={card.label}
          style={{
            flex: '1 1 120px',
            minWidth: 100,
            padding: '12px 16px',
            border: '1px solid var(--wh-border)',
            borderRadius: 8,
            background: 'var(--wh-surface)',
          }}
        >
          <div style={{
            fontSize: 11,
            color: 'var(--wh-text-secondary)',
            marginBottom: 4,
            letterSpacing: '0.02em',
          }}>
            {card.label}
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--wh-text)',
            letterSpacing: '-0.02em',
          }}>
            {card.value}
          </div>
          {card.sub && (
            <div style={{
              fontSize: 10,
              color: 'var(--wh-text-secondary)',
              marginTop: 2,
            }}>
              {card.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
