import React, { useState, useEffect, useRef, useCallback } from 'react'

interface Note {
  id: string
  content: string
  created_at: number
  updated_at: number
}

function getTitle(content: string): string {
  const first = content.split('\n')[0].trim()
  if (!first) return '无标题'
  return first.length > 40 ? first.slice(0, 40) + '…' : first
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}天前`
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/notes').then(r => r.json()).then(setNotes)
  }, [])

  async function createNote() {
    const res = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: '' }) })
    const note: Note = await res.json()
    setNotes(prev => [note, ...prev])
    setActiveId(note.id)
  }

  function updateNoteInList(updated: Note) {
    setNotes(prev => {
      const next = prev.map(n => n.id === updated.id ? updated : n)
      next.sort((a, b) => b.updated_at - a.updated_at)
      return next
    })
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
    setActiveId(null)
  }

  const activeNote = notes.find(n => n.id === activeId) ?? null

  if (activeNote) {
    return (
      <EditView
        note={activeNote}
        onBack={() => setActiveId(null)}
        onUpdate={updateNoteInList}
        onDelete={deleteNote}
      />
    )
  }

  return (
    <ListView
      notes={notes}
      onSelect={setActiveId}
      onCreate={createNote}
    />
  )
}

// ── List View ────────────────────────────────────────────────────────────────

function ListView({ notes, onSelect, onCreate }: {
  notes: Note[]
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Notes</span>
        <button
          onClick={onCreate}
          title="新建笔记"
          style={{
            width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border)',
            borderRadius: 5,
            background: 'transparent',
            color: 'var(--text-3)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
            transition: 'color .12s, border-color .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >+</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notes.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 10, padding: 24,
          }}>
            <span style={{ fontSize: 24, opacity: 0.3 }}>✎</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.5 }}>还没有笔记<br />点击 + 开始记录</span>
          </div>
        ) : (
          notes.map(note => (
            <button
              key={note.id}
              onClick={() => onSelect(note.id)}
              style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                width: '100%', padding: '8px 12px',
                background: 'transparent', border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {getTitle(note.content)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, marginLeft: 8 }}>
                {relativeTime(note.updated_at)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ── Edit View ────────────────────────────────────────────────────────────────

function EditView({ note, onBack, onUpdate, onDelete }: {
  note: Note
  onBack: () => void
  onUpdate: (note: Note) => void
  onDelete: (id: string) => void
}) {
  const [content, setContent] = useState(note.content)
  const [savedState, setSavedState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm'>('idle')
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingContentRef = useRef(note.content)

  // Flush save immediately
  const flushSave = useCallback(async (value: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const res = await fetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: value }),
    })
    if (res.ok) {
      const updated: Note = await res.json()
      onUpdate(updated)
      setSavedState('saved')
      setTimeout(() => setSavedState('idle'), 1500)
    }
  }, [note.id, onUpdate])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setContent(value)
    pendingContentRef.current = value
    setSavedState('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => flushSave(value), 500)
  }

  async function handleBack() {
    await flushSave(pendingContentRef.current)
    onBack()
  }

  function handleDeleteClick() {
    if (deleteState === 'idle') {
      setDeleteState('confirm')
      deleteTimerRef.current = setTimeout(() => setDeleteState('idle'), 3000)
    } else {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
      onDelete(note.id)
    }
  }

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        gap: 4,
      }}>
        <button
          onClick={handleBack}
          title="返回列表"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 6px',
            background: 'transparent', border: 'none',
            color: 'var(--text-3)', cursor: 'pointer', fontSize: 11,
            borderRadius: 4,
            transition: 'color .12s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M6.5 2L3.5 5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          返回
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Saved indicator */}
          <span style={{
            fontSize: 10, color: 'var(--text-3)',
            opacity: savedState === 'idle' ? 0 : 1,
            transition: 'opacity .3s',
          }}>
            {savedState === 'saving' ? '…' : '· saved'}
          </span>

          {/* Delete button */}
          <button
            onClick={handleDeleteClick}
            title={deleteState === 'confirm' ? '再次点击确认删除' : '删除笔记'}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '3px 6px',
              background: deleteState === 'confirm' ? 'rgba(192,97,74,0.1)' : 'transparent',
              border: deleteState === 'confirm' ? '1px solid rgba(192,97,74,0.3)' : '1px solid transparent',
              borderRadius: 4,
              color: deleteState === 'confirm' ? '#c0614a' : 'var(--text-3)',
              cursor: 'pointer', fontSize: 10,
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (deleteState === 'idle') e.currentTarget.style.color = '#c0614a' }}
            onMouseLeave={e => { if (deleteState === 'idle') e.currentTarget.style.color = 'var(--text-3)' }}
          >
            {deleteState === 'confirm' ? '确认删除？' : (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M2 3h7M4.5 3V2h2v1M4 3v5.5M7 3v5.5M2.5 3l.5 6h5l.5-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={handleChange}
        spellCheck={false}
        autoFocus
        style={{
          flex: 1,
          width: '100%',
          padding: '12px',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          color: 'var(--text-1)',
          fontSize: 12,
          lineHeight: 1.7,
          fontFamily: 'var(--font-mono, "JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace)',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
        placeholder="开始记录…"
      />
    </div>
  )
}
