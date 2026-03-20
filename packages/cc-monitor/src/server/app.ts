import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerSpaStatic } from '@my-toolbox/shared'
import { registerEventsRoute } from './routes/events.js'
import { registerSessionsRoute } from './routes/sessions.js'
import { registerHealthRoute } from './routes/health.js'
import { SessionManager } from './services/collector.js'
import { startProcessScanner } from './services/process.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface CreateAppOptions {
  webDir?: string
  logger?: boolean | FastifyBaseLogger
  startProcessScanner?: boolean
}

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const sessions = new SessionManager()
  const app = Fastify({ logger: options.logger ?? true })

  await app.register(cors, { origin: true })

  registerHealthRoute(app)
  registerEventsRoute(app, sessions)
  registerSessionsRoute(app, sessions)

  if (options.startProcessScanner !== false) {
    startProcessScanner(sessions)
  }

  const webDir = options.webDir ?? path.resolve(__dirname, '../web')
  try {
    await registerSpaStatic(app, webDir)
  } catch {
    app.log.warn('No built frontend found — skipping static file serving')
  }

  return app
}
