import type { FastifyInstance } from 'fastify'

export function registerHealthRoute(app: FastifyInstance, daemonStatus: () => boolean) {
  app.get('/api/health', async () => {
    return { status: 'ok', daemon_running: daemonStatus() }
  })
}
