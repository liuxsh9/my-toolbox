import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { FastifyInstance } from 'fastify'

const MONITOR_URL = process.env.CC_MONITOR_URL || 'http://localhost:3001'
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')

export function registerHealthRoute(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return { status: 'ok' }
  })

  app.get('/api/hooks/status', async () => {
    try {
      if (!fs.existsSync(SETTINGS_PATH)) {
        return { ok: true, data: { installed: false } }
      }
      const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
      const hooks = settings.hooks
      if (!hooks) {
        return { ok: true, data: { installed: false } }
      }
      // Check if any hook event contains our monitor URL
      const hasMonitorHook = Object.values(hooks).some((eventHooks: unknown) =>
        JSON.stringify(eventHooks).includes(MONITOR_URL + '/api/events')
      )
      return { ok: true, data: { installed: hasMonitorHook } }
    } catch {
      return { ok: true, data: { installed: false } }
    }
  })
}
