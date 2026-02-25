import React, { forwardRef } from 'react'
import type { ToolInfo } from '@my-toolbox/shared'

const STATUS_DOT: Record<string, { color: string; glow: string }> = {
  running:     { color: '#5cb87a', glow: '#5cb87a44' },
  unhealthy:   { color: '#d4a843', glow: '#d4a84344' },
  unreachable: { color: '#3d3b38', glow: 'transparent' },
  stopped:     { color: '#3d3b38', glow: 'transparent' },
}

interface WidgetWindowProps {
  tool: ToolInfo
  minimized: boolean
  maximized: boolean
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
  iframeRef: React.RefObject<HTMLIFrameElement>
}

export const WidgetWindow = forwardRef<HTMLDivElement, WidgetWindowProps>(
  function WidgetWindow({ tool, minimized, maximized, onMinimize, onMaximize, onClose, iframeRef }, ref) {
    const dot = STATUS_DOT[tool.status] ?? STATUS_DOT.stopped
    const widgetUrl = `${tool.url}?mode=widget`

    return (
      <div
        ref={ref}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: maximized
            ? '0 24px 80px rgba(0,0,0,.7)'
            : '0 2px 16px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Title bar */}
        <div
          className="widget-drag-handle"
          style={{
            height: 30,
            padding: '0 6px 0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: minimized ? 'none' : '1px solid var(--border2)',
            flexShrink: 0,
            userSelect: 'none',
            cursor: 'grab',
          }}
        >
          {/* Status dot + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: dot.color, flexShrink: 0,
              boxShadow: `0 0 6px ${dot.glow}`,
            }} />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-2)',
              letterSpacing: '0.01em',
            }}>
              {tool.displayName}
            </span>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 1 }} onClick={e => e.stopPropagation()}>
            <WinBtn title="在新标签页打开" onClick={() => window.open(tool.url, '_blank')}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M4 2H2v6h6V6M6 1h3v3M9 1L5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </WinBtn>
            <WinBtn title={minimized ? '展开' : '最小化'} onClick={onMinimize}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </WinBtn>
            <WinBtn title={maximized ? '还原' : '最大化'} onClick={onMaximize}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            </WinBtn>
            <WinBtn title="关闭" onClick={onClose} danger>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </WinBtn>
          </div>
        </div>

        {/* iframe */}
        {!minimized && (
          <iframe
            ref={iframeRef}
            src={widgetUrl}
            title={tool.displayName}
            style={{
              flex: 1,
              border: 'none',
              width: '100%',
              display: 'block',
            }}
            allow="clipboard-read; clipboard-write"
          />
        )}
      </div>
    )
  }
)

function WinBtn({ children, onClick, title, danger }: {
  children: React.ReactNode
  onClick: () => void
  title?: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 24, height: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none',
        borderRadius: 5,
        background: 'transparent',
        color: danger ? '#c0614a' : 'var(--text-3)',
        cursor: 'pointer',
        padding: 0,
        transition: 'background .1s, color .1s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(192,97,74,0.12)' : 'rgba(255,255,255,0.05)'
        e.currentTarget.style.color = danger ? '#c0614a' : 'var(--text-1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger ? '#c0614a' : 'var(--text-3)'
      }}
    >
      {children}
    </button>
  )
}
