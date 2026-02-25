import type { FastifyInstance } from 'fastify'

export function registerHealthRoute(app: FastifyInstance) {
  app.get('/api/health', async (_req, reply) => {
    return reply.send({ status: 'ok' })
  })
}
