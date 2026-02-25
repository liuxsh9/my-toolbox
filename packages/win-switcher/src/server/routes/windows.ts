import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import { windowListCache, permissionsCache } from '../cache.js'
import { listWindows, checkPermissions, focusWindow, focusByCwd, captureThumb, findTerminalWindowByPid } from '../services/native.js'

export function registerWindowsRoutes(app: FastifyInstance) {
  // GET /api/windows
  app.get('/api/windows', async (_req, reply) => {
    // Permissions (cached 30s)
    let permissions = permissionsCache.get()
    if (!permissions) {
      try {
        permissions = await checkPermissions()
        permissionsCache.set(permissions)
      } catch {
        permissions = { accessibility: false, screenRecording: false }
      }
    }

    // Window list (cached 5s)
    let windows = windowListCache.get()
    if (!windows) {
      try {
        windows = await listWindows()
        windowListCache.set(windows)
      } catch (err) {
        app.log.error(err, 'Failed to list windows')
        return reply.status(500).send({ error: 'Failed to list windows' })
      }
    }

    return { windows, permissions }
  })

  // GET /api/windows/:wid/thumb
  app.get<{ Params: { wid: string } }>('/api/windows/:wid/thumb', async (req, reply) => {
    const wid = parseInt(req.params.wid, 10)
    if (isNaN(wid)) return reply.status(400).send({ error: 'Invalid window id' })

    try {
      const filePath = await captureThumb(wid)
      const data = fs.readFileSync(filePath)
      return reply
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'no-store')
        .send(data)
    } catch {
      return reply.status(404).send({ error: 'Thumbnail unavailable' })
    }
  })

  // POST /api/windows/focus-by-pid
  app.post<{ Body: { pid?: number; cwd?: string } }>(
    '/api/windows/focus-by-pid',
    async (req, reply) => {
      const { pid, cwd } = req.body ?? {}
      if (typeof pid !== 'number') {
        return reply.status(400).send({ ok: false, error: 'pid (number) is required' })
      }

      const found = await findTerminalWindowByPid(pid, cwd)
      if ('error' in found) {
        return reply.status(404).send({ ok: false, error: found.error })
      }

      try {
        // If cwd is provided, use focus-by-cwd for precise window targeting (VS Code, Cursor, etc.)
        if (cwd) {
          const result = await focusByCwd(pid, cwd)
          return result
        }

        // Get window details for focus call
        const windows = await listWindows()
        const win = windows.find(w => w.id === found.windowId)
        if (!win) return reply.status(404).send({ ok: false, error: 'window_not_found' })

        await focusWindow(win.id, win.pid, win.title)
        return { ok: true, windowId: found.windowId, app: found.app }
      } catch (err) {
        app.log.error(err, 'Failed to focus window by pid')
        return reply.status(500).send({ ok: false, error: 'focus_failed' })
      }
    }
  )

  // POST /api/windows/:wid/focus
  app.post<{ Params: { wid: string }; Body: { pid?: number; title?: string } }>(
    '/api/windows/:wid/focus',
    async (req, reply) => {
      const wid = parseInt(req.params.wid, 10)
      const { pid, title } = req.body ?? {}
      if (isNaN(wid) || typeof pid !== 'number' || typeof title !== 'string') {
        return reply.status(400).send({ error: 'wid (url param), pid (number) and title (string) are required' })
      }

      try {
        const result = await focusWindow(wid, pid, title)
        if (result.ok === false) {
          return reply.status(404).send(result)
        }
        return result
      } catch (err) {
        app.log.error(err, 'Failed to focus window')
        return reply.status(500).send({ error: 'Failed to focus window' })
      }
    }
  )
}
