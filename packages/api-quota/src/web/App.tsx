import React, { useState, useEffect, useCallback, useRef } from 'react'

interface QuotaData {
  usedCount: number
  remainingCount: number
  limit: number
  expireTime?: string
  periodResetTime?: string
}

interface HistoryItem {
  date: string
  used: number
  total: number
}

type WidgetStyle = 'bar' | 'ring' | 'minimal'

const REFRESH_INTERVAL = 60_000
const STYLE_KEY = 'api-quota-widget-style'

// Earthy, low-saturation color scale matching work-hours warm-brown palette
function usageColor(pct: number): string {
  if (pct <= 30) return '#8a9a6c'   // sage green — plenty left
  if (pct <= 50) return '#a0a060'   // olive
  if (pct <= 65) return '#bfa850'   // warm gold
  if (pct <= 75) return '#d4a040'   // accent gold (matches --accent)
  if (pct <= 85) return '#c8884a'   // clay
  if (pct <= 93) return '#b86e45'   // terracotta
  return '#c0614a'                  // muted red (matches --wh-overtime)
}

function loadStyle(): WidgetStyle {
  const v = localStorage.getItem(STYLE_KEY)
  if (v === 'bar' || v === 'ring' || v === 'minimal') return v
  return 'bar'
}

export function App() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [cookie, setCookie] = useState('')
  const [quota, setQuota] = useState<QuotaData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [widgetStyle, setWidgetStyle] = useState<WidgetStyle>(loadStyle)
  const [menuOpen, setMenuOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])

  const [editing, setEditing] = useState(false)
  const params = new URLSearchParams(window.location.search)
  const isWidget = params.get('mode') === 'widget' || params.has('widget')

  const changeStyle = (s: WidgetStyle) => {
    setWidgetStyle(s)
    localStorage.setItem(STYLE_KEY, s)
    setMenuOpen(false)
  }

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/session/status')
      const data = await res.json()
      setConfigured(data.configured)
    } catch {
      setConfigured(false)
    }
  }, [])

  const fetchQuota = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/quota')
      if (!res.ok) {
        if (res.status === 401) {
          setConfigured(false)
          return false
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      // Navigate: json.data.data.codex.subscriptions
      const codex = json.data?.data?.codex
      const sub = codex?.subscriptions
      if (!sub) throw new Error('No subscription data found')
      const q: QuotaData = {
        usedCount: sub.usedCount ?? 0,
        remainingCount: sub.remainingCount ?? 0,
        limit: sub.limit ?? 0,
        expireTime: sub.expireTime,
        periodResetTime: sub.periodResetTime,
      }
      setQuota(q)
      setError(null)
      // Fetch history after quota updates (snapshot is recorded server-side)
      try {
        const hRes = await fetch('/api/quota/history?days=7')
        if (hRes.ok) {
          const hJson = await hRes.json()
          setHistory(hJson.history ?? [])
        }
      } catch { /* non-critical */ }
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    const ok = await fetchQuota()
    setRefreshing(false)
    setToast({ msg: ok ? '已刷新' : '刷新失败', ok })
    setTimeout(() => setToast(null), 1500)
  }, [fetchQuota])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (configured) {
      fetchQuota()
      const timer = setInterval(fetchQuota, REFRESH_INTERVAL)
      return () => clearInterval(timer)
    }
  }, [configured, fetchQuota])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookie.trim() }),
      })
      if (res.ok) {
        setConfigured(true)
        setEditing(false)
        setCookie('')
      }
    } finally {
      setSaving(false)
    }
  }

  // Loading state
  if (configured === null) {
    return <div style={styles.container}><span style={styles.muted}>Loading...</span></div>
  }

  // Cookie editor (shared between widget and full page)
  const cookieEditor = (compact: boolean) => (
    <div style={compact ? styles.widgetContainer : styles.container}>
      <div style={compact ? { width: '100%' } : styles.card}>
        {!compact && <h2 style={styles.title}>配置 Cookie</h2>}
        {!compact && (
          <p style={{ ...styles.muted, fontSize: 13 }}>
            粘贴 chat.nuoda.vip 的 cookie
          </p>
        )}
        {compact ? (
          <input
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder="share-session=abc123..."
            style={{
              width: '100%', padding: '4px 8px', fontSize: 11, fontFamily: 'monospace',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4, color: 'var(--text-primary, #e5e5e5)', outline: 'none',
              boxSizing: 'border-box' as const,
            }}
          />
        ) : (
          <textarea
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder="share-session=abc123..."
            rows={3}
            style={{ ...styles.textarea, marginTop: 12, fontSize: 13 }}
          />
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: compact ? 6 : 8 }}>
          <button
            onClick={handleSave}
            disabled={!cookie.trim() || saving}
            style={{
              ...styles.button,
              marginTop: 0,
              padding: compact ? '3px 10px' : '8px 20px',
              fontSize: compact ? 11 : 13,
              opacity: !cookie.trim() || saving ? 0.5 : 1,
            }}
          >
            {saving ? '...' : '保存'}
          </button>
          {editing && (
            <button
              onClick={() => { setEditing(false); setCookie('') }}
              style={{ ...styles.linkButton, fontSize: compact ? 11 : 12 }}
            >
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  )

  // Cookie setup or editing
  if (!configured || editing) {
    return cookieEditor(isWidget)
  }

  // Widget mode — compact display
  if (isWidget) {
    if (error) {
      return (
        <div style={styles.widgetContainer}>
          <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>
        </div>
      )
    }
    if (!quota) {
      return (
        <div style={styles.widgetContainer}>
          <span style={styles.muted}>Loading...</span>
        </div>
      )
    }
    const pct = quota.limit > 0 ? (quota.usedCount / quota.limit) * 100 : 0
    const color = usageColor(pct)

    const gearMenu = (
      <SettingsMenu
        open={menuOpen}
        onToggle={() => setMenuOpen(!menuOpen)}
        widgetStyle={widgetStyle}
        onChangeStyle={changeStyle}
      />
    )

    const toolbar = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <RefreshButton onClick={handleRefresh} spinning={refreshing} />
        <CookieButton onClick={() => setEditing(true)} />
        {gearMenu}
      </div>
    )

    const Widget = widgetStyle === 'ring' ? WidgetRing
      : widgetStyle === 'minimal' ? WidgetMinimal
      : WidgetBar

    return (
      <div style={styles.widgetContainer}>
        <Widget quota={quota} pct={pct} color={color} toolbar={toolbar} history={history} />
        {toast && (
          <div style={{
            position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: toast.ok ? '#10b981' : '#ef4444',
            pointerEvents: 'none',
          }}>
            {toast.msg}
          </div>
        )}
      </div>
    )
  }

  // Full page view
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>API Quota</h2>
        {error ? (
          <p style={{ color: '#ef4444' }}>{error}</p>
        ) : !quota ? (
          <p style={styles.muted}>Loading...</p>
        ) : (
          <QuotaDisplay quota={quota} onReconfigure={() => setEditing(true)} />
        )}
      </div>
    </div>
  )
}

