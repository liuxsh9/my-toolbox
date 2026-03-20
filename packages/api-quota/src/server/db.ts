import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function initDb(): Database.Database {
  const dbPath = path.resolve(__dirname, '../../data/api-quota.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // Stores raw snapshots — the provider's cumulative "used" counter at a point in time.
  // Natural-day usage is computed by diffing: day_end.used - prev_day_end.used
  db.exec(`
    CREATE TABLE IF NOT EXISTS quota_snapshots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT NOT NULL,
      used        INTEGER NOT NULL,
      total       INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    )
  `)

  // Index for fast lookups by date
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_date ON quota_snapshots(date)
  `)

  return db
}
