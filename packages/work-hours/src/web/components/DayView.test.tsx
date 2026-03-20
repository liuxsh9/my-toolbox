import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DayView } from './DayView'
import * as refreshBus from '../refreshBus'

vi.mock('./EditModal', () => ({
  EditModal: () => null,
}))

describe('DayView', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    refreshBus.__resetRefreshBusForTests()
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('broadcasts a global refresh after today refresh succeeds', async () => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const emitSpy = vi.spyOn(refreshBus, 'emitGlobalRefresh')

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: {
            work_day: todayStr,
            first_active: '09:00',
            last_active: '18:00',
            raw_minutes: 540,
            break_minutes: 60,
            effective_minutes: 480,
            overtime_minutes: 0,
            day_type: 'workday',
            source: 'auto',
          },
          events: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response) as typeof fetch

    render(<DayView initialDate={todayStr} widget />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: '↻' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/today/refresh', { method: 'POST' })
    })

    await waitFor(() => {
      expect(emitSpy).toHaveBeenCalledWith('day')
    })
  })
})
