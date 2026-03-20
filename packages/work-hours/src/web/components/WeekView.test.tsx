import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WeekView } from './WeekView'
import * as refreshBus from '../refreshBus'

vi.mock('recharts', () => {
  const Mock = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Mock,
    BarChart: Mock,
    Bar: Mock,
    XAxis: Mock,
    YAxis: Mock,
    ReferenceLine: Mock,
    Tooltip: Mock,
  }
})

describe('WeekView', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    refreshBus.__resetRefreshBusForTests()
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('shows a refresh button and refetches the current week when clicked', async () => {
    const firstResponse = Promise.resolve({
      ok: true,
      json: async () => [],
    } as Response)

    let resolveRefresh: ((value: Response) => void) | null = null
    const secondResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve
    })

    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse)

    global.fetch = fetchMock as typeof fetch

    render(<WeekView widget />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    const refreshButton = screen.getByRole('button', { name: '↻' })
    expect(refreshButton).toBeInTheDocument()
    expect(refreshButton).not.toBeDisabled()

    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(refreshButton).toBeDisabled()
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(fetchMock.mock.calls[1]?.[0])

    resolveRefresh?.({
      ok: true,
      json: async () => [],
    } as Response)

    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled()
    })
  })

  it('emits a global refresh event when the refresh button is clicked', async () => {
    const emitSpy = vi.spyOn(refreshBus, 'emitGlobalRefresh')
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response) as typeof fetch

    render(<WeekView widget />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: '↻' }))

    await waitFor(() => {
      expect(emitSpy).toHaveBeenCalledWith('week')
    })
  })
})
