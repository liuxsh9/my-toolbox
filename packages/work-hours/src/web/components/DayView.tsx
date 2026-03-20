import { useState, useEffect, useCallback } from 'react'
import { EditModal } from './EditModal'
import * as refreshBus from '../refreshBus'

interface DayDetail {
  summary: {
    work_day: string
    first_active: string | null
    last_active: string | null
    raw_minutes: number
    break_minutes: number
    effective_minutes: number
    overtime_minutes: number
    day_type: string
    source: string
  } | null
  events: {
    id: number
    type: string
    timestamp: string
    work_day: string
  }[]
}

function fmtMinutes(m: number): string {
  if (m <= 0) return '0h'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}m`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EVENT_ICONS: Record<string, string> = {
  screen_unlock: '🔓',
  screen_lock: '🔒',
  idle_start: '💤',
  idle_end: '⏰',
}

const EVENT_LABELS: Record<string, string> = {
  screen_unlock: 'Screen unlock',
  screen_lock: 'Screen lock',
  idle_start: 'Idle start',
  idle_end: 'Idle end',
}

/* ── Break stripe helper ── */
function breakStripeBackground(): string {
  const isDark = document.documentElement.classList.contains('theme-dark')
  const bg = isDark ? '#3a3730' : '#E5E5E5'
  const line = isDark ? 'rgba(255,255,255,0.15)' : '#D1D5DB'
  return `repeating-linear-gradient(45deg, ${bg}, ${bg} 2px, ${line} 2px, ${line} 4px)`
}

/* ── Timeline bar ── */
function TimelineBar({ firstActive, lastActive }: {
  firstActive: string | null
  lastActive: string | null
}) {
  const startHour = 8
  const endHour = 26
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

  const breakSlots = [
    { start: '12:30', end: '14:00' },
    { start: '18:00', end: '18:30' },
  ]

  return (
    <div style={{ position: 'relative' }}>
      {/* break stripes rendered via CSS gradient */}
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
      <div style={{
        position: 'relative',
        height: 28,
        background: 'var(--wh-track)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
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

export function DayView({ initialDate, widget }: { initialDate?: string | null; widget?: boolean }) {
  const [date, setDate] = useState(initialDate ?? todayStr())
  const [data, setData] = useState<DayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const isToday = date === todayStr()

  const fetchDay = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/days/${d}`)
      if (res.ok) {
        setData(await res.json())
      } else {
        setData(null)
      }
    } catch {
      setData(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDay(date)
  }, [date, fetchDay])

  useEffect(() => {
    if (initialDate) setDate(initialDate)
  }, [initialDate])

  useEffect(() => {
    return refreshBus.subscribeGlobalRefresh(async () => {
      try {
        await fetchDay(date)
      } finally {
        setRefreshing(false)
      }
    })
  }, [date, fetchDay])

  const summary = data?.summary
  const events = data?.events ?? []

  return (
    <div style={{ padding: widget ? 10 : 0, paddingTop: widget ? 8 : 24, ...(widget ? { height: '100%', display: 'flex', flexDirection: 'column' as const, overflow: 'auto' } : {}) }}>
      {/* Date picker row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: widget ? 6 : 12, marginBottom: widget ? 6 : 24, flexShrink: 0 }}>
        <button
          onClick={() => {
            const d = new Date(date)
            d.setDate(d.getDate() - 1)
            setDate(fmtDate(d))
          }}
          style={widget ? navBtnSmall : navBtnStyle}
        >
          ←
        </button>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{
            fontSize: widget ? 11 : 14,
            fontWeight: 500,
            padding: widget ? '4px 6px' : '6px 10px',
            border: '1px solid var(--wh-border)',
            borderRadius: 6,
            background: 'var(--wh-surface)',
            color: 'var(--wh-text)',
            outline: 'none',
            colorScheme: 'dark',
          }}
        />
        <button
          onClick={() => {
            const d = new Date(date)
            d.setDate(d.getDate() + 1)
            setDate(fmtDate(d))
          }}
          style={widget ? navBtnSmall : navBtnStyle}
        >
          →
        </button>
        {isToday && (
          <button
            onClick={async () => {
              setRefreshing(true)
              let emitted = false
              try {
                await fetch('/api/today/refresh', { method: 'POST' })
                refreshBus.emitGlobalRefresh('day')
                emitted = true
              } catch { /* ignore */ }
              if (!emitted) setRefreshing(false)
            }}
            style={{
              ...(widget ? navBtnSmall : navBtnStyle),
              marginLeft: widget ? 0 : undefined,
              opacity: refreshing ? 0.5 : 1,
            }}
            title="Update end time to now"
            disabled={refreshing}
          >
            ↻
          </button>
        )}
        {!widget && summary && (
          <button
            onClick={() => setEditOpen(true)}
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              fontWeight: 500,
              padding: '6px 14px',
              border: '1px solid var(--wh-primary)',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--wh-primary)',
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
        )}
      </div>

      {loading && <div style={{ color: 'var(--wh-text-secondary)' }}>...</div>}

      {!loading && !summary && (
        <div style={{ color: 'var(--wh-text-secondary)', padding: '40px 0', textAlign: 'center', fontSize: widget ? 11 : 14 }}>
          No data for this date
        </div>
      )}

      {!loading && summary && (
        <>
          {/* Summary stats */}
          <div style={{
            display: 'flex',
            gap: widget ? 12 : 24,
            marginBottom: widget ? 10 : 24,
            flexWrap: 'wrap',
          }}>
            <StatChip label="Effective" value={fmtMinutes(summary.effective_minutes)} small={widget} />
            <StatChip label="On-site" value={fmtMinutes(summary.effective_minutes + summary.break_minutes)} valueColor="var(--wh-text-secondary)" small={widget} />
            <StatChip label="Break" value={fmtMinutes(summary.break_minutes)} small={widget} />
            <StatChip label="Overtime" value={summary.overtime_minutes > 0 ? fmtMinutes(summary.overtime_minutes) : '0h'} valueColor={summary.overtime_minutes > 0 ? 'var(--wh-overtime)' : undefined} small={widget} />
            <StatChip label="Start" value={summary.first_active ?? '--'} small={widget} />
            <StatChip label="End" value={summary.last_active ?? '--'} small={widget} />
            <StatChip label="Type" value={summary.day_type.replace(/_/g, ' ')} small={widget} />
            <StatChip label="Source" value={summary.source ?? 'auto'} valueColor={summary.source === 'manual' ? 'var(--wh-primary)' : undefined} small={widget} />
          </div>

          {/* Timeline */}
          <div style={{ marginBottom: widget ? 10 : 28 }}>
            <TimelineBar firstActive={summary.first_active} lastActive={summary.last_active} />
          </div>

          {/* Events list — hide in widget to save space */}
          {!widget && events.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--wh-text-secondary)', marginBottom: 10 }}>Events</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {events.map(ev => {
                  const time = ev.timestamp.includes('T')
                    ? ev.timestamp.split('T')[1]?.substring(0, 5) ?? ev.timestamp
                    : ev.timestamp
                  return (
                    <div key={ev.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: 'var(--wh-surface)',
                    }}>
                      <span style={{ fontSize: 14 }}>{EVENT_ICONS[ev.type] ?? '·'}</span>
                      <span style={{ fontSize: 12, color: 'var(--wh-text-secondary)', minWidth: 40 }}>{time}</span>
                      <span style={{ fontSize: 12, color: 'var(--wh-text)' }}>{EVENT_LABELS[ev.type] ?? ev.type}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Edit modal — full page only */}
          {!widget && editOpen && (
            <EditModal
              date={date}
              currentFirstActive={summary.first_active}
              currentLastActive={summary.last_active}
              onSave={() => {
                setEditOpen(false)
                fetchDay(date)
              }}
              onClose={() => setEditOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

function StatChip({ label, value, valueColor, small }: { label: string; value: string; valueColor?: string; small?: boolean }) {
  return (
    <div style={{ minWidth: small ? 60 : 80 }}>
      <div style={{ fontSize: small ? 9 : 11, color: 'var(--wh-text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: small ? 12 : 14, fontWeight: 600, color: valueColor ?? 'var(--wh-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
