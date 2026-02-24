import { useState, useEffect } from 'react'

interface Tool {
  name: string
  displayName: string
  description: string
  version: string
  url: string
  status: string
  source: string
  healthStatus: string | null
  lastHeartbeat: string | null
}

const STATUS_COLORS: Record<string, string> = {
  running: '#22c55e',
  healthy: '#22c55e',
  unhealthy: '#eab308',
  unreachable: '#ef4444',
  stopped: '#ef4444',
}

function getStatusColor(tool: Tool): string {
  if (tool.healthStatus === 'unhealthy') return STATUS_COLORS.unhealthy
  if (tool.status === 'unreachable') return STATUS_COLORS.unreachable
  if (tool.status === 'running') return STATUS_COLORS.running
  return STATUS_COLORS.stopped
}

function getStatusLabel(tool: Tool): string {
  if (tool.status === 'unreachable') return 'Unreachable'
  if (tool.healthStatus === 'unhealthy') return 'Unhealthy'
  if (tool.healthStatus === 'healthy') return 'Running'
  return tool.status.charAt(0).toUpperCase() + tool.status.slice(1)
}

export function Dashboard() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchTools() {
    try {
      const res = await fetch('/api/tools')
      const json = await res.json()
      if (json.ok) setTools(json.data)
    } catch {
      // ignore fetch errors
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTools()
    const interval = setInterval(fetchTools, 10_000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div style={{ color: '#94a3b8' }}>Loading...</div>
  }

  if (tools.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#94a3b8',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>
          {'{ }'}
        </div>
        <h2 style={{ color: '#e2e8f0', marginBottom: '8px' }}>No tools registered</h2>
        <p style={{ maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
          Tools in <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>packages/*/tool.yaml</code> are
          auto-discovered. External tools can register via <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>POST /api/tools/register</code>.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '16px',
    }}>
      {tools.map((tool) => (
        <div
          key={tool.name}
          style={{
            background: '#1e293b',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>{tool.displayName}</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>v{tool.version}</span>
            </div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 500,
              color: getStatusColor(tool),
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getStatusColor(tool),
                display: 'inline-block',
              }} />
              {getStatusLabel(tool)}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: 1.5 }}>
            {tool.description || 'No description'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {tool.url}
            </span>
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                background: '#3b82f6',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Open
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
