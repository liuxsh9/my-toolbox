import { registerTool } from '@my-toolbox/shared'
import { createApp } from './app.js'
const PORT = parseInt(process.env.PORT || '3001', 10)
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'

async function main() {
  const app = await createApp()
  await app.listen({ port: PORT, host: '0.0.0.0' })

  // Register with portal
  registerTool({
    portalUrl: PORTAL_URL,
    manifest: {
      name: 'cc-monitor',
      displayName: 'Claude Code Monitor',
      description: '监控本地所有 Claude Code 实例的运行状态',
      version: '0.1.0',
      url: `http://localhost:${PORT}`,
      health: '/api/health',
      pm2Name: 'cc-monitor',
    },
  })

  app.log.info(`CC Monitor running at http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error('Failed to start CC Monitor:', err)
  process.exit(1)
})