// --- Refresh button ---
const spinKeyframes = `@keyframes api-quota-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`

function RefreshButton({ onClick, spinning }: { onClick: () => void; spinning: boolean }) {
  return (
    <>
      <style>{spinKeyframes}</style>
      <button
        onClick={onClick}
        title="刷新"
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          color: 'var(--text-muted, #737373)', opacity: 0.6,
          animation: spinning ? 'api-quota-spin 0.8s linear infinite' : undefined,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.534 7h3.932a.25.25 0 01.192.41l-1.966 2.36a.25.25 0 01-.384 0l-1.966-2.36A.25.25 0 0111.534 7zm-7.068 2H.534a.25.25 0 00-.192.41l1.966 2.36a.25.25 0 00.384 0l1.966-2.36A.25.25 0 004.466 9z"/>
          <path fillRule="evenodd" d="M8 3a5 5 0 11-4.546 2.914.5.5 0 00-.908-.418A6 6 0 108 2v1z"/>
        </svg>
      </button>
    </>
  )
}

// --- Gear icon SVG (shared) ---
const GearIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/>
    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.902 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291a1.873 1.873 0 00-1.116-2.693l-.318-.094c-.835-.246-.835-1.428 0-1.674l.319-.094a1.873 1.873 0 001.115-2.692l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.116l.094-.318z"/>
  </svg>
)

