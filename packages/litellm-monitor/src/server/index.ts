import Fastify from 'fastify'
import cors from '@fastify/cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerSpaStatic, registerTool } from '@my-toolbox/shared'
import { registerMetricsRoute } from './routes/metrics.js'
import { registerHealthRoute } from './routes/health.js'
import { registerFunnelRoute } from './routes/funnel.js'
import { MetricsCollector } from './services/collector.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3006', 10)
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'

async function main() {
  const collector = new MetricsCollector()
  const app = Fastify({ logger: false })

  await app.register(cors, { origin: true })

  registerHealthRoute(app)
  registerMetricsRoute(app, collector)
  registerFunnelRoute(app)

  // Serve frontend
  const webDir = path.resolve(__dirname, '../web')
  try {
    await registerSpaStatic(app, webDir)
  } catch {
    // no frontend built yet
  }

  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`LiteLLM Monitor running at http://localhost:${PORT}`)

  // Start loading historical data in background
  collector.initialize().catch(err => console.error('Collector init error:', err))

  registerTool({
    portalUrl: PORTAL_URL,
    manifest: {
      name: 'litellm-monitor',
      displayName: 'LiteLLM Monitor',
      description: 'LiteLLM 请求统计：总量、成功、失败',
      version: '0.1.0',
      url: `http://localhost:${PORT}`,
      health: '/api/health',
      pm2Name: 'litellm-monitor',
      category: 'AI',
      widget: { minW: 3, minH: 4, defaultW: 4, defaultH: 5 },
    },
  })
}

main().catch(err => {
  console.error('Failed to start:', err)
  process.exit(1)
})
