import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SummaryCards } from './SummaryCards'
import { emitGlobalRefresh, __resetRefreshBusForTests } from '../refreshBus'

describe('SummaryCards', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    __resetRefreshBusForTests()
    vi.restoreAllMocks()
  })

  it('refetches stats when a global refresh is emitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total_effective_hours: 10,
        total_onsite_hours: 12,
        avg_effective_hours: 8,
        avg_start_time: '09:00',
        avg_end_time: '18:00',
      }),
    } as Response)
    global.fetch = fetchMock as typeof fetch

    render(<SummaryCards />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    emitGlobalRefresh('week')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })
  })
})
