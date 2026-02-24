import { useState, useEffect } from 'react'
import { Monitor } from './pages/Monitor'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export function App() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [hooksInstalled, setHooksInstalled] = useState<boolean | null>(null)

  useEffect(() => {
    let failCount = 0

    async function checkStatus() {
      try {
        const res = await fetch('/api/hooks/status')
        const json = await res.json()
        setConnectionStatus('connected')
        failCount = 0
        if (json.ok) {
          setHooksInstalled(json.data.installed)
        }
      } catch {
        failCount++
        if (failCount >= 2) {
          setConnectionStatus('disconnected')
        }
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 10_000)
    return () => clearInterval(interval)
  }, [])

  const statusColor =
    connectionStatus === 'connected' ? '#22c55e' :
    connectionStatus === 'disconnected' ? '#ef4444' : '#eab308'
  const statusLabel =
    connectionStatus === 'connected' ? 'Connected' :
    connectionStatus === 'disconnected' ? 'Disconnected' : 'Connecting...'

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#f8fafc' }}>
            Claude Code Monitor
          </h1>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Real-time Session Tracker</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {hooksInstalled !== null && (
            <span style={{
              fontSize: '12px',
              color: hooksInstalled ? '#94a3b8' : '#eab308',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              {hooksInstalled ? 'Hooks installed' : 'Hooks not installed'}
            </span>
          )}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: statusColor,
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusColor,
              display: 'inline-block',
            }} />
            {statusLabel}
          </span>
        </div>
      </header>
      <main style={{ padding: '24px' }}>
        <Monitor connectionStatus={connectionStatus} hooksInstalled={hooksInstalled} />
      </main>
    </div>
  )
}
