import type { FastifyInstance } from 'fastify'
import type { SessionManager } from '../services/collector.js'

export function registerEventsRoute(app: FastifyInstance, sessions: SessionManager) {
  app.post('/api/events', async (req) => {
    const data = req.body as Record<string, unknown>
    sessions.handleEvent(data)
    return { ok: true }
  })
}
