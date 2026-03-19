import type { FastifyInstance } from 'fastify'
import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

interface TodoRow {
  id: string
  title: string
  completed: number
  archived: number
  sort_order: number
  created_at: number
  updated_at: number
}

export function registerTodoRoutes(app: FastifyInstance, db: Database) {
  // GET /api/todos — list active (non-archived) todos
  app.get('/api/todos', async (_req, reply) => {
    const todos = db.prepare(
      'SELECT * FROM todos WHERE archived = 0 ORDER BY sort_order ASC'
    ).all() as TodoRow[]
    return reply.send({ todos })
  })

  // POST /api/todos — create a new todo
  app.post<{ Body: { title: string } }>('/api/todos', async (req, reply) => {
    const title = req.body?.title?.trim()
    if (!title) return reply.code(400).send({ error: 'title is required' })
    const id = randomUUID()
    const now = Date.now()
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM todos WHERE archived = 0'
    ).get() as { m: number }
    const sort_order = maxOrder.m + 1

    db.prepare(
      'INSERT INTO todos (id, title, completed, archived, sort_order, created_at, updated_at) VALUES (?, ?, 0, 0, ?, ?, ?)'
    ).run(id, title, sort_order, now, now)

    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow
    return reply.code(201).send({ todo })
  })

  // PUT /api/todos/:id — update title or completed
  app.put<{ Params: { id: string }; Body: { title?: string; completed?: number } }>(
    '/api/todos/:id',
    async (req, reply) => {
      const { id } = req.params
      const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined
      if (!existing) return reply.code(404).send({ error: 'Not found' })

      const title = req.body.title ?? existing.title
      const completed = req.body.completed ?? existing.completed
      const now = Date.now()

      db.prepare(
        'UPDATE todos SET title = ?, completed = ?, updated_at = ? WHERE id = ?'
      ).run(title, completed, now, id)

      const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow
      return reply.send({ todo })
    }
  )

  // POST /api/todos/reorder — batch update sort order
  app.post<{ Body: { ids: string[] } }>('/api/todos/reorder', async (req, reply) => {
    const ids = req.body?.ids
    if (!Array.isArray(ids)) return reply.code(400).send({ error: 'ids must be an array' })
    const now = Date.now()
    const stmt = db.prepare('UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ?')
    const run = db.transaction(() => {
      ids.forEach((id, index) => {
        stmt.run(index + 1, now, id)
      })
    })
    run()
    return reply.send({ success: true })
  })

  // POST /api/todos/archive-completed — archive all completed items
  app.post('/api/todos/archive-completed', async (_req, reply) => {
    const now = Date.now()
    const result = db.prepare(
      'UPDATE todos SET archived = 1, updated_at = ? WHERE completed = 1 AND archived = 0'
    ).run(now)
    return reply.send({ archived: result.changes })
  })

  // DELETE /api/todos/:id — delete a single todo
  app.delete<{ Params: { id: string } }>('/api/todos/:id', async (req, reply) => {
    const { id } = req.params
    const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id)
    if (result.changes === 0) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send({ success: true })
  })
}
