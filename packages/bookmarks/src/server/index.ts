import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import multipart from '@fastify/multipart'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerTool } from '@my-toolbox/shared'
import { initDb } from './db.js'
import { registerHealthRoute } from './routes/health.js'
import { registerBookmarksRoutes } from './routes/bookmarks.js'
import { registerScreenshotRoutes } from './routes/screenshots.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3002', 10)
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'

async function main() {
  const db = initDb()
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

  // Serve screenshots from data/screenshots/
  const screenshotsDir = path.resolve(__dirname, '../../data/screenshots')
  await app.register(fastifyStatic, {
    root: screenshotsDir,
    prefix: '/screenshots/',
    decorateReply: false,
  })

  registerHealthRoute(app)
  registerBookmarksRoutes(app, db)
  registerScreenshotRoutes(app, db)

  // Serve frontend SPA in production
  const webDir = path.resolve(__dirname, '../web')
  try {
    await app.register(fastifyStatic, {
      root: webDir,
      prefix: '/',
      wildcard: false,
      decorateReply: false,
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
      name: 'bookmarks',
      displayName: 'Bookmarks',
      description: '常用网页聚合器，快速访问收藏的网址',
      version: '0.1.0',
      url: `http://localhost:${PORT}`,
      health: '/api/health',
      pm2Name: 'bookmarks',
    },
  })

  app.log.info(`Bookmarks running at http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error('Failed to start Bookmarks:', err)
  process.exit(1)
})
