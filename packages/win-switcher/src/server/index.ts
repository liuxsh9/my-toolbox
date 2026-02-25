import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerTool } from '@my-toolbox/shared'
import { registerHealthRoute } from './routes/health.js'
import { registerWindowsRoutes } from './routes/windows.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3003', 10)
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'

async function main() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  registerHealthRoute(app)
  registerWindowsRoutes(app)

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
      name: 'win-switcher',
      displayName: 'Window Switcher',
      description: '查看并快速跳转到本机所有打开的窗口',
      version: '0.1.0',
      url: `http://localhost:${PORT}`,
      health: '/api/health',
      pm2Name: 'win-switcher',
    },
  })

  app.log.info(`Window Switcher running at http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error('Failed to start Window Switcher:', err)
  process.exit(1)
})
