import React, { useState, useEffect, useRef } from 'react'
import type { Bookmark } from './api'
import { createBookmark, updateBookmark, fetchScreenshot } from './api'
import { ScreenshotUpload } from './ScreenshotUpload'

interface BookmarkModalProps {
  bookmark?: Bookmark | null
  onSave: (b: Bookmark) => void
  onClose: () => void
}

export function BookmarkModal({ bookmark, onSave, onClose }: BookmarkModalProps) {
  const isEditing = !!bookmark
  const [title, setTitle] = useState(bookmark?.title ?? '')
  const [url, setUrl] = useState(bookmark?.url ?? '')
  const [category, setCategory] = useState(bookmark?.category ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Bookmark | null>(bookmark ?? null)
  const urlBlurred = useRef(false)

  // When URL loses focus, try auto-fetch og:image for new bookmarks
  async function handleUrlBlur() {
    if (urlBlurred.current || isEditing || !url || draft) return
    urlBlurred.current = true
    // We need the bookmark ID first — will fetch after save
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !url.trim()) {
      setError('标题和 URL 不能为空')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let saved: Bookmark
      if (isEditing && bookmark) {
        saved = await updateBookmark(bookmark.id, { title: title.trim(), url: url.trim(), category: category.trim() || null })
      } else {
        saved = await createBookmark({ title: title.trim(), url: url.trim(), category: category.trim() || undefined })
        // Auto-fetch screenshot after creation
        setDraft(saved)
        try {
          const result = await fetchScreenshot(saved.id, saved.url)
          if (result.screenshotUrl) {
            saved = { ...saved, screenshot: result.screenshotUrl }
            setDraft(saved)
          }
        } catch {
          // ignore, user can upload manually
        }
      }
      onSave(saved)
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if ((e.target as HTMLElement).dataset.backdrop) onClose()
  }

  return (
    <div
      data-backdrop="true"
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '28px 28px 24px',
          width: '100%',
          maxWidth: 460,
          boxShadow: '0 8px 32px rgba(0,0,0,.12)',
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, letterSpacing: '-0.02em' }}>
          {isEditing ? '编辑书签' : '添加书签'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="标题 *">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="网站名称"
              autoFocus
              style={inputStyle}
            />
          </Field>

          <Field label="URL *">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://example.com"
              style={inputStyle}
            />
          </Field>

          <Field label="分组">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="工作、设计、学习…"
              style={inputStyle}
            />
          </Field>

          {/* Screenshot section — only shown when we have a draft ID */}
          {draft && (
            <Field label="预览图">
              <ScreenshotUpload
                bookmark={draft}
                onUpdated={(updated) => setDraft(updated)}
              />
            </Field>
          )}

          {error && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--text-secondary)',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent)',
                color: '#fff',
                opacity: saving ? .65 : 1,
              }}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg)',
  outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '.02em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
