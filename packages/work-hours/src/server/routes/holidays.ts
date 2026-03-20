import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HolidayData, HolidayYear } from '../calculator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const holidaysPath = path.resolve(__dirname, '../../../data/holidays.json')

function readHolidays(): HolidayData {
  try {
    const raw = fs.readFileSync(holidaysPath, 'utf-8')
    return JSON.parse(raw) as HolidayData
  } catch {
    return {}
  }
}

function writeHolidays(data: HolidayData): void {
  fs.mkdirSync(path.dirname(holidaysPath), { recursive: true })
  fs.writeFileSync(holidaysPath, JSON.stringify(data, null, 2), 'utf-8')
}

export function registerHolidaysRoutes(app: FastifyInstance) {
  // GET /api/holidays/:year
  app.get<{ Params: { year: string } }>('/api/holidays/:year', async (req, reply) => {
    const { year } = req.params
    const data = readHolidays()
    const yearData = data[year]

    if (!yearData) {
      return reply.status(404).send({ error: `No holiday data for year ${year}` })
    }

    return yearData
  })

  // PUT /api/holidays/:year
  app.put<{ Params: { year: string }; Body: HolidayYear }>(
    '/api/holidays/:year',
    async (req, reply) => {
      const { year } = req.params
      const body = req.body

      if (!body || !Array.isArray(body.holidays) || !Array.isArray(body.adjusted_workdays)) {
        return reply
          .status(400)
          .send({ error: 'Body must include holidays[] and adjusted_workdays[]' })
      }

      const data = readHolidays()
      data[year] = {
        holidays: body.holidays,
        adjusted_workdays: body.adjusted_workdays,
      }
      writeHolidays(data)

      return { ok: true, year, data: data[year] }
    }
  )
}
