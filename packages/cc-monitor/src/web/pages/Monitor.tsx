import { useState, useEffect, useRef } from 'react'

interface Session {
  sessionId: string
  project: string
  status: string
  lastActivity: string
  startedAt: string
  pid?: number
  tty?: string
  eventCount: number
  lastToolName: string | null
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface MonitorProps {
  connectionStatus: ConnectionStatus
  hooksInstalled: boolean | null
  isWidget?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  working: '#22c55e',
  processing: '#22c55e',
  started: '#3b82f6',
  idle: '#3b82f6',
  waiting_for_input: '#eab308',
  ended: '#6b7280',
  terminated: '#6b7280',
  detected: '#6b7280',
}

const STATUS_LABELS: Record<string, string> = {
  started: 'Started',
  processing: 'Processing',
  working: 'Working',
  idle: 'Idle',
  waiting_for_input: 'Waiting for Input',
  ended: 'Ended',
  terminated: 'Terminated',
  detected: 'Detected (no hooks)',
}

const ACTIVE_STATUSES = new Set(['working', 'processing'])

function formatDuration(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function formatTimeAgo(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

function getProjectName(project: string): string {
  const parts = project.split('/')
  return parts[parts.length - 1] || project
}

const WIN_SWITCHER_URL = 'http://localhost:3003'

async function focusSessionWindow(pid: number, cwd?: string) {
  try {
    await fetch(`${WIN_SWITCHER_URL}/api/windows/focus-by-pid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid, cwd }),
    })
  } catch { /* win-switcher not running */ }
}

export function Monitor({ connectionStatus, hooksInstalled, isWidget }: MonitorProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const orderRef = useRef<Map<string, number>>(new Map())

  function mergeSessions(incoming: Session[]): Session[] {
    const order = orderRef.current
    incoming.forEach(s => {
      if (!order.has(s.sessionId)) order.set(s.sessionId, order.size)
    })
    const incomingIds = new Set(incoming.map(s => s.sessionId))
    for (const id of order.keys()) {
      if (!incomingIds.has(id)) order.delete(id)
    }
    return [...incoming].sort((a, b) => (order.get(a.sessionId) ?? 0) - (order.get(b.sessionId) ?? 0))
  }

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions')
      const json = await res.json()
      if (json.ok) setSessions(prev => mergeSessions(json.data))
    } catch {
      // connection errors are handled at App level
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 5_000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div style={{ color: '#94a3b8', padding: isWidget ? 8 : 0 }}>Loading...</div>
  }

  if (isWidget) {
    return <WidgetView sessions={sessions} connectionStatus={connectionStatus} />
  }

  // Disconnected state
  if (connectionStatus === 'disconnected') {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#94a3b8',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', color: '#ef4444' }}>!</div>
        <h2 style={{ color: '#ef4444', marginBottom: '8px' }}>Cannot connect to monitor server</h2>
        <p style={{ maxWidth: '460px', margin: '0 auto', lineHeight: 1.6 }}>
          The cc-monitor backend is not reachable. Start it with:
        </p>
        <pre style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'inline-block',
          marginTop: '16px',
          fontSize: '13px',
          color: '#e2e8f0',
        }}>pnpm dev:cc-monitor</pre>
      </div>
    )
  }

  // Empty state
  if (sessions.length === 0) {
    // Hooks not installed
    if (hooksInstalled === false) {
      return (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#94a3b8',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>{'> _'}</div>
          <h2 style={{ color: '#eab308', marginBottom: '8px' }}>Hooks not installed</h2>
          <p style={{ maxWidth: '460px', margin: '0 auto', lineHeight: 1.6, marginBottom: '16px' }}>
            Install Claude Code hooks so sessions are reported to the monitor automatically.
            Run the following command:
          </p>
          <pre style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'inline-block',
            fontSize: '13px',
            color: '#e2e8f0',
          }}>node packages/cc-monitor/scripts/hooks-install.js</pre>
          <p style={{ maxWidth: '460px', margin: '16px auto 0', lineHeight: 1.6, fontSize: '13px' }}>
            After installing, start a new Claude Code session and it will appear here.
            Process detection also runs every 15s.
          </p>
        </div>
      )
    }

    // Hooks installed but no sessions
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#94a3b8',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>{'> _'}</div>
        <h2 style={{ color: '#e2e8f0', marginBottom: '8px' }}>Waiting for sessions</h2>
        <p style={{ maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
          Hooks are installed. Start a Claude Code session in any terminal
          and it will appear here automatically. Process detection runs every 15s.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: '16px',
    }}>
      {sessions.map((session) => {
        const color = STATUS_COLORS[session.status] || '#6b7280'
        const label = STATUS_LABELS[session.status] || session.status
        const isActive = ACTIVE_STATUSES.has(session.status)

        return (
          <div
            key={session.sessionId}
            onClick={() => session.pid && focusSessionWindow(session.pid, session.project)}
            style={{
              background: '#1e293b',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #334155',
              borderLeft: `3px solid ${color}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              cursor: session.pid ? 'pointer' : 'default',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                {getProjectName(session.project)}
              </h3>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 500,
                color,
                background: `${color}15`,
                padding: '3px 8px',
                borderRadius: '4px',
              }}>
                <span
                  className={isActive ? 'pulse' : undefined}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: color,
                    display: 'inline-block',
                  }}
                />
                {label}
              </span>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {session.project}
            </div>

            {session.lastToolName && (
              <div style={{
                fontSize: '12px',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{ color: '#64748b' }}>Tool:</span>
                <span style={{
                  background: '#334155',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                }}>{session.lastToolName}</span>
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#94a3b8',
              marginTop: 'auto',
            }}>
              <span>Uptime: {formatDuration(session.startedAt)}</span>
              <span>Active: {formatTimeAgo(session.lastActivity)}</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#475569',
            }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                {session.pid && <span>PID: {session.pid}</span>}
                {session.tty && <span>TTY: {session.tty}</span>}
              </div>
              {session.eventCount > 0 && (
                <span>{session.eventCount} event{session.eventCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Widget View ────────────────────────────────────────────

function WidgetView({ sessions, connectionStatus }: {
  sessions: Session[]
  connectionStatus: ConnectionStatus
}) {
  const activeSessions = sessions.filter(s => !['ended', 'terminated'].includes(s.status))

  function handleSessionClick(session: Session) {
    if (!session.pid) return
    focusSessionWindow(session.pid, session.project)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Status bar */}
      <div style={{
        padding: '6px 10px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          {activeSessions.length} active
        </span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: connectionStatus === 'connected' ? '#22c55e' : connectionStatus === 'disconnected' ? '#ef4444' : '#eab308',
          display: 'inline-block',
        }} />
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sessions.length === 0 ? (
          <p style={{ fontSize: 12, color: '#475569', padding: '12px 10px' }}>No active sessions</p>
        ) : (
          sessions.map((session) => {
            const color = STATUS_COLORS[session.status] || '#6b7280'
            const isActive = ACTIVE_STATUSES.has(session.status)
            const isEnded = ['ended', 'terminated'].includes(session.status)
            const clickable = !!session.pid

            return (
              <div
                key={session.sessionId}
                onClick={() => handleSessionClick(session)}
                style={{
                  padding: '8px 10px',
                  borderBottom: '1px solid #1e293b',
                  cursor: clickable ? 'pointer' : 'default',
                  opacity: isEnded ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLDivElement).style.background = '#1e293b' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span
                  className={isActive ? 'pulse' : undefined}
                  style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: color, flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 12, fontWeight: 600, color: '#e2e8f0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                  }}>
                    {getProjectName(session.project)}
                  </p>
                  <p style={{ fontSize: 10, color: '#475569', lineHeight: 1.3 }}>
                    {session.lastToolName ? session.lastToolName : STATUS_LABELS[session.status] || session.status}
                    {' · '}{formatDuration(session.startedAt)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
