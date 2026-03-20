import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetch, ProxyAgent } from 'undici'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = path.resolve(__dirname, '../../..')
const DATA_DIR = path.join(PKG_ROOT, 'data')
const SESSION_FILE = path.join(DATA_DIR, 'session.json')

const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

// Day boundary hour — snapshots before this hour belong to the previous logical day
const DAY_BOUNDARY_HOUR = 6

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readCookie(): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
    return data.cookie || null
  } catch {
    return null
  }
}

function saveCookie(cookie: string) {
  ensureDataDir()
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookie }, null, 2))
}

/** Get the logical date for a timestamp — before 06:00 counts as previous day */
function logicalDate(ts: Date): string {
  const d = new Date(ts)
  if (d.getHours() < DAY_BOUNDARY_HOUR) {
    d.setDate(d.getDate() - 1)
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function registerQuotaRoutes(app: FastifyInstance, db: Database.Database) {
  const insertSnapshot = db.prepare(
    `INSERT INTO quota_snapshots (date, used, total, recorded_at) VALUES (?, ?, ?, ?)`
  )

  // Get all snapshots in a date range, ordered chronologically
  const getSnapshotsInRange = db.prepare(`
    SELECT used, total, recorded_at
    FROM quota_snapshots
    WHERE recorded_at >= ? AND recorded_at <= ?
    ORDER BY recorded_at ASC
  `)

  app.get('/api/session/status', async () => {
    const cookie = readCookie()
    return { configured: !!cookie }
  })

  app.put<{ Body: { cookie: string } }>('/api/session', async (req, reply) => {
    const { cookie } = req.body
    if (!cookie) {
      return reply.status(400).send({ ok: false, error: 'cookie is required' })
    }
    saveCookie(cookie)
    return { ok: true }
  })

  app.get('/api/quota', async (_req, reply) => {
    const cookie = readCookie()
    if (!cookie) {
      return reply.status(401).send({ ok: false, error: 'Cookie not configured' })
    }

    try {
      const res = await fetch('https://chat.nuoda.vip/frontend-api/vibe-code/quota', {
        headers: { cookie },
        ...(dispatcher ? { dispatcher } : {}),
      })

      if (!res.ok) {
        return reply.status(res.status).send({
          ok: false,
          error: `Upstream returned ${res.status}`,
        })
      }

      const data = await res.json()

      // Record snapshot on successful fetch
      try {
        const codex = (data as any)?.data?.codex
        const sub = codex?.subscriptions
        if (sub) {
          const used = sub.usedCount ?? 0
          const total = sub.limit ?? 0
          const now = new Date()
          insertSnapshot.run(logicalDate(now), used, total, now.toISOString())
        }
      } catch {
        // Non-critical — don't fail the main request
      }

      return { ok: true, data }
    } catch (err: any) {
      return reply.status(502).send({
        ok: false,
        error: err.message || 'Failed to fetch quota',
      })
    }
  })

  app.get<{ Querystring: { days?: string } }>('/api/quota/history', async (req) => {
    const days = Math.min(Math.max(parseInt(req.query.days || '7', 10) || 7, 1), 90)

    // Time range: from (days ago at 06:00) to now
    const now = new Date()
    const rangeStart = new Date(now)
    rangeStart.setDate(rangeStart.getDate() - days)
    rangeStart.setHours(DAY_BOUNDARY_HOUR, 0, 0, 0)

    const rows = getSnapshotsInRange.all(
      rangeStart.toISOString(),
      now.toISOString()
    ) as { used: number; total: number; recorded_at: string }[]

    // Walk all snapshots chronologically as a flat list.
    // For each consecutive pair, compute delta and assign to the later snapshot's logical date.
    // If used dropped (reset), the consumption before reset was already captured by previous diffs;
    // curr.used is the new usage since the reset point.
    // If used went up normally, delta = currUsed - prevUsed.
    //
    // Special case: when a logical day's first snapshot has no predecessor from the previous day,
    // the snapshot's used value itself represents consumption since the last provider reset.
    const usageByDay = new Map<string, number>()
    const totalByDay = new Map<string, number>()
    const seenDays = new Set<string>()

    for (let j = 0; j < rows.length; j++) {
      const curr = rows[j]
      const currDate = logicalDate(new Date(curr.recorded_at))
      totalByDay.set(currDate, curr.total)

      if (!seenDays.has(currDate)) {
        seenDays.add(currDate)
        if (j === 0) {
          // Very first snapshot ever — no prior day data.
          // Treat curr.used as already-consumed usage for this day.
          usageByDay.set(currDate, curr.used)
          continue
        }
        // First snapshot of a new logical day — check if previous snapshot is from a different day
        const prev = rows[j - 1]
        const prevDate = logicalDate(new Date(prev.recorded_at))
        if (prevDate !== currDate) {
          // Cross-day boundary: normal diff or reset detection applies below
        }
      }

      if (j === 0) continue

      const prev = rows[j - 1]
      let delta: number
      if (curr.used < prev.used) {
        // Reset detected: provider refreshed quota between these two snapshots.
        // The consumption before the reset was already captured by previous diffs.
        // curr.used is the new usage since the reset point.
        delta = curr.used
      } else {
        delta = curr.used - prev.used
      }

      if (delta > 0) {
        usageByDay.set(currDate, (usageByDay.get(currDate) ?? 0) + delta)
      }
    }

    // Generate result for the requested date range
    const todayLogical = logicalDate(now)
    const result: { date: string; used: number; total: number }[] = []

    for (let i = days; i >= 1; i--) {
      const dateStr = i === 1 ? todayLogical : (() => {
        const ref = new Date(now)
        ref.setDate(ref.getDate() - i + 1)
        ref.setHours(12, 0, 0, 0)
        return formatDate(ref)
      })()

      result.push({
        date: dateStr,
        used: usageByDay.get(dateStr) ?? 0,
        total: totalByDay.get(dateStr) ?? 0,
      })
    }

    return { ok: true, history: result }
  })
}
