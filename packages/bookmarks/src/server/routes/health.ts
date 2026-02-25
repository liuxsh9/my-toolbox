import type { FastifyInstance } from 'fastify'

export function registerHealthRoute(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return { ok: true }
  })
}
