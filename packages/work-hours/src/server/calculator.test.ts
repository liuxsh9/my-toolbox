import { describe, expect, it } from 'vitest'
import { calculateDay, type Event } from './calculator'

describe('calculateDay', () => {
  it('keeps idle-derived last_active when a later auto screen lock occurs', () => {
    const events: Event[] = [
      { type: 'screen_unlock', timestamp: '2026-03-25T09:00:00+08:00', work_day: '2026-03-25' },
      { type: 'idle_start', timestamp: '2026-03-25T22:15:00+08:00', work_day: '2026-03-25' },
      { type: 'screen_lock', timestamp: '2026-03-25T23:00:00+08:00', work_day: '2026-03-25' },
    ]

    const summary = calculateDay(events, 'workday')

    expect(summary.last_active).toBe('2026-03-25T14:10:00.000Z')
  })
})
