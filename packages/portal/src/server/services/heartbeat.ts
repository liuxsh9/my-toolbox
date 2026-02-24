import type Database from 'better-sqlite3'

const HEARTBEAT_TIMEOUT_MS = 90_000
const CHECK_INTERVAL_MS = 30_000

export function startHeartbeatChecker(db: Database.Database) {
  const markUnreachable = db.prepare(`
    UPDATE tools SET status = 'unreachable', updatedAt = datetime('now')
    WHERE lastHeartbeat IS NOT NULL
      AND status = 'running'
      AND source = 'remote'
      AND (julianday('now') - julianday(lastHeartbeat)) * 86400000 > ?
  `)

  setInterval(() => {
    try {
      markUnreachable.run(HEARTBEAT_TIMEOUT_MS)
    } catch (err) {
      console.warn('[heartbeat-checker] Error:', err)
    }
  }, CHECK_INTERVAL_MS)
}
