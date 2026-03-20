import { useState } from 'react'

interface EditModalProps {
  date: string
  currentFirstActive: string | null
  currentLastActive: string | null
  onSave: () => void
  onClose: () => void
}

export function EditModal({ date, currentFirstActive, currentLastActive, onSave, onClose }: EditModalProps) {
  const [firstActive, setFirstActive] = useState(currentFirstActive ?? '')
  const [lastActive, setLastActive] = useState(currentLastActive ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!firstActive || !lastActive) {
      setError('Both times are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/days/${date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_active: firstActive, last_active: lastActive }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.message ?? 'Failed to save')
        setSaving(false)
        return
      }
      onSave()
    } catch {
      setError('Network error')
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--wh-surface)',
          borderRadius: 10,
          padding: '24px 28px',
          minWidth: 320,
          border: '1px solid var(--wh-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <h3 style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--wh-text)',
          marginBottom: 20,
        }}>
          Edit {date}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--wh-text-secondary)', display: 'block', marginBottom: 4 }}>
              First active
            </label>
            <input
              type="time"
              value={firstActive}
              onChange={e => setFirstActive(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--wh-text-secondary)', display: 'block', marginBottom: 4 }}>
              Last active
            </label>
            <input
              type="time"
              value={lastActive}
              onChange={e => setLastActive(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: 'var(--wh-overtime)', marginTop: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid var(--wh-border)',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--wh-text-secondary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              borderRadius: 6,
              background: saving ? '#D1D5DB' : 'var(--wh-primary)',
              color: '#FFFFFF',
              cursor: saving ? 'default' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid var(--wh-border)',
  borderRadius: 6,
  background: 'var(--wh-bg)',
  color: 'var(--wh-text)',
  outline: 'none',
}
