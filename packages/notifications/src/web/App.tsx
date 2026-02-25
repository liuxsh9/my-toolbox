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
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
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
      '--bg': '#0f0f0f',
      '--surface': '#1a1a1a',
      '--border': '#2a2a2a',
      '--text': '#e8e8e8',
      '--muted': '#666',
      '--accent': '#c8a96e',
      '--dismiss-hover': '#222',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      background: 'var(--bg)',
      color: 'var(--text)',
      minHeight: '100vh',
      padding: '0',
    } as React.CSSProperties}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '10px 16px 8px',
        borderBottom: '1px solid var(--border)',
      }}>
        {notifications.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: '10px',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '4px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            Clear all
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 45px)' }}>
        {notifications.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            gap: '8px',
          }}>
            <span style={{ fontSize: '11px', opacity: 0.2 }}>◎</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>No notifications</span>
          </div>
        ) : (
          notifications.map((n, i) => (
            <div
              key={n.id}
              onClick={() => dismiss(n.id)}
              style={{
                padding: '12px 16px',
                borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.1s',
                display: 'grid',
                gridTemplateColumns: '20px 1fr auto',
                gap: '8px',
                alignItems: 'start',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--dismiss-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Icon */}
              <span style={{ color: 'var(--accent)', fontSize: '12px', paddingTop: '1px' }}>
                {sourceIcon(n.source)}
              </span>

              {/* Content */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', color: 'var(--text)' }}>
                  {n.title}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {n.body}
                </div>
              </div>

              {/* Time */}
              <span style={{ fontSize: '9px', color: 'var(--muted)', whiteSpace: 'nowrap', paddingTop: '2px' }}>
                {relativeTime(n.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
