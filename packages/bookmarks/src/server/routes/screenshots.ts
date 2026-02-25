import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchOgImage } from '../services/screenshot.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const screenshotsDir = path.resolve(__dirname, '../../../data/screenshots')

interface Bookmark {
  id: string
  screenshot: string | null
}

export function registerScreenshotRoutes(app: FastifyInstance, db: Database.Database) {
  // POST /api/bookmarks/:id/fetch-screenshot
  app.post<{ Params: { id: string }; Body: { url?: string } }>(
    '/api/bookmarks/:id/fetch-screenshot',
    async (req, reply) => {
      const { id } = req.params
      const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as Bookmark | undefined
      if (!bookmark) return reply.status(404).send({ error: 'Not found' })

      const url = (req.body as { url?: string })?.url
      if (!url) return reply.status(400).send({ error: 'url is required' })

      const result = await fetchOgImage(url)

      if (result.screenshotUrl) {
        // Delete old screenshot file if exists
        if (bookmark.screenshot) {
          const oldPath = path.join(screenshotsDir, path.basename(bookmark.screenshot))
          try { fs.unlinkSync(oldPath) } catch { /* ignore */ }
        }
        db.prepare('UPDATE bookmarks SET screenshot = ?, updatedAt = ? WHERE id = ?').run(
          result.screenshotUrl,
          new Date().toISOString(),
          id
        )
        return { screenshotUrl: result.screenshotUrl }
      }

      return { screenshotUrl: null, reason: result.reason }
    }
  )

  // POST /api/bookmarks/:id/upload-screenshot
  app.post<{ Params: { id: string } }>('/api/bookmarks/:id/upload-screenshot', async (req, reply) => {
    const { id } = req.params
    const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as Bookmark | undefined
    if (!bookmark) return reply.status(404).send({ error: 'Not found' })

    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const mime = data.mimetype
    if (!mime.startsWith('image/')) {
      return reply.status(400).send({ error: 'Only image files are accepted' })
    }

    const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg'
    const filename = `${randomUUID()}.${ext}`
    fs.mkdirSync(screenshotsDir, { recursive: true })
    const filePath = path.join(screenshotsDir, filename)

    // Delete old screenshot if exists
    if (bookmark.screenshot) {
      const oldPath = path.join(screenshotsDir, path.basename(bookmark.screenshot))
      try { fs.unlinkSync(oldPath) } catch { /* ignore */ }
    }

    const buffer = await data.toBuffer()
    fs.writeFileSync(filePath, buffer)

    const screenshotUrl = `/screenshots/${filename}`
    db.prepare('UPDATE bookmarks SET screenshot = ?, updatedAt = ? WHERE id = ?').run(
      screenshotUrl,
      new Date().toISOString(),
      id
    )

    return { screenshotUrl }
  })
}
