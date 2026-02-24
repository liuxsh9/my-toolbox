import type { RegisterToolOptions } from './types.js'

const DEFAULT_HEARTBEAT_INTERVAL = 30_000

export function registerTool(options: RegisterToolOptions): { stop: () => void } {
  const { portalUrl, manifest, heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL } = options
  const baseUrl = portalUrl.replace(/\/$/, '')
  let timer: ReturnType<typeof setInterval> | null = null
  let stopped = false

  async function doRegister(): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/api/tools/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifest),
      })
      return res.ok
    } catch {
      console.warn(`[my-toolbox] Failed to register with portal at ${baseUrl} — will retry`)
      return false
    }
  }

  async function doHeartbeat(): Promise<void> {
    try {
      await fetch(`${baseUrl}/api/tools/${manifest.name}/heartbeat`, {
        method: 'PUT',
      })
    } catch {
      // silent — portal may be down, we keep trying
    }
  }

  async function start(): Promise<void> {
    // Retry registration until success or stopped
    let registered = false
    while (!registered && !stopped) {
      registered = await doRegister()
      if (!registered && !stopped) {
        await new Promise(r => setTimeout(r, 5_000))
      }
    }

    if (stopped) return

    // Start heartbeat
    timer = setInterval(doHeartbeat, heartbeatInterval)
  }

  // Fire and forget — don't block caller
  start()

  return {
    stop() {
      stopped = true
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}
