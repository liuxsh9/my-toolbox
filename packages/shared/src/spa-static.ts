import fastifyStatic from '@fastify/static'
import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'

function isSpaDocumentPath(pathname: string) {
  if (pathname === '/' || pathname === '') return true
  if (pathname.startsWith('/api/')) return false
  if (path.extname(pathname)) return false
  return true
}

export async function registerSpaStatic(app: FastifyInstance, webDir: string) {
  await app.register(fastifyStatic, {
    root: webDir,
    prefix: '/',
  })

  app.setNotFoundHandler((req, reply) => {
    const pathname = new URL(req.raw.url ?? '/', 'http://localhost').pathname

    if (!isSpaDocumentPath(pathname)) {
      return reply.status(404).send({ error: 'Not found' })
    }

    return reply
      .type('text/html; charset=utf-8')
      .send(fs.createReadStream(path.join(webDir, 'index.html')))
  })
}
