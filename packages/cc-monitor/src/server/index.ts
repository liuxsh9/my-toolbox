import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerTool } from '@my-toolbox/shared'
import { registerEventsRoute } from './routes/events.js'
import { registerSessionsRoute } from './routes/sessions.js'
import { registerHealthRoute } from './routes/health.js'
import { SessionManager } from './services/collector.js'
import { startProcessScanner } from './services/process.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3001', 10)
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'

async function main() {
  const sessions = new SessionManager()
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  registerHealthRoute(app)
  registerEventsRoute(app, sessions)
  registerSessionsRoute(app, sessions)

  // Start process scanner
  startProcessScanner(sessions)

  // Serve frontend in production
  const webDir = path.resolve(__dirname, '../web')
  try {
    await app.register(fastifyStatic, {
      root: webDir,
      prefix: '/',
      wildcard: false,
    })
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html', webDir)
    })
  } catch {
    app.log.warn('No built frontend found — skipping static file serving')
  }

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
