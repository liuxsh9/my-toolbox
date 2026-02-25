import type { FastifyInstance } from 'fastify'
import * as store from './store.js'
import { subscribe, broadcast } from './sse.js'

interface PushBody {
  title: string
  body: string
  source: string
  url?: string
}

export function registerRoutes(app: FastifyInstance) {
  // POST /api/notifications
  app.post<{ Body: PushBody }>('/api/notifications', async (req, reply) => {
    const { title, body, source, url } = req.body
    if (!title || !body || !source) {
      return reply.status(400).send({ ok: false, error: 'Missing required fields: title, body, source' })
    }
    const notification = store.add({ title, body, source, url })
    broadcast('notification', notification)
    return reply.status(201).send({ ok: true, data: { id: notification.id } })
  })

  // GET /api/notifications
  app.get('/api/notifications', async () => {
    return { ok: true, data: store.getAll() }
  })

  // GET /api/notifications/stream (SSE) — must be before /:id
  app.get('/api/notifications/stream', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()
    reply.raw.write('event: connected\ndata: {}\n\n')
    subscribe(reply)
    // Keep alive
    const keepAlive = setInterval(() => {
      try { reply.raw.write(': ping\n\n') } catch { clearInterval(keepAlive) }
    }, 30000)
    reply.raw.on('close', () => clearInterval(keepAlive))
    await new Promise(() => {}) // hold the connection
  })

  // DELETE /api/notifications (clear all) — must be before /:id
  app.delete('/api/notifications', async () => {
    store.clear()
    broadcast('cleared')
    return { ok: true }
  })

  // DELETE /api/notifications/:id
  app.delete<{ Params: { id: string } }>('/api/notifications/:id', async (req, reply) => {
    const { id } = req.params
    const removed = store.remove(id)
    if (!removed) {
      return reply.status(404).send({ ok: false, error: 'Not found' })
    }
    broadcast('dismissed', { id })
    return { ok: true }
  })

  // GET /api/health
  app.get('/api/health', async () => {
    return { ok: true, status: 'running' }
  })
}
