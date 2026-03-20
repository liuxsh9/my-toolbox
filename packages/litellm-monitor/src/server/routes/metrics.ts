import type { FastifyInstance } from 'fastify'
import type { MetricsCollector } from '../services/collector.js'

export function registerMetricsRoute(app: FastifyInstance, collector: MetricsCollector) {
  app.get('/api/metrics', async () => {
    await collector.ensureFresh()
    return { ok: true, data: collector.getMetrics() }
  })
}
