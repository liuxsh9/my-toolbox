import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function initDb(): Database.Database {
  const dbPath = path.resolve(__dirname, '../../data/portal.db')

  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      name TEXT PRIMARY KEY,
      displayName TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '0.0.0',
      url TEXT NOT NULL,
      health TEXT NOT NULL DEFAULT '/api/health',
      icon TEXT,
      category TEXT,
      pm2Name TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      source TEXT NOT NULL DEFAULT 'remote',
      lastHeartbeat TEXT,
      healthStatus TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  return db
}
