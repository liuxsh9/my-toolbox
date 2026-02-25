import { randomUUID } from 'node:crypto'

export interface Notification {
  id: string
  title: string
  body: string
  source: string
  url?: string
  createdAt: string
}

const store = new Map<string, Notification>()

export function add(data: Omit<Notification, 'id' | 'createdAt'>): Notification {
  const notification: Notification = {
    id: randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
  }
  store.set(notification.id, notification)
  return notification
}

export function remove(id: string): boolean {
  return store.delete(id)
}

export function clear(): void {
  store.clear()
}

export function getAll(): Notification[] {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}