// --- Settings menu (gear + dropdown) ---
function SettingsMenu({ open, onToggle, widgetStyle, onChangeStyle }: {
  open: boolean
  onToggle: () => void
  widgetStyle: WidgetStyle
  onChangeStyle: (s: WidgetStyle) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onToggle()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onToggle])

  const styleOptions: { value: WidgetStyle; label: string }[] = [
    { value: 'bar', label: '进度条' },
    { value: 'ring', label: '环形图' },
    { value: 'minimal', label: '极简' },
  ]

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        title="设置"
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          color: 'var(--text-muted, #737373)', opacity: 0.6,
        }}
      >
        <GearIcon />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4,
          background: 'var(--bg, #1a1a1a)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '4px 0', minWidth: 120, zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {styleOptions.map(opt => (
            <button
              key={opt.value}
              onClick={(e) => { e.stopPropagation(); onChangeStyle(opt.value) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: widgetStyle === opt.value ? 'rgba(255,255,255,0.08)' : 'none',
                border: 'none', padding: '6px 12px', cursor: 'pointer',
                color: 'var(--text-primary, #e5e5e5)', fontSize: 12,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Cookie button (key icon) ---
function CookieButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="配置 Cookie"
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
        color: 'var(--text-muted, #737373)', opacity: 0.6,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M12.5 0a3.5 3.5 0 00-3.288 4.695L0 13.908V16h2.092l.5-.5V14h1.5v-1.5h1.5v-1.5h1.5l1.197-1.197A3.5 3.5 0 1012.5 0zm1.5 5a1 1 0 11-2 0 1 1 0 012 0z"/>
      </svg>
    </button>
  )
}

// --- Widget: Bar (default, for narrow windows) ---
interface WidgetProps {
  quota: QuotaData
  pct: number
  color: string
  toolbar: React.ReactNode
  history?: HistoryItem[]
}

