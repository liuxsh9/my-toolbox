import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetRefreshBusForTests, emitGlobalRefresh, subscribeGlobalRefresh } from './refreshBus'

class MockBroadcastChannel {
  static channels = new Map<string, Set<MockBroadcastChannel>>()

  name: string
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(name: string) {
    this.name = name
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set())
    }
    MockBroadcastChannel.channels.get(name)!.add(this)
  }

  postMessage(data: unknown) {
    for (const channel of MockBroadcastChannel.channels.get(this.name) ?? []) {
      if (channel !== this && channel.onmessage) {
        channel.onmessage({ data } as MessageEvent)
      }
    }
  }

  close() {
    MockBroadcastChannel.channels.get(this.name)?.delete(this)
  }

  static reset() {
    MockBroadcastChannel.channels.clear()
  }
}

describe('refreshBus', () => {
  afterEach(() => {
    __resetRefreshBusForTests()
    MockBroadcastChannel.reset()
    vi.unstubAllGlobals()
  })

  it('notifies same-instance subscribers when a refresh is emitted', () => {
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    const listener = vi.fn()
    const unsubscribe = subscribeGlobalRefresh(listener)

    emitGlobalRefresh('week')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ source: 'week' })

    unsubscribe()
  })

  it('delivers refresh messages from another BroadcastChannel instance', () => {
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    const listener = vi.fn()
    subscribeGlobalRefresh(listener)

    const foreignChannel = new MockBroadcastChannel('work-hours-refresh')
    foreignChannel.postMessage({ id: 'foreign-1', source: 'external', at: Date.now() })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ id: 'foreign-1', source: 'external' })
  })
})
