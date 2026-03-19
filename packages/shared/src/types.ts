export interface WidgetConfig {
  minW?: number
  minH?: number
  defaultW?: number
  defaultH?: number
  zoom?: number            // iframe 内容缩放比例，如 0.75 表示缩小到 75%
  refreshInterval?: number // 自动刷新间隔（秒），0 或不设置表示不刷新
}

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
  widget?: WidgetConfig
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
