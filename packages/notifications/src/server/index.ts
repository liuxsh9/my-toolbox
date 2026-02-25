import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerTool } from '@my-toolbox/shared'
import { registerRoutes } from './routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3004', 10)
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'

async function main() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  registerRoutes(app)

  // Serve frontend SPA in production
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

  registerTool({
    portalUrl: PORTAL_URL,
    manifest: {
      name: 'notifications',
      displayName: '通知中心',
      description: '工具推送通知的统一收件箱',
      version: '0.1.0',
      url: `http://localhost:${PORT}`,
      health: '/api/health',
      pm2Name: 'notifications',
    },
  })

  app.log.info(`Notifications running at http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error('Failed to start Notifications:', err)
  process.exit(1)
})
