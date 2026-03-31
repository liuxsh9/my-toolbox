import React, { useState, useEffect, useRef, useCallback } from 'react'

interface NowPlaying {
  inactive?: boolean
  title?: string
  artist?: string
  album?: string
  duration?: number
  elapsed?: number
  rate?: number
  artworkBase64?: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function App() {
  const [track, setTrack] = useState<NowPlaying>({ inactive: true })
  const [progress, setProgress] = useState(0)
  const animRef = useRef<number>(0)
  const lastUpdateRef = useRef<{ elapsed: number; rate: number; time: number }>({ elapsed: 0, rate: 0, time: Date.now() })

  // SSE connection
  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'nowPlaying') {
          setTrack(data)
          if (data.elapsed != null && data.rate != null) {
            lastUpdateRef.current = { elapsed: data.elapsed, rate: data.rate, time: Date.now() }
          }
        }
      } catch { /* ignore parse errors */ }
    }
    return () => es.close()
  }, [])

  // Initial load
  useEffect(() => {
    fetch('/api/now-playing')
      .then((r) => r.json())
      .then((data) => {
        if (data.type === 'nowPlaying') {
          setTrack(data)
          if (data.elapsed != null && data.rate != null) {
            lastUpdateRef.current = { elapsed: data.elapsed, rate: data.rate, time: Date.now() }
          }
        }
      })
      .catch(() => {})
  }, [])

  // Smooth progress interpolation
  useEffect(() => {
    const animate = () => {
      const { elapsed, rate, time } = lastUpdateRef.current
      const dt = (Date.now() - time) / 1000
      const current = elapsed + dt * rate
      setProgress(current)
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const control = useCallback(async (action: string) => {
    try {
      await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
    } catch { /* ignore */ }
  }, [])

  // Inactive state
  if (track.inactive) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 16,
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>未检测到网易云音乐</span>
        <button
          onClick={() => control('open')}
          style={{
            background: 'var(--surface2)',
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 16px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          打开网易云音乐
        </button>
      </div>
    )
  }

  const duration = track.duration || 1
  const isPlaying = (track.rate ?? 0) !== 0
  const artworkSrc = track.artworkBase64 ? `data:image/jpeg;base64,${track.artworkBase64}` : undefined

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Cover Art */}
      <div style={{
        width: 72,
        height: 72,
        minWidth: 72,
        borderRadius: 8,
        background: 'var(--surface2)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {artworkSrc ? (
          <img src={artworkSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        )}
      </div>

      {/* Info + Controls */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}>
        {/* Track info */}
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}>
          {track.title || '未知曲目'}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-2)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}>
          {[track.artist, track.album].filter(Boolean).join(' - ') || '未知艺术家'}
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            flex: 1,
            height: 3,
            background: 'var(--border2)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min((progress / duration) * 100, 100)}%`,
              height: '100%',
              background: 'var(--accent)',
              borderRadius: 2,
            }} />
          </div>
          <span style={{ fontSize: 9, color: 'var(--text-3)', minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(progress)} / {formatTime(duration)}
          </span>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          <CtrlBtn onClick={() => control('prev')} label="上一曲">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
          </CtrlBtn>
          <CtrlBtn onClick={() => control('toggle')} label={isPlaying ? '暂停' : '播放'}>
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </CtrlBtn>
          <CtrlBtn onClick={() => control('next')} label="下一曲">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
          </CtrlBtn>
          <CtrlBtn onClick={() => control('open')} label="打开网易云" style={{ marginLeft: 2 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
          </CtrlBtn>
        </div>
      </div>
      </div>
    </div>
  )
}

function CtrlBtn({ children, onClick, label, style }: {
  children: React.ReactNode
  onClick: () => void
  label: string
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: 'var(--text-1)',
        cursor: 'pointer',
        transition: 'background 0.15s',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}
