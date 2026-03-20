import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://litellm:litellm_pass_2026@localhost:5432/litellm'
const REFRESH_MS = 3_000

interface Metrics { total: number; success: number; failed: number }

export interface AggregatedMetrics {
  allTime: Metrics
  today: Metrics
  last30m: Metrics
  rps: number
  lastUpdated: string
  ready: boolean
}

const ZERO: Metrics = { total: 0, success: 0, failed: 0 }
const EMPTY: AggregatedMetrics = { allTime: ZERO, today: ZERO, last30m: ZERO, rps: 0, lastUpdated: '', ready: false }

const SQL = `
SELECT
  COUNT(*)                                                    AS all_total,
  COUNT(*) FILTER (WHERE status = 'success')                  AS all_success,
  COUNT(*) FILTER (WHERE status != 'success' OR status IS NULL) AS all_failed,

  COUNT(*) FILTER (WHERE "startTime" >= (NOW() AT TIME ZONE 'UTC')::date)                                                    AS today_total,
  COUNT(*) FILTER (WHERE "startTime" >= (NOW() AT TIME ZONE 'UTC')::date AND status = 'success')                             AS today_success,
  COUNT(*) FILTER (WHERE "startTime" >= (NOW() AT TIME ZONE 'UTC')::date AND (status != 'success' OR status IS NULL))        AS today_failed,

  COUNT(*) FILTER (WHERE "startTime" >= NOW() AT TIME ZONE 'UTC' - INTERVAL '30 minutes')                                                    AS m30_total,
  COUNT(*) FILTER (WHERE "startTime" >= NOW() AT TIME ZONE 'UTC' - INTERVAL '30 minutes' AND status = 'success')                             AS m30_success,
  COUNT(*) FILTER (WHERE "startTime" >= NOW() AT TIME ZONE 'UTC' - INTERVAL '30 minutes' AND (status != 'success' OR status IS NULL))        AS m30_failed,

  COUNT(*) FILTER (WHERE "startTime" >= NOW() AT TIME ZONE 'UTC' - INTERVAL '10 seconds')  AS last_60s
FROM "LiteLLM_SpendLogs"
`

export class MetricsCollector {
  private pool: pg.Pool
  private cache: AggregatedMetrics = EMPTY
  private timer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 })
  }

  async initialize() {
    await this.refresh()
    this.timer = setInterval(() => this.refresh(), REFRESH_MS)
  }

  private async refresh() {
    try {
      const { rows } = await this.pool.query(SQL)
      const r = rows[0]
      this.cache = {
        allTime:  { total: +r.all_total,   success: +r.all_success,   failed: +r.all_failed },
        today:    { total: +r.today_total,  success: +r.today_success, failed: +r.today_failed },
        last30m:  { total: +r.m30_total,    success: +r.m30_success,   failed: +r.m30_failed },
        rps: +(+r.last_60s / 10).toFixed(2),
        lastUpdated: new Date().toISOString(),
        ready: true,
      }
    } catch (err) {
      console.error('Metrics refresh failed:', err)
    }
  }

  getMetrics(): AggregatedMetrics {
    return this.cache
  }

  async ensureFresh(): Promise<void> {
    if (!this.cache.lastUpdated) {
      await this.refresh()
    }
  }
}
