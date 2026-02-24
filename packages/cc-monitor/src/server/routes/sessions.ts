import type { FastifyInstance } from 'fastify'
import type { SessionManager } from '../services/collector.js'

export function registerSessionsRoute(app: FastifyInstance, sessions: SessionManager) {
  app.get<{ Querystring: { includeEnded?: string } }>('/api/sessions', async (req) => {
    const includeEnded = req.query.includeEnded === 'true'
    const raw = includeEnded ? sessions.getAllIncludingEnded() : sessions.getAll()

    // Return enriched session summaries without the full events array
    const data = raw.map(s => {
      const lastEvent = s.events.length > 0 ? s.events[s.events.length - 1] : undefined
      return {
        sessionId: s.sessionId,
        project: s.project,
        status: s.status,
        lastActivity: s.lastActivity,
        startedAt: s.startedAt,
        pid: s.pid,
        tty: s.tty,
        eventCount: s.events.length,
        lastToolName: lastEvent?.toolName ?? null,
      }
    })

    return { ok: true, data, stats: sessions.getStats() }
  })

  app.get<{ Params: { sessionId: string } }>('/api/sessions/:sessionId', async (req, reply) => {
    const session = sessions.getById(req.params.sessionId)
    if (!session) {
      return reply.status(404).send({ ok: false, error: 'Session not found' })
    }
    return { ok: true, data: session }
  })
}
