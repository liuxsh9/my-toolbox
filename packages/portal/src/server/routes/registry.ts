import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { getPm2Status } from '../services/pm2.js'

interface RegisterBody {
  name: string
  displayName: string
  description?: string
  version?: string
  url: string
  health?: string
  icon?: string
  category?: string
  pm2Name?: string
}

function parseWidgetConfig(tool: Record<string, unknown>): Record<string, unknown> {
  if (tool.widgetConfig && typeof tool.widgetConfig === 'string') {
    try {
      tool.widget = JSON.parse(tool.widgetConfig)
    } catch { /* ignore */ }
  }
  delete tool.widgetConfig
  return tool
}

export function registerRoutes(app: FastifyInstance, db: Database.Database) {
  const upsertTool = db.prepare(`
    INSERT INTO tools (name, displayName, description, version, url, health, icon, category, pm2Name, status, source, lastHeartbeat, updatedAt)
    VALUES (@name, @displayName, @description, @version, @url, @health, @icon, @category, @pm2Name, 'running', @source, datetime('now'), datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      displayName = @displayName,
      description = @description,
      version = @version,
      url = @url,
      health = @health,
      icon = @icon,
      category = @category,
      pm2Name = @pm2Name,
      status = 'running',
      lastHeartbeat = datetime('now'),
      updatedAt = datetime('now')
  `)

  const updateHeartbeat = db.prepare(`
    UPDATE tools SET lastHeartbeat = datetime('now'), status = 'running', updatedAt = datetime('now')
    WHERE name = ?
  `)

  const getAllTools = db.prepare('SELECT * FROM tools ORDER BY createdAt ASC')
  const getToolByName = db.prepare('SELECT * FROM tools WHERE name = ?')
  const deleteTool = db.prepare('DELETE FROM tools WHERE name = ?')

  // POST /api/tools/register
  app.post<{ Body: RegisterBody }>('/api/tools/register', async (req, reply) => {
    const body = req.body
    if (!body.name || !body.url) {
      return reply.status(400).send({ ok: false, error: 'Missing required fields: name, url' })
    }

    const existing = getToolByName.get(body.name)
    upsertTool.run({
      name: body.name,
      displayName: body.displayName || body.name,
      description: body.description || '',
      version: body.version || '0.0.0',
      url: body.url,
      health: body.health || '/api/health',
      icon: body.icon || null,
      category: body.category || null,
      pm2Name: body.pm2Name || null,
      source: 'remote',
    })

    const status = existing ? 200 : 201
    return reply.status(status).send({ ok: true, data: getToolByName.get(body.name) })
  })

  // PUT /api/tools/:name/heartbeat
  app.put<{ Params: { name: string } }>('/api/tools/:name/heartbeat', async (req, reply) => {
    const { name } = req.params
    const tool = getToolByName.get(name)
    if (!tool) {
      return reply.status(404).send({ ok: false, error: `Tool '${name}' not found` })
    }
    updateHeartbeat.run(name)
    return { ok: true }
  })

  // GET /api/tools
  app.get('/api/tools', async () => {
    const tools = getAllTools.all() as Record<string, unknown>[]
    return { ok: true, data: tools.map(parseWidgetConfig) }
  })

  // GET /api/tools/:name
  app.get<{ Params: { name: string } }>('/api/tools/:name', async (req, reply) => {
    const { name } = req.params
    const tool = getToolByName.get(name) as Record<string, unknown> | undefined
    if (!tool) {
      return reply.status(404).send({ ok: false, error: `Tool '${name}' not found` })
    }

    // Enrich with PM2 status if pm2Name is set
    if (tool.pm2Name) {
      try {
        tool.pm2Status = await getPm2Status(tool.pm2Name as string)
      } catch {
        tool.pm2Status = null
      }
    }

    return { ok: true, data: parseWidgetConfig(tool) }
  })

  // DELETE /api/tools/:name
  app.delete<{ Params: { name: string } }>('/api/tools/:name', async (req, reply) => {
    const { name } = req.params
    const tool = getToolByName.get(name)
    if (!tool) {
      return reply.status(404).send({ ok: false, error: `Tool '${name}' not found` })
    }
    deleteTool.run(name)
    return { ok: true }
  })
}
