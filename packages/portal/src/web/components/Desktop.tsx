import React, { useState, useEffect, useRef, useCallback } from 'react'
import GridLayout from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { ToolInfo } from '@my-toolbox/shared'
import { WidgetWindow } from './WidgetWindow'

const STORAGE_KEY = 'portal-desktop-layout'
const COLS = 12
const ROW_HEIGHT = 60

interface WidgetState {
  minimized: boolean
  maximized: boolean
}

interface SavedLayout {
  layouts: Layout[]
  widgetStates: Record<string, WidgetState>
}

function getDefaultLayout(tools: ToolInfo[]): Layout[] {
  const defaults: Record<string, { x: number; y: number; w: number; h: number }> = {
    'win-switcher': { x: 0, y: 0, w: 5, h: 8 },
    'cc-monitor':   { x: 5, y: 0, w: 7, h: 5 },
    'bookmarks':    { x: 5, y: 5, w: 7, h: 6 },
    'notes':        { x: 0, y: 8, w: 4, h: 6 },
  }

  return tools
    .filter(t => defaults[t.name])
    .map(t => {
      const d = defaults[t.name]
      const wc = t.widget
      return {
        i: t.name,
        x: d.x, y: d.y,
        w: d.w, h: d.h,
        minW: wc?.minW ?? 2,
        minH: wc?.minH ?? 3,
      }
    })
}

function loadSaved(tools: ToolInfo[]): SavedLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedLayout
    const toolNames = new Set(tools.map(t => t.name))
    // Filter stale entries
    saved.layouts = saved.layouts.filter(l => toolNames.has(l.i))
    return saved
  } catch {
    return null
  }
}

function saveToDisk(layouts: Layout[], widgetStates: Record<string, WidgetState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ layouts, widgetStates }))
  } catch { /* ignore */ }
}

