import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerTool } from '@my-toolbox/shared'
import { initDb } from './db.js'
import { registerHealthRoute } from './routes/health.js'
import { registerNotesRoutes } from './routes/notes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3005', 10)
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'

async function main() {
  const db = initDb()
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  registerHealthRoute(app)
  registerNotesRoutes(app, db)

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
      name: 'notes',
      displayName: 'Notes',
      description: '轻量记事本，快速记录文本内容',
      version: '0.1.0',
      url: `http://localhost:${PORT}`,
      health: '/api/health',
      pm2Name: 'notes',
    },
  })

  app.log.info(`Notes running at http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error('Failed to start Notes:', err)
  process.exit(1)
})
