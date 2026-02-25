import React, { useState, useEffect, useCallback } from 'react'
import type { Bookmark } from './api'
import { fetchBookmarks, fetchCategories } from './api'
import { BookmarkCard } from './BookmarkCard'
import { BookmarkModal } from './BookmarkModal'

export default function App() {
  const isWidget = new URLSearchParams(window.location.search).get('mode') === 'widget'
  if (isWidget) document.body.classList.add('widget')
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Bookmark | null>(null)

  const load = useCallback(async () => {
    try {
      const [bm, cats] = await Promise.all([
        fetchBookmarks(activeCategory ?? undefined),
        fetchCategories(),
      ])
      setBookmarks(bm)
      setCategories(cats)
    } finally {
      setLoading(false)
    }
  }, [activeCategory])

  useEffect(() => { load() }, [load])

  function openAdd() { setEditTarget(null); setModalOpen(true) }
  function openEdit(b: Bookmark) { setEditTarget(b); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditTarget(null) }

  function handleSaved(b: Bookmark) {
    setBookmarks((prev) => {
      const idx = prev.findIndex((x) => x.id === b.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = b; return next }
      return [...prev, b]
    })
    closeModal()
    // Refresh categories
    fetchCategories().then(setCategories).catch(() => {})
  }

  function handleDeleted(id: string) {
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
    fetchCategories().then(setCategories).catch(() => {})
  }

  const allCategories = ['全部', ...categories]

  if (isWidget) {
    return (
      <>
        <WidgetView
          bookmarks={bookmarks}
          loading={loading}
          onAdd={openAdd}
        />
        {modalOpen && (
          <BookmarkModal
            bookmark={editTarget}
            onSave={handleSaved}
            onClose={closeModal}
          />
        )}
      </>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        padding: '32px 48px 0',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1 }}>
            Bookmarks
          </h1>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>
            {bookmarks.length} 个链接{activeCategory ? ` · ${activeCategory}` : ''}
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            letterSpacing: '.01em',
          }}
        >
          + 添加
        </button>
      </header>

      {/* Category tabs */}
      {(categories.length > 0 || activeCategory) && (
        <nav style={{
          padding: '20px 48px 0',
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
        }}>
          {allCategories.map((cat) => {
            const isActive = cat === '全部' ? activeCategory === null : activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === '全部' ? null : cat)}
                style={{
                  padding: '5px 14px',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  border: '1px solid',
                  borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                  borderRadius: 20,
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  transition: 'all .12s',
                }}
              >
                {cat}
              </button>
            )
          })}
        </nav>
      )}

      {/* Bookmark grid */}
      <main style={{ flex: 1, padding: '28px 48px 48px' }}>
        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>加载中…</p>
        ) : bookmarks.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
            gap: 16,
          }}>
            {bookmarks.map((b) => (
              <BookmarkCard
                key={b.id}
                bookmark={b}
                onEdit={openEdit}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {modalOpen && (
        <BookmarkModal
          bookmark={editTarget}
          onSave={handleSaved}
          onClose={closeModal}
        />
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 320,
      gap: 16,
      color: 'var(--text-muted)',
    }}>
      <div style={{ fontSize: 40 }}>◻</div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>还没有书签</p>
        <p style={{ fontSize: 13 }}>添加你常用的网址，快速访问</p>
      </div>
      <button
        onClick={onAdd}
        style={{
          marginTop: 8,
          padding: '8px 20px',
          fontSize: 13,
          fontWeight: 600,
          border: '1.5px solid var(--accent)',
          borderRadius: 'var(--radius-sm)',
          background: 'transparent',
          color: 'var(--accent)',
        }}
      >
        添加第一个书签
      </button>
    </div>
  )
}

// ─── Widget View ────────────────────────────────────────────

function WidgetView({ bookmarks, loading, onAdd }: {
  bookmarks: Bookmark[]
  loading: boolean
  onAdd: () => void
}) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Compact header */}
      <div style={{
        padding: '7px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bookmarks.length} 个链接</span>
        <button
          onClick={onAdd}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >+ 添加</button>
      </div>

      {/* Compact grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {loading ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>加载中…</p>
        ) : bookmarks.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 20 }}>还没有书签</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
            gap: 6,
          }}>
            {bookmarks.map((b) => (
              <WidgetBookmarkCard key={b.id} bookmark={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WidgetBookmarkCard({ bookmark: b }: { bookmark: Bookmark }) {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={b.url}
      target="_blank"
      rel="noopener noreferrer"
      title={b.title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
        textDecoration: 'none',
        background: 'var(--surface)',
        transition: 'border-color .12s',
        borderColor: hovered ? 'var(--accent)' : 'var(--border)',
      }}
    >
      {/* Thumbnail */}
      <div style={{
        height: 52,
        background: '#ede9e2',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {b.screenshot ? (
          <img
            src={b.screenshot}
            alt={b.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)' }}>
            {b.title.charAt(0).toUpperCase()}
          </span>
        )}
        {/* Title overlay on hover */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 4,
          }}>
            <span style={{
              fontSize: 9, color: '#fff', fontWeight: 600,
              textAlign: 'center', lineHeight: 1.3,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            }}>{b.title}</span>
          </div>
        )}
      </div>
      {/* Domain */}
      <div style={{ padding: '3px 5px 4px' }}>
        <p style={{
          fontSize: 9, color: 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {(() => { try { return new URL(b.url).hostname } catch { return b.url } })()}
        </p>
      </div>
    </a>
  )
}
