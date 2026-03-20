import fastifyStatic from '@fastify/static'
import type { FastifyInstance } from 'fastify'
import path from 'node:path'

export async function registerSpaStatic(app: FastifyInstance, webDir: string) {
  await app.register(fastifyStatic, {
    root: webDir,
    prefix: '/',
  })

  app.setNotFoundHandler((req, reply) => {
    const pathname = new URL(req.raw.url ?? '/', 'http://localhost').pathname

    if (pathname.startsWith('/api/') || path.extname(pathname)) {
      return reply.status(404).send({ error: 'Not found' })
    }

    return reply.sendFile('index.html', webDir)
  })
}
