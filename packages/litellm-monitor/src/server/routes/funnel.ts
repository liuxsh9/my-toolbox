import type { FastifyInstance } from 'fastify'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

async function getFunnelStatus(): Promise<{ enabled: boolean; url: string | null }> {
  try {
    const { stdout } = await execAsync('tailscale funnel status 2>&1')
    const urlMatch = stdout.match(/https:\/\/[\w-]+\.[\w.-]+\.ts\.net/)
    return { enabled: !!urlMatch, url: urlMatch ? urlMatch[0] : null }
  } catch {
    return { enabled: false, url: null }
  }
}

export function registerFunnelRoute(app: FastifyInstance) {
  app.get('/api/funnel', async () => {
    return getFunnelStatus()
  })

  app.post('/api/funnel', async (req) => {
    const body = req.body as { enabled: boolean }
    if (body.enabled) {
      await execAsync('tailscale funnel --bg 4000')
    } else {
      // --https=443 off closes ALL funnel rules, including those started by other processes
      await execAsync('tailscale funnel --https=443 off')
    }
    // Re-read actual status instead of assuming
    return getFunnelStatus()
  })
}
