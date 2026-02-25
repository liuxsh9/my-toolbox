import type { FastifyReply } from 'fastify'

type Subscriber = FastifyReply

const subscribers = new Set<Subscriber>()

export function subscribe(reply: Subscriber): void {
  subscribers.add(reply)
  reply.raw.on('close', () => subscribers.delete(reply))
}

export function broadcast(event: string, data?: unknown): void {
  const payload = data !== undefined ? `event: ${event}\ndata: ${JSON.stringify(data)}\n\n` : `event: ${event}\ndata: {}\n\n`
  for (const reply of subscribers) {
    try {
      reply.raw.write(payload)
    } catch {
      subscribers.delete(reply)
    }
  }
}
