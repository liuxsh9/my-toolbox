import { useState, useEffect } from 'react'
import type { ToolInfo } from '@my-toolbox/shared'
import { Desktop } from './components/Desktop'

export function App() {
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    async function fetchTools() {
      try {
        const res = await fetch('/api/tools')
        const json = await res.json()
        if (json.ok) setTools(json.data)
      } catch { /* ignore */ }
    }
    fetchTools()
    const interval = setInterval(fetchTools, 10_000)
    return () => clearInterval(interval)
  }, [])

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const hh = time.getHours().toString().padStart(2, '0')
  const mm = time.getMinutes().toString().padStart(2, '0')
  const dateStr = time.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      color: 'var(--text-1)',
    }}>
      {/* Top bar */}
      <header style={{
        height: 44,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--border2)',
        flexShrink: 0,
      }}>
        {/* Left: wordmark */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flex: 1 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-2)',
            letterSpacing: '-0.01em',
          }}>
            Toolbox
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            local
          </span>
        </div>

        {/* Center: clock + date */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-2)',
            letterSpacing: '0.05em',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {hh}<span style={{ opacity: 0.3, margin: '0 1px' }}>:</span>{mm}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.04em', marginTop: 2 }}>
            {dateStr}
          </div>
        </div>

        <div style={{ flex: 1 }} />
      </header>

      <Desktop tools={tools} />
    </div>
  )
}
