import React, { useRef, useState } from 'react'
import type { Bookmark } from './api'
import { uploadScreenshot, fetchScreenshot } from './api'

interface ScreenshotUploadProps {
  bookmark: Bookmark
  onUpdated: (b: Bookmark) => void
}

export function ScreenshotUpload({ bookmark, onUpdated }: ScreenshotUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | Blob) {
    setLoading(true)
    setError(null)
    try {
      const { screenshotUrl } = await uploadScreenshot(bookmark.id, file)
      onUpdated({ ...bookmark, screenshot: screenshotUrl })
    } catch {
      setError('上传失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  async function handleAutoFetch() {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchScreenshot(bookmark.id, bookmark.url)
      if (result.screenshotUrl) {
        onUpdated({ ...bookmark, screenshot: result.screenshotUrl })
      } else {
        setError('未找到预览图，请手动上传')
      }
    } catch {
      setError('抓取失败，请手动上传')
    } finally {
      setLoading(false)
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items)
    const img = items.find((i) => i.type.startsWith('image/'))
    if (!img) return
    const blob = img.getAsFile()
    if (blob) handleFile(blob)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bookmark.screenshot && (
        <img
          src={bookmark.screenshot}
          alt="预览"
          style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
        />
      )}

      <div
        className="upload-zone"
        tabIndex={0}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        style={{
          border: '1.5px dashed var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          fontSize: 13,
          color: 'var(--text-secondary)',
          transition: 'border-color .15s, background .15s',
        }}
      >
        {loading ? '处理中…' : '点击上传 / 拖拽 / 粘贴图片 (Ctrl+V)'}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      {!bookmark.screenshot && (
        <button
          onClick={handleAutoFetch}
          disabled={loading}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
          }}
        >
          自动抓取预览图
        </button>
      )}

      {error && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}