function WidgetBar({ quota, pct, color, toolbar, history }: WidgetProps) {
  const remaining = quota.remainingCount
  const limit = quota.limit
  const used = quota.usedCount
  const usedPct = limit > 0 ? Math.round((used / limit) * 100) : 0
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top row: remaining + donut + toolbar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
              {remaining}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>left</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim, var(--text-muted))', marginTop: 4, letterSpacing: '0.02em' }}>
            {used} used · {limit} total
          </div>
        </div>
        <MiniDonut pct={pct} color={color} />
        {toolbar}
      </div>

      {/* Mini bar chart — 7 day history */}
      {history && history.length > 0 && (
        <MiniBarChart history={history} />
      )}

      {/* Progress bar */}
      <div style={{ marginTop: 'auto', paddingTop: 10 }}>
        <div style={{
          width: '100%', height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            transition: 'width 0.6s ease',
            boxShadow: `0 0 8px ${color}40`,
          }} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 4,
          fontSize: 9, color: 'var(--text-dim, var(--text-muted))', letterSpacing: '0.02em',
        }}>
          <span>{usedPct}% used</span>
          {quota.periodResetTime && (
            <span>resets {new Date(quota.periodResetTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Mini donut for bar mode ---
function MiniDonut({ pct, color }: { pct: number; color: string }) {
  const size = 40
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const remainPct = Math.round(100 - pct)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, alignSelf: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, color, lineHeight: 1,
      }}>
        {remainPct}%
      </div>
    </div>
  )
}

// --- Mini bar chart for 7-day history ---
function MiniBarChart({ history }: { history: HistoryItem[] }) {
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const maxUsed = Math.max(...history.map(h => h.used), 1)
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3,
      padding: '8px 0 0', minHeight: 0,
    }}>
      {history.map((item, i) => {
        const isToday = item.date === todayStr
        const barH = item.used > 0 ? Math.max((item.used / maxUsed) * 100, 4) : 0
        const dow = new Date(item.date + 'T00:00:00').getDay()
        return (
          <div key={item.date} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', height: '100%', justifyContent: 'flex-end',
            minWidth: 0,
          }}>
            {item.used > 0 && (
              <span style={{
                fontSize: 8, color: isToday ? 'var(--accent, #d4a040)' : 'var(--text-dim, var(--text-muted))',
                marginBottom: 2, fontVariantNumeric: 'tabular-nums',
              }}>
                {item.used}
              </span>
            )}
            <div style={{
              width: '100%', maxWidth: 18, borderRadius: 2,
              height: `${barH}%`,
              minHeight: item.used > 0 ? 2 : 0,
              background: isToday
                ? 'var(--accent, #d4a040)'
                : 'rgba(212, 160, 64, 0.35)',
              transition: 'height 0.4s ease',
            }} />
            <span style={{
              fontSize: 8, marginTop: 3,
              color: isToday ? 'var(--accent, #d4a040)' : 'var(--text-dim, var(--text-muted))',
              fontWeight: isToday ? 600 : 400,
            }}>
              {dayLabels[dow]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// --- Widget: Ring (for square / tall windows) ---
function WidgetRing({ quota, pct, color, toolbar }: WidgetProps) {
  const size = 80
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        {toolbar}
      </div>
      <div style={{ position: 'relative', width: size, height: size, margin: '4px 0' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>
            {quota.remainingCount}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #e5e5e5)' }}>{quota.usedCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>已用</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #e5e5e5)' }}>{quota.limit}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>限额</div>
        </div>
      </div>
    </>
  )
}

// --- Widget: Minimal (single line) ---
function WidgetMinimal({ quota, color, toolbar }: WidgetProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <span>
        <span style={{ fontSize: 16, fontWeight: 700, color }}>{quota.remainingCount}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}> / {quota.limit}</span>
      </span>
      {toolbar}
    </div>
  )
}

function QuotaDisplay({ quota, onReconfigure }: { quota: QuotaData; onReconfigure: () => void }) {
  const pct = quota.limit > 0 ? (quota.usedCount / quota.limit) * 100 : 0
  const color = usageColor(pct)

  // Ring chart dimensions
  const size = 140
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      {/* Ring chart */}
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{ marginTop: -100, marginBottom: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color }}>{quota.remainingCount}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>剩余</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 32 }}>
        <Stat label="已用" value={quota.usedCount} />
        <Stat label="限额" value={quota.limit} />
      </div>

      {quota.expireTime && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          到期: {new Date(quota.expireTime).toLocaleDateString('zh-CN')}
        </p>
      )}

      <button onClick={onReconfigure} style={styles.linkButton}>
        重新配置 Cookie
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg, #1a1816)',
    color: 'var(--text-primary, #e5e5e5)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  widgetContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '10px 12px',
    background: 'transparent',
    color: 'var(--text-primary, #e5e5e5)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: 320,
    padding: '32px 28px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    margin: '0 0 12px',
    color: 'var(--text-primary, #e5e5e5)',
  },
  muted: {
    fontSize: 13,
    color: 'var(--text-muted, #737373)',
  },
  textarea: {
    width: '100%',
    marginTop: 12,
    padding: 10,
    fontSize: 13,
    fontFamily: 'monospace',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: 'var(--text-primary, #e5e5e5)',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  button: {
    marginTop: 12,
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    background: '#10b981',
    color: '#fff',
    cursor: 'pointer',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #737373)',
    fontSize: 12,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  },
  barTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.06)',
    marginTop: 6,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.6s ease',
  },
}
