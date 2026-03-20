import Fastify from 'fastify'
import cors from '@fastify/cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerSpaStatic, registerTool } from '@my-toolbox/shared'
import { initDb } from './db.js'
import { registerHealthRoute } from './routes/health.js'
import { registerQuotaRoutes } from './routes/quota.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3008', 10)
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'

async function main() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  const db = initDb()

  registerHealthRoute(app)
  registerQuotaRoutes(app, db)

  // Serve frontend SPA in production
  const webDir = path.resolve(__dirname, '../web')
  try {
    await registerSpaStatic(app, webDir)
  } catch {
    app.log.warn('No built frontend found — skipping static file serving')
  }

  await app.listen({ port: PORT, host: '0.0.0.0' })

  registerTool({
    portalUrl: PORTAL_URL,
    manifest: {
      name: 'api-quota',
      displayName: 'API Quota',
      description: '实时显示 vibe-code API 今日用量',
      version: '0.1.0',
      url: `http://localhost:${PORT}`,
      health: '/api/health',
      pm2Name: 'api-quota',
    },
  })

  app.log.info(`API Quota running at http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error('Failed to start API Quota:', err)
  process.exit(1)
})
