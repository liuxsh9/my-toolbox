import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb } from './db.js'
import { registerRoutes } from './routes/registry.js'
import { registerHealthRoute } from './routes/health.js'
import { startDiscovery } from './services/discovery.js'
import { startHeartbeatChecker } from './services/heartbeat.js'
import { startHealthChecker } from './services/healthcheck.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3000', 10)

async function main() {
  const db = initDb()
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  registerHealthRoute(app)
  registerRoutes(app, db)

  // Serve frontend in production
  const webDir = path.resolve(__dirname, '../web')
  try {
    await app.register(fastifyStatic, {
      root: webDir,
      prefix: '/',
      wildcard: false,
    })
    // SPA fallback
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html', webDir)
    })
  } catch {
    app.log.warn('No built frontend found at %s — skipping static file serving', webDir)
  }

  await app.listen({ port: PORT, host: '0.0.0.0' })

  // Start background tasks
  startDiscovery(db)
  startHeartbeatChecker(db)
  startHealthChecker(db)

  app.log.info(`Portal running at http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error('Failed to start portal:', err)
  process.exit(1)
})