export function Desktop({ tools }: { tools: ToolInfo[] }) {
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [widgetStates, setWidgetStates] = useState<Record<string, WidgetState>>({})
  const [showPicker, setShowPicker] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRefs = useRef<Map<string, React.RefObject<HTMLIFrameElement>>>(new Map())
  const maximizedWidget = Object.entries(widgetStates).find(([, s]) => s.maximized)?.[0] ?? null

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width)
    })
    ro.observe(containerRef.current)
    setContainerWidth(containerRef.current.offsetWidth)
    return () => ro.disconnect()
  }, [])

  // Load layout on mount
  useEffect(() => {
    if (tools.length === 0) return
    const saved = loadSaved(tools)
    if (saved && saved.layouts.length > 0) {
      setLayouts(saved.layouts)
      setWidgetStates(saved.widgetStates ?? {})
    } else {
      setLayouts(getDefaultLayout(tools))
    }
  }, [tools.length > 0])

  // Ensure iframe refs exist for all widgets
  useEffect(() => {
    for (const l of layouts) {
      if (!iframeRefs.current.has(l.i)) {
        iframeRefs.current.set(l.i, React.createRef<HTMLIFrameElement>())
      }
    }
  }, [layouts])

  // postMessage bus
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'FOCUS_WINDOW') {
        const winSwitcherRef = iframeRefs.current.get('win-switcher')
        winSwitcherRef?.current?.contentWindow?.postMessage(e.data, '*')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  function handleLayoutChange(newLayout: Layout[]) {
    setLayouts(newLayout)
    saveToDisk(newLayout, widgetStates)
  }

  function updateWidgetState(name: string, patch: Partial<WidgetState>) {
    setWidgetStates(prev => {
      const next = { ...prev, [name]: { minimized: false, maximized: false, ...prev[name], ...patch } }
      saveToDisk(layouts, next)
      return next
    })
  }

  function removeWidget(name: string) {
    const next = layouts.filter(l => l.i !== name)
    setLayouts(next)
    setWidgetStates(prev => {
      const { [name]: _, ...rest } = prev
      saveToDisk(next, rest)
      return rest
    })
    iframeRefs.current.delete(name)
  }

  function addWidget(tool: ToolInfo) {
    const wc = tool.widget
    const w = wc?.defaultW ?? 4
    const h = wc?.defaultH ?? 6
    // Find a free y position below existing widgets
    const maxY = layouts.reduce((m, l) => Math.max(m, l.y + l.h), 0)
    const newLayout: Layout = {
      i: tool.name, x: 0, y: maxY, w, h,
      minW: wc?.minW ?? 3, minH: wc?.minH ?? 4,
    }
    if (!iframeRefs.current.has(tool.name)) {
      iframeRefs.current.set(tool.name, React.createRef<HTMLIFrameElement>())
    }
    const next = [...layouts, newLayout]
    setLayouts(next)
    saveToDisk(next, widgetStates)
    setShowPicker(false)
  }

  const activeToolNames = new Set(layouts.map(l => l.i))
  const availableToAdd = tools.filter(t => !activeToolNames.has(t.name))
  const toolMap = new Map(tools.map(t => [t.name, t]))

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden', minWidth: 0 }}>
      {/* Maximized overlay */}
      {maximizedWidget && (() => {
        const tool = toolMap.get(maximizedWidget)
        if (!tool) return null
        const ws = widgetStates[maximizedWidget] ?? { minimized: false, maximized: true }
        const ref = iframeRefs.current.get(maximizedWidget) ?? React.createRef()
        return (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 100,
            background: 'var(--bg)',
          }}>
            <WidgetWindow
              tool={tool}
              minimized={false}
              maximized={true}
              onMinimize={() => updateWidgetState(maximizedWidget, { minimized: true, maximized: false })}
              onMaximize={() => updateWidgetState(maximizedWidget, { maximized: false })}
              onClose={() => removeWidget(maximizedWidget)}
              iframeRef={ref as React.RefObject<HTMLIFrameElement>}
            />
          </div>
        )
      })()}

      {/* Desktop grid */}
      <div ref={containerRef} style={{ height: '100%', overflow: 'auto', padding: '8px 8px' }}>
        {layouts.length === 0 ? (
          <EmptyDesktop onAdd={() => setShowPicker(true)} />
        ) : containerWidth > 0 ? (
          <GridLayout
            layout={layouts}
            cols={COLS}
            rowHeight={ROW_HEIGHT}
            width={containerWidth - 16}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-drag-handle"
            margin={[8, 8]}
            containerPadding={[0, 0]}
            resizeHandles={['se']}
          >
            {layouts.map(l => {
              const tool = toolMap.get(l.i)
              if (!tool) return null
              const ws = widgetStates[l.i] ?? { minimized: false, maximized: false }
              if (ws.maximized) {
                // Render a placeholder in the grid when maximized
                return (
                  <div key={l.i} style={{
                    background: 'var(--surface)', border: '1px dashed var(--border)',
                    borderRadius: 8, display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tool.displayName} (maximized)</span>
                  </div>
                )
              }
              if (!iframeRefs.current.has(l.i)) {
                iframeRefs.current.set(l.i, React.createRef<HTMLIFrameElement>())
              }
              const iframeRef = iframeRefs.current.get(l.i)!
              return (
                <div key={l.i}>
                  <WidgetWindow
                    tool={tool}
                    minimized={ws.minimized}
                    maximized={false}
                    onMinimize={() => updateWidgetState(l.i, { minimized: !ws.minimized })}
                    onMaximize={() => updateWidgetState(l.i, { maximized: true })}
                    onClose={() => removeWidget(l.i)}
                    iframeRef={iframeRef}
                  />
                </div>
              )
            })}
          </GridLayout>
        ) : null}

        {/* Add widget button */}
        {layouts.length > 0 && availableToAdd.length > 0 && (
          <div style={{ padding: '8px 0 16px' }}>
            <button
              onClick={() => setShowPicker(true)}
              style={{
                padding: '5px 12px',
                fontSize: 11,
                border: '1px dashed var(--border)',
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--text-3)',
                cursor: 'pointer',
                letterSpacing: '0.02em',
                transition: 'color .15s, border-color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              + widget
            </button>
          </div>
        )}
      </div>

      {/* Widget picker modal */}
      {showPicker && (
        <WidgetPicker
          tools={availableToAdd}
          onAdd={addWidget}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

function EmptyDesktop({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: 400, gap: 14,
    }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '0.04em' }}>空桌面</p>
      <button
        onClick={onAdd}
        style={{
          padding: '6px 16px', fontSize: 12,
          border: '1px solid var(--border)', borderRadius: 6,
          background: 'transparent', color: 'var(--text-2)', cursor: 'pointer',
          letterSpacing: '0.02em',
          transition: 'border-color .15s, color .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
      >
        + 添加 Widget
      </button>
    </div>
  )
}

function WidgetPicker({ tools, onAdd, onClose }: {
  tools: ToolInfo[]
  onAdd: (tool: ToolInfo) => void
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20, minWidth: 260, maxWidth: 360,
          boxShadow: '0 24px 60px rgba(0,0,0,.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>添加 Widget</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {tools.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>所有工具都已在桌面上</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tools.map(t => (
              <button
                key={t.name}
                onClick={() => onAdd(t)}
                style={{
                  padding: '9px 12px', textAlign: 'left',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 7, cursor: 'pointer',
                  transition: 'border-color .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,169,110,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{t.displayName}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-3)' }}>{t.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
