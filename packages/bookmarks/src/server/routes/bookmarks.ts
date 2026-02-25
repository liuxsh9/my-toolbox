import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const screenshotsDir = path.resolve(__dirname, '../../../data/screenshots')

interface Bookmark {
  id: string
  title: string
  url: string
  category: string | null
  screenshot: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function registerBookmarksRoutes(app: FastifyInstance, db: Database.Database) {
  // GET /api/bookmarks
  app.get<{ Querystring: { category?: string } }>('/api/bookmarks', async (req) => {
    const { category } = req.query
    if (category) {
      return db
        .prepare('SELECT * FROM bookmarks WHERE category = ? ORDER BY sortOrder ASC, createdAt ASC')
        .all(category) as Bookmark[]
    }
    return db
      .prepare('SELECT * FROM bookmarks ORDER BY sortOrder ASC, createdAt ASC')
      .all() as Bookmark[]
  })

  // GET /api/bookmarks/categories
  app.get('/api/bookmarks/categories', async () => {
    const rows = db
      .prepare("SELECT DISTINCT category FROM bookmarks WHERE category IS NOT NULL AND category != '' ORDER BY category ASC")
      .all() as { category: string }[]
    return rows.map((r) => r.category)
  })

  // POST /api/bookmarks
  app.post<{ Body: { title?: string; url?: string; category?: string } }>(
    '/api/bookmarks',
    async (req, reply) => {
      const { title, url, category } = req.body ?? {}
      if (!title || !url) {
        return reply.status(400).send({ error: 'title and url are required' })
      }
      const id = randomUUID()
      const now = new Date().toISOString()
      const maxOrder = (
        db.prepare('SELECT MAX(sortOrder) as m FROM bookmarks').get() as { m: number | null }
      ).m ?? -1

      db.prepare(
        'INSERT INTO bookmarks (id, title, url, category, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, title, url, category ?? null, maxOrder + 1, now, now)

      return reply.status(201).send(db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id))
    }
  )

  // PATCH /api/bookmarks/reorder  — must be before /:id
  app.patch<{ Body: { items: { id: string; sortOrder: number }[] } }>(
    '/api/bookmarks/reorder',
    async (req, reply) => {
      const { items } = req.body ?? {}
      if (!Array.isArray(items)) {
        return reply.status(400).send({ error: 'items array required' })
      }
      const update = db.prepare('UPDATE bookmarks SET sortOrder = ?, updatedAt = ? WHERE id = ?')
      const now = new Date().toISOString()
      const tx = db.transaction(() => {
        for (const { id, sortOrder } of items) {
          update.run(sortOrder, now, id)
        }
      })
      tx()
      return { ok: true }
    }
  )

  // PATCH /api/bookmarks/:id
  app.patch<{ Params: { id: string }; Body: Partial<Omit<Bookmark, 'id' | 'createdAt'>> }>(
    '/api/bookmarks/:id',
    async (req, reply) => {
      const { id } = req.params
      const existing = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as Bookmark | undefined
      if (!existing) return reply.status(404).send({ error: 'Not found' })

      const { title, url, category, screenshot, sortOrder } = req.body ?? {}
      const now = new Date().toISOString()
      db.prepare(
        'UPDATE bookmarks SET title = ?, url = ?, category = ?, screenshot = ?, sortOrder = ?, updatedAt = ? WHERE id = ?'
      ).run(
        title ?? existing.title,
        url ?? existing.url,
        category !== undefined ? category : existing.category,
        screenshot !== undefined ? screenshot : existing.screenshot,
        sortOrder ?? existing.sortOrder,
        now,
        id
      )

      return db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id)
    }
  )

  // DELETE /api/bookmarks/:id
  app.delete<{ Params: { id: string } }>('/api/bookmarks/:id', async (req, reply) => {
    const { id } = req.params
    const existing = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as Bookmark | undefined
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    // Delete screenshot file if present
    if (existing.screenshot) {
      const filename = path.basename(existing.screenshot)
      const filePath = path.join(screenshotsDir, filename)
      try {
        fs.unlinkSync(filePath)
      } catch {
        // ignore if file already gone
      }
    }

    db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
    return reply.status(204).send()
  })
}
