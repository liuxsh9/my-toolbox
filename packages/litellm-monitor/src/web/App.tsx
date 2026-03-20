import { useState, useEffect } from 'react'

interface Metrics {
  total: number
  success: number
  failed: number
}

interface Data {
  allTime: Metrics
  today: Metrics
  last30m: Metrics
  rps: number
  ready: boolean
  lastUpdated: string
}

interface FunnelStatus {
  enabled: boolean
  url: string | null
  checkedAt: number
}

const BG = '#1a1816'
const SURFACE = '#221f17'
const BORDER = '#2a2720'
const TEXT1 = '#ede8de'
const TEXT2 = '#8c8680'
const GREEN = '#5cb87a'
const RED = '#c0614a'
const YELLOW = '#d4a843'
const CYAN = '#7eb8d4'

function MetricBlock({ label, data, accent }: { label: string; data: Metrics | null; accent?: string }) {
  const fmtNum = (n: number) => n.toLocaleString('en-US')
  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 6,
      padding: '5px 10px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 3,
      flex: 1,
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: TEXT2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </div>
      {data === null ? (
        <div style={{ fontSize: 11, color: TEXT2 }}>loading...</div>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <Stat label="总计" value={fmtNum(data.total)} color={accent ?? TEXT1} large />
          <Stat label="成功" value={fmtNum(data.success)} color={GREEN} />
          <Stat label="失败" value={fmtNum(data.failed)} color={data.failed > 0 ? RED : TEXT2} />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color, large }: { label: string; value: string; color: string; large?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: large ? 15 : 11, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ fontSize: 8, color: TEXT2, letterSpacing: '0.04em' }}>{label}</span>
    </div>
  )
}

function RpsGauge({ rps }: { rps: number | null }) {
  const display = rps === null ? '--' : rps < 0.01 ? '0' : rps < 1 ? rps.toFixed(2) : rps < 10 ? rps.toFixed(1) : Math.round(rps).toString()
  const color = rps === null ? TEXT2 : rps === 0 ? TEXT2 : rps < 1 ? CYAN : rps < 10 ? GREEN : YELLOW
  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 12px',
      minWidth: 80,
      gap: 2,
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: TEXT2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        RPS
      </div>
      <span style={{
        fontSize: 22,
        fontWeight: 800,
        color,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {display}
      </span>
      <span style={{ fontSize: 8, color: TEXT2 }}>req/s</span>
    </div>
  )
}

function FunnelToggle() {
  const [status, setStatus] = useState<FunnelStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/funnel')
      const data = await res.json()
      setStatus({ ...data, checkedAt: Date.now() })
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchStatus()
    const pollId = setInterval(fetchStatus, 5_000)
    const tickId = setInterval(() => setTick(t => t + 1), 1_000)
    return () => { clearInterval(pollId); clearInterval(tickId) }
  }, [])

  const toggle = async () => {
    if (!status || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !status.enabled }),
      })
      const data = await res.json()
      setStatus({ ...data, checkedAt: Date.now() })
    } finally {
      setLoading(false)
    }
  }

  const on = status?.enabled ?? false
  const accentColor = on ? GREEN : TEXT2
  const age = status ? Math.max(0, Math.floor((Date.now() - status.checkedAt) / 1000)) : (void tick, 0)
  const ageLabel = age === 0 ? '刚刚' : `${age}s 前`

  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${on ? GREEN + '55' : BORDER}`,
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px 8px',
      minWidth: 80,
      gap: 5,
      flex: 1,
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: TEXT2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        公网穿透
      </div>

      {/* Toggle switch */}
      <button
        onClick={toggle}
        disabled={loading || status === null}
        style={{
          width: 40,
          height: 20,
          borderRadius: 10,
          border: 'none',
          cursor: loading || status === null ? 'default' : 'pointer',
          background: on ? GREEN : '#333',
          position: 'relative',
          transition: 'background 0.2s',
          padding: 0,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <div style={{
          position: 'absolute',
          top: 3,
          left: on ? 22 : 3,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>

      {/* Status text */}
      <div style={{ fontSize: 9, fontWeight: 600, color: accentColor, letterSpacing: '0.04em' }}>
        {status === null ? '...' : loading ? '切换中' : on ? 'ON' : 'OFF'}
      </div>

      {/* URL */}
      {status?.url && (
        <div style={{
          fontSize: 7,
          color: CYAN,
          maxWidth: 80,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}>
          {status.url.replace('https://', '')}
        </div>
      )}

      {/* Last checked */}
      {status && !loading && (
        <div style={{ fontSize: 7, color: TEXT2 }}>{ageLabel}</div>
      )}
    </div>
  )
}

export function App() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/metrics')
        const json = await res.json()
        if (!cancelled) { setData(json.data); setError(false) }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    load()
    const id = setInterval(load, 3_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const updatedAt = data ? new Date(data.lastUpdated).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--'

  return (
    <div style={{
      height: '100%', background: BG, color: TEXT1,
      display: 'flex', flexDirection: 'column', padding: '8px 10px', gap: 6, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: TEXT1, letterSpacing: '-0.01em' }}>LiteLLM 请求统计</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {data && !data.ready && (
            <span style={{ fontSize: 9, color: YELLOW }}>初始化中...</span>
          )}
          {error && <span style={{ fontSize: 9, color: RED }}>连接失败</span>}
          <span style={{ fontSize: 9, color: TEXT2 }}>{updatedAt}</span>
        </div>
      </div>

      {/* Body: left metrics + right column */}
      <div style={{ display: 'flex', gap: 6, flex: 1, minHeight: 0 }}>
        {/* Left: metric blocks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <MetricBlock label="累计" data={data?.allTime ?? null} accent={TEXT1} />
          <MetricBlock label="今日" data={data?.today ?? null} accent='#d4a040' />
          <MetricBlock label="近 30 分钟" data={data?.last30m ?? null} accent={CYAN} />
        </div>
        {/* Right: RPS (1/3) + Funnel toggle (2/3) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 80 }}>
          <div style={{ flex: 1 }}>
            <RpsGauge rps={data ? data.rps : null} />
          </div>
          <div style={{ flex: 2, display: 'flex' }}>
            <FunnelToggle />
          </div>
        </div>
      </div>
    </div>
  )
}
