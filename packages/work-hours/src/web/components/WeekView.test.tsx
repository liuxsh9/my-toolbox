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

  const now = new Date()
  const monday = new Date(now)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const currentWeekUrl = `/api/days?from=${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}&to=${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`

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

    const refreshWriteResponse = Promise.resolve({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)

    let resolveRefreshRead: ((value: Response) => void) | null = null
    const refreshReadResponse = new Promise<Response>((resolve) => {
      resolveRefreshRead = resolve
    })

    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(refreshWriteResponse)
      .mockReturnValueOnce(refreshReadResponse)

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
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    expect(refreshButton).toBeDisabled()
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(currentWeekUrl)
    expect(fetchMock.mock.calls[1]?.[0]).toEqual('/api/today/refresh')
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({ method: 'POST' })
    expect(fetchMock.mock.calls[2]?.[0]).toEqual(fetchMock.mock.calls[0]?.[0])

    resolveRefreshRead?.({
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

  it('refreshes today before broadcasting when viewing the current week', async () => {
    const emitSpy = vi.spyOn(refreshBus, 'emitGlobalRefresh')
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/today/refresh') {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response
      }
      return {
        ok: true,
        json: async () => [],
      } as Response
    }) as typeof fetch

    render(<WeekView widget />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: '↻' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/today/refresh', { method: 'POST' })
    })

    await waitFor(() => {
      expect(emitSpy).toHaveBeenCalledWith('week')
    })
  })
})
