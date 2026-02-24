export interface ToolManifest {
  name: string
  displayName: string
  description: string
  version: string
  url: string
  health: string
  icon?: string
  category?: string
  pm2Name?: string
}

export type ToolStatus = 'running' | 'unhealthy' | 'unreachable' | 'stopped'

export type ToolSource = 'local' | 'remote'

export interface ToolInfo extends ToolManifest {
  status: ToolStatus
  source: ToolSource
  lastHeartbeat: string | null
  createdAt: string
  pm2Status?: Pm2ProcessInfo | null
}

export interface Pm2ProcessInfo {
  status: string
  cpu: number
  memory: number
  uptime: number
}

export interface RegisterToolOptions {
  portalUrl: string
  manifest: ToolManifest
  heartbeatInterval?: number
}

export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
