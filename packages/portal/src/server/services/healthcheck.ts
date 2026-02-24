import type Database from 'better-sqlite3'

const CHECK_INTERVAL_MS = 60_000

interface ToolRow {
  name: string
  url: string
  health: string
}

export function startHealthChecker(db: Database.Database) {
  const getAllTools = db.prepare('SELECT name, url, health FROM tools') as Database.Statement<[], ToolRow>
  const updateHealthStatus = db.prepare(`
    UPDATE tools SET healthStatus = ?, updatedAt = datetime('now') WHERE name = ?
  `)

  async function checkAll() {
    let tools: ToolRow[]
    try {
      tools = getAllTools.all()
    } catch {
      return
    }

    for (const tool of tools) {
      const endpoint = tool.url.replace(/\/$/, '') + tool.health
      try {
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(5_000) })
        updateHealthStatus.run(res.ok ? 'healthy' : 'unhealthy', tool.name)
      } catch {
        updateHealthStatus.run('unhealthy', tool.name)
      }
    }
  }

  // Initial check after a short delay (let services start)
  setTimeout(checkAll, 5_000)
  setInterval(checkAll, CHECK_INTERVAL_MS)
}
