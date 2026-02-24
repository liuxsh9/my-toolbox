import type Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function startDiscovery(db: Database.Database) {
  // Find the monorepo packages directory relative to this file
  // This file is at packages/portal/src/server/services/discovery.ts
  // packages/ is 4 levels up
  const packagesDir = path.resolve(__dirname, '../../../../')

  const upsertTool = db.prepare(`
    INSERT INTO tools (name, displayName, description, version, url, health, icon, category, pm2Name, status, source, lastHeartbeat, updatedAt)
    VALUES (@name, @displayName, @description, @version, @url, @health, @icon, @category, @pm2Name, 'running', 'local', datetime('now'), datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      displayName = @displayName,
      description = @description,
      version = @version,
      url = @url,
      health = @health,
      icon = @icon,
      category = @category,
      pm2Name = @pm2Name,
      source = 'local',
      updatedAt = datetime('now')
  `)

  try {
    const entries = fs.readdirSync(packagesDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const manifestPath = path.join(packagesDir, entry.name, 'tool.yaml')
      if (!fs.existsSync(manifestPath)) continue

      try {
        const content = fs.readFileSync(manifestPath, 'utf-8')
        const manifest = yaml.load(content) as Record<string, unknown>
        if (!manifest.name || !manifest.url) continue

        upsertTool.run({
          name: manifest.name as string,
          displayName: (manifest.displayName || manifest.name) as string,
          description: (manifest.description || '') as string,
          version: (manifest.version || '0.0.0') as string,
          url: manifest.url as string,
          health: (manifest.health || '/api/health') as string,
          icon: (manifest.icon || null) as string | null,
          category: (manifest.category || null) as string | null,
          pm2Name: (manifest.pm2Name || null) as string | null,
        })
        console.log(`[discovery] Registered local tool: ${manifest.name}`)
      } catch (err) {
        console.warn(`[discovery] Failed to parse ${manifestPath}:`, err)
      }
    }
  } catch (err) {
    console.warn('[discovery] Failed to scan packages directory:', err)
  }
}
