import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function initDb(): Database.Database {
  const dbPath = path.resolve(__dirname, '../../data/work-hours.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      type      TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      work_day  TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_work_day ON events (work_day)
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_summary (
      work_day          TEXT PRIMARY KEY,
      first_active      TEXT,
      last_active       TEXT,
      raw_minutes       INTEGER,
      break_minutes     INTEGER,
      effective_minutes INTEGER,
      overtime_minutes  INTEGER,
      day_type          TEXT,
      source            TEXT DEFAULT 'auto'
    )
  `)

  return db
}
