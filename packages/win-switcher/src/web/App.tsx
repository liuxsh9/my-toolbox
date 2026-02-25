import React, { useState, useEffect, useRef } from 'react'
import type { WindowInfo, PermissionStatus } from './api'
import { fetchWindows, focusWindow, focusByPid, thumbUrl } from './api'

// ─── Permission Banner ───────────────────────────────────────

function PermissionBanner({ permissions }: { permissions: PermissionStatus }) {
  const missing = []
  if (!permissions.screenRecording) missing.push('Screen Recording')
  if (!permissions.accessibility) missing.push('Accessibility')
  if (missing.length === 0) return null

  return (
    <div style={{
      margin: '20px 48px 0',
      padding: '10px 16px',
      border: '1px solid var(--warning-border)',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--warning-bg)',
      color: 'var(--warning-text)',
      fontSize: 13,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span>⚠ 缺少权限：{missing.join('、')}。</span>
      <a
        href="x-apple.systempreferences:com.apple.preference.security?Privacy"
        style={{ fontWeight: 600, textDecoration: 'underline', color: 'var(--warning-text)' }}
      >
        前往 System Settings 授权 →
      </a>
      <span style={{ color: '#a08030', fontSize: 12 }}>
        {!permissions.screenRecording && '（无截图权限时显示 app 图标）'}
        {!permissions.accessibility && ' （无辅助功能权限时只能激活 app）'}
      </span>
    </div>
  )
}

// ─── Window Card ───────────────────────────────────────────

function WindowCard({
  win,
  thumbTs,
  hasScreenRecording,
  onFocus,
}: {
  win: WindowInfo
  thumbTs: number
  hasScreenRecording: boolean
  onFocus: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const [focusing, setFocusing] = useState(false)

  async function handleClick() {
    setFocusing(true)
    await onFocus()
    setTimeout(() => setFocusing(false), 600)
  }

  const aspectRatio = win.width > 0 && win.height > 0 ? win.width / win.height : 16 / 9
  const thumbH = Math.round(220 / aspectRatio)

  return (
    <div
      onClick={handleClick}
      title={win.title || win.app}
      className="win-card"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        cursor: focusing ? 'default' : 'pointer',
        overflow: 'hidden',
        opacity: focusing ? 0.7 : 1,
        transition: 'opacity .15s, border-color .15s, box-shadow .15s',
      }}
    >
      {/* Thumbnail area */}
      <div style={{
        height: thumbH,
        minHeight: 90,
        maxHeight: 160,
        background: '#ede9e2',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {hasScreenRecording && !imgError ? (
          <img
            src={thumbUrl(win.id, thumbTs)}
            alt={win.title}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            letterSpacing: '-0.02em',
          }}>
            {win.app.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
          marginBottom: 3,
        }}>
          {win.title || '(untitled)'}
        </p>
        <p style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {win.app}
        </p>
      </div>
    </div>
  )
}

// ─── App ───────────────────────────────────────────────────

export default function App() {
  const isWidget = new URLSearchParams(window.location.search).get('mode') === 'widget'
  if (isWidget) document.body.classList.add('widget')
  const [windows, setWindows] = useState<WindowInfo[]>([])
  const [permissions, setPermissions] = useState<PermissionStatus>({ accessibility: false, screenRecording: false })
  const [loading, setLoading] = useState(true)
  const [thumbTs, setThumbTs] = useState(() => Date.now())
  const [activeApp, setActiveApp] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [highlightedWid, setHighlightedWid] = useState<number | null>(null)
  // Stable order: wid → insertion index
  const orderRef = useRef<Map<number, number>>(new Map())

  function mergeWindows(incoming: WindowInfo[]): WindowInfo[] {
    const order = orderRef.current
    // Assign order to new windows
    incoming.forEach(w => {
      if (!order.has(w.id)) order.set(w.id, order.size)
    })
    // Remove stale entries
    const incomingIds = new Set(incoming.map(w => w.id))
    for (const id of order.keys()) {
      if (!incomingIds.has(id)) order.delete(id)
    }
    return [...incoming].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  }

  async function load() {
    try {
      const data = await fetchWindows()
      setWindows(prev => mergeWindows(data.windows))
      setPermissions(data.permissions)
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }

  // Poll window list every 5s
  useEffect(() => {
    load()
    const interval = setInterval(load, 5_000)
    return () => clearInterval(interval)
  }, [])

  // Refresh thumbnails every 30s
  useEffect(() => {
    const interval = setInterval(() => setThumbTs(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  function handleRefresh() {
    load()
    setThumbTs(Date.now())
  }

  // postMessage listener for widget mode (FOCUS_WINDOW from portal)
  useEffect(() => {
    if (!isWidget) return
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'FOCUS_WINDOW' && typeof e.data.pid === 'number') {
        focusByPid(e.data.pid).then((result) => {
          if (result.ok && result.windowId) {
            setHighlightedWid(result.windowId)
            setTimeout(() => setHighlightedWid(null), 1200)
          }
        })
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isWidget])

  if (isWidget) {
    return (
      <WidgetView
        windows={windows}
        permissions={permissions}
        loading={loading}
        thumbTs={thumbTs}
        highlightedWid={highlightedWid}
        onRefresh={handleRefresh}
      />
    )
  }

  // Group windows by app
  const appNames = Array.from(new Set(windows.map((w) => w.app))).sort()
  const displayWindows = activeApp ? windows.filter((w) => w.app === activeApp) : windows

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        padding: '32px 48px 0',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Windows
          </h1>
          <p style={{ marginTop: 5, fontSize: 13, color: 'var(--text-muted)' }}>
            {windows.length} 个窗口 · {lastRefresh.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          title="刷新"
          style={{
            padding: '7px 14px',
            fontSize: 13,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
          }}
        >
          ↻ 刷新
        </button>
      </header>

      {/* Permission banner */}
      <PermissionBanner permissions={permissions} />

      {/* App filter tabs */}
      {appNames.length > 1 && (
        <nav style={{ padding: '18px 48px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterTab label="全部" active={activeApp === null} onClick={() => setActiveApp(null)} />
          {appNames.map((app) => (
            <FilterTab
              key={app}
              label={app}
              count={windows.filter((w) => w.app === app).length}
              active={activeApp === app}
              onClick={() => setActiveApp(activeApp === app ? null : app)}
            />
          ))}
        </nav>
      )}

      {/* Window grid — grouped by app */}
      <main style={{ flex: 1, padding: '24px 48px 48px' }}>
        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>加载中…</p>
        ) : windows.length === 0 ? (
          <EmptyState noPermissions={!permissions.screenRecording && !permissions.accessibility} />
        ) : activeApp ? (
          <WindowGrid
            windows={displayWindows}
            thumbTs={thumbTs}
            hasScreenRecording={permissions.screenRecording}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {appNames.map((app) => {
              const appWindows = windows.filter((w) => w.app === app)
              return (
                <div key={app}>
                  <p style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginBottom: 12,
                  }}>
                    {app}
                    <span style={{ marginLeft: 6, fontWeight: 400 }}>{appWindows.length}</span>
                  </p>
                  <WindowGrid
                    windows={appWindows}
                    thumbTs={thumbTs}
                    hasScreenRecording={permissions.screenRecording}
                  />
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function WindowGrid({ windows, thumbTs, hasScreenRecording }: {
  windows: WindowInfo[]
  thumbTs: number
  hasScreenRecording: boolean
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 14,
    }}>
      {windows.map((win) => (
        <WindowCard
          key={win.id}
          win={win}
          thumbTs={thumbTs}
          hasScreenRecording={hasScreenRecording}
          onFocus={() => focusWindow(win.id, win.pid, win.title)}
        />
      ))}
    </div>
  )
}

function FilterTab({ label, count, active, onClick }: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        border: '1px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        borderRadius: 20,
        background: active ? 'var(--accent-light)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        whiteSpace: 'nowrap',
        transition: 'all .1s',
      }}
    >
      {label}{count !== undefined && count > 1 ? ` ${count}` : ''}
    </button>
  )
}

function EmptyState({ noPermissions }: { noPermissions: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 280,
      gap: 14,
      color: 'var(--text-muted)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 36 }}>◻</div>
      {noPermissions ? (
        <>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>需要授权才能显示窗口</p>
          <p style={{ fontSize: 13 }}>请在顶部横幅中前往 System Settings 授权</p>
        </>
      ) : (
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>没有找到打开的窗口</p>
      )}
    </div>
  )
}

// ─── Widget View ────────────────────────────────────────────

function WidgetView({
  windows,
  permissions,
  loading,
  thumbTs,
  highlightedWid,
  onRefresh,
}: {
  windows: WindowInfo[]
  permissions: PermissionStatus
  loading: boolean
  thumbTs: number
  highlightedWid: number | null
  onRefresh: () => void
}) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Compact toolbar */}
      <div style={{
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {windows.length} 个窗口
        </span>
        <button
          onClick={onRefresh}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >↻</button>
      </div>

      {/* Compact window grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {loading ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>加载中…</p>
        ) : windows.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>无窗口</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 6,
          }}>
            {windows.map((win) => (
              <WidgetCard
                key={win.id}
                win={win}
                thumbTs={thumbTs}
                hasScreenRecording={permissions.screenRecording}
                highlighted={highlightedWid === win.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WidgetCard({
  win,
  thumbTs,
  hasScreenRecording,
  highlighted,
}: {
  win: WindowInfo
  thumbTs: number
  hasScreenRecording: boolean
  highlighted: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const [focusing, setFocusing] = useState(false)

  async function handleClick() {
    setFocusing(true)
    await focusWindow(win.id, win.pid, win.title)
    setTimeout(() => setFocusing(false), 600)
  }

  return (
    <div
      onClick={handleClick}
      title={`${win.app}: ${win.title || '(untitled)'}`}
      style={{
        border: `1px solid ${highlighted ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6,
        background: highlighted ? 'var(--accent-light)' : 'var(--surface)',
        cursor: focusing ? 'default' : 'pointer',
        opacity: focusing ? 0.7 : 1,
        overflow: 'hidden',
        transition: 'opacity .15s, border-color .15s, background .15s',
      }}
    >
      {/* Thumbnail */}
      <div style={{
        height: 60,
        background: '#ede9e2',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {hasScreenRecording && !imgError ? (
          <img
            src={thumbUrl(win.id, thumbTs)}
            alt={win.title}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>
            {win.app.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {/* Label */}
      <div style={{ padding: '4px 6px 5px' }}>
        <p style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}>
          {win.title || win.app}
        </p>
        <p style={{
          fontSize: 9,
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {win.app}
        </p>
      </div>
    </div>
  )
}
