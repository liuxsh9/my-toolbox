import React, { useEffect, useRef, useState } from 'react'

interface Notification {
  id: string
  title: string
  body: string
  source: string
  url?: string
  createdAt: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}天前`
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function sourceIcon(source: string): string {
  if (source === 'cc-monitor') return '◆'
  if (source === 'bookmarks') return '◈'
  if (source === 'win-switcher') return '◉'
  return '◎'
}

export default function App() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [, setTick] = useState(0)
  const sseRef = useRef<EventSource | null>(null)

  // Refresh relative times every minute
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  // Load initial + connect SSE
  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(res => { if (res.ok) setNotifications(res.data) })
      .catch(() => {})

    const es = new EventSource('/api/notifications/stream')
    sseRef.current = es

    es.addEventListener('notification', (e) => {
      const n: Notification = JSON.parse(e.data)
      setNotifications(prev => [n, ...prev])
    })
    es.addEventListener('dismissed', (e) => {
      const { id } = JSON.parse(e.data)
      setNotifications(prev => prev.filter(n => n.id !== id))
    })
    es.addEventListener('cleared', () => {
      setNotifications([])
    })

    return () => es.close()
  }, [])

  function dismiss(id: string) {
    fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {})
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  function clearAll() {
    fetch('/api/notifications', { method: 'DELETE' }).catch(() => {})
    setNotifications([])
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 32,
        padding: '0 10px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          {notifications.length > 0 ? `${notifications.length} 条通知` : ''}
        </span>
        {notifications.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 10,
            padding: 24,
          }}>
            <span style={{ fontSize: 24, opacity: 0.3 }}>◎</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' as const, lineHeight: 1.5 }}>暂无通知</span>
          </div>
        ) : (
          notifications.map((n, i) => (
            <button
              key={n.id}
              onClick={() => dismiss(n.id)}
              style={{
                display: 'flex',
                alignItems: 'start',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                textAlign: 'left' as const,
                transition: 'background 0.1s',
                color: 'inherit',
                font: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2, #2a2720)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Icon */}
              <span style={{ color: 'var(--accent)', fontSize: 11, paddingTop: 1, flexShrink: 0 }}>
                {sourceIcon(n.source)}
              </span>

              {/* Content */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {n.title}
                </div>
                <div style={{
                  fontSize: 9,
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                  marginTop: 1,
                }}>
                  {n.body}
                </div>
              </div>

              {/* Time */}
              <span style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                {relativeTime(n.createdAt)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
