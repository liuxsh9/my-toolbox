type RefreshEvent = {
  id: string
  source?: string
  at: number
}

type Listener = (event: RefreshEvent) => void | Promise<void>

const CHANNEL_NAME = 'work-hours-refresh'
const listeners = new Set<Listener>()
let channel: BroadcastChannel | null = null

function createEvent(source?: string): RefreshEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    source,
    at: Date.now(),
  }
}

function notify(event: RefreshEvent) {
  for (const listener of listeners) {
    void listener(event)
  }
}

function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (message: MessageEvent<RefreshEvent>) => {
      if (message.data?.id) notify(message.data)
    }
  }
  return channel
}

export function emitGlobalRefresh(source?: string) {
  const event = createEvent(source)
  notify(event)
  getChannel()?.postMessage(event)
  return event
}

export function subscribeGlobalRefresh(listener: Listener) {
  listeners.add(listener)
  getChannel()
  return () => {
    listeners.delete(listener)
  }
}

export function __resetRefreshBusForTests() {
  listeners.clear()
  if (channel) {
    channel.close()
    channel = null
  }
}
