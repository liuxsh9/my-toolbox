import React, { useState } from 'react'
import type { Bookmark } from './api'
import { deleteBookmark } from './api'

interface BookmarkCardProps {
  bookmark: Bookmark
  onEdit: (b: Bookmark) => void
  onDeleted: (id: string) => void
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function getFaviconUrl(url: string): string {
  try {
    const { protocol, host } = new URL(url)
    return `${protocol}//${host}/favicon.ico`
  } catch { return '' }
}

export function BookmarkCard({ bookmark, onEdit, onDeleted }: BookmarkCardProps) {
  const [hovered, setHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteBookmark(bookmark.id)
      onDeleted(bookmark.id)
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    onEdit(bookmark)
    setConfirmDelete(false)
  }

  function handleCardClick() {
    window.open(bookmark.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false) }}
      onClick={handleCardClick}
      style={{
        position: 'relative',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'border-color .15s, box-shadow .15s',
        boxShadow: hovered ? 'var(--shadow)' : 'none',
        borderColor: hovered ? '#ccc' : 'var(--border)',
      }}
    >
      {/* Thumbnail */}
      <div style={{ height: 110, background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
        {bookmark.screenshot ? (
          <img
            src={bookmark.screenshot}
            alt={bookmark.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={getFaviconUrl(bookmark.url)}
              alt=""
              width={32}
              height={32}
              style={{ opacity: .5 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bookmark.title}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getDomain(bookmark.url)}
        </p>
      </div>

      {/* Hover actions */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ActionBtn onClick={handleEdit} title="编辑">✎</ActionBtn>
          <ActionBtn
            onClick={handleDelete}
            title={confirmDelete ? '确认删除' : '删除'}
            danger={confirmDelete}
          >
            {deleting ? '…' : confirmDelete ? '确认' : '✕'}
          </ActionBtn>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ onClick, title, children, danger }: {
  onClick: (e: React.MouseEvent) => void
  title: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26,
        height: 26,
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        background: danger ? 'var(--danger)' : 'rgba(255,255,255,.9)',
        color: danger ? '#fff' : 'var(--text-primary)',
        border: '1px solid rgba(0,0,0,.1)',
        backdropFilter: 'blur(4px)',
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  )
}
