import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

interface Note {
  id: string
  content: string
  created_at: number
  updated_at: number
}

export function registerNotesRoutes(app: FastifyInstance, db: Database.Database) {
  // GET /api/notes — list all, sorted by updated_at desc
  app.get('/api/notes', async (_req, reply) => {
    const notes = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as Note[]
    return reply.send(notes)
  })

  // POST /api/notes — create
  app.post<{ Body: { content?: string } }>('/api/notes', async (req, reply) => {
    const content = req.body?.content ?? ''
    const now = Date.now()
    const id = randomUUID()
    db.prepare('INSERT INTO notes (id, content, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, content, now, now)
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note
    return reply.status(201).send(note)
  })

  // PUT /api/notes/:id — update content
  app.put<{ Params: { id: string }; Body: { content: string } }>('/api/notes/:id', async (req, reply) => {
    const { id } = req.params
    const { content } = req.body
    const now = Date.now()
    const result = db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?').run(content, now, id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Not found' })
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note
    return reply.send(note)
  })

  // DELETE /api/notes/:id
  app.delete<{ Params: { id: string } }>('/api/notes/:id', async (req, reply) => {
    const { id } = req.params
    const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.status(204).send()
  })
}
