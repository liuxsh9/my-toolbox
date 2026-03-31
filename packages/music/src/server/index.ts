import Fastify from 'fastify'
import cors from '@fastify/cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { registerTool, registerSpaStatic } from '@my-toolbox/shared'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3010', 10)
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'

// MARK: - Types

interface NowPlayingState {
  type: 'nowPlaying'
  inactive?: boolean
  title?: string
  artist?: string
  album?: string
  duration?: number
  elapsed?: number
  rate?: number
  artworkBase64?: string
}

interface CommandResult {
  type: 'commandResult'
  command: string | number
  success: boolean
}

type SwiftEvent = NowPlayingState | CommandResult

// MARK: - Swift Process Manager

let swiftProcess: ChildProcess | null = null
let currentTrack: NowPlayingState = { type: 'nowPlaying', inactive: true }
const sseClients: Set<{ reply: any }> = new Set()

function startSwiftHelper() {
  const swiftPath = path.resolve(__dirname, '../../src/native/music-helper.swift')

  swiftProcess = spawn('swift', [swiftPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  swiftProcess.on('exit', (code) => {
    console.error(`Swift helper exited with code ${code}, restarting in 3s...`)
    swiftProcess = null
    setTimeout(startSwiftHelper, 3000)
  })

  swiftProcess.on('error', (err) => {
    console.error(`Swift helper error: ${err.message}`)
    swiftProcess = null
  })

  if (swiftProcess.stdout) {
    const rl = createInterface({ input: swiftProcess.stdout })
    rl.on('line', (line) => {
      try {
        const event = JSON.parse(line) as SwiftEvent
        if (event.type === 'nowPlaying') {
          currentTrack = event
          broadcastSSE(event)
        }
      } catch {
        console.error(`Failed to parse Swift output: ${line}`)
      }
    })
  }

  if (swiftProcess.stderr) {
    swiftProcess.stderr.on('data', (data: Buffer) => {
      console.error(`Swift stderr: ${data.toString().trim()}`)
    })
  }
}

function sendCommand(command: string) {
  if (!swiftProcess || !swiftProcess.stdin) {
    throw new Error('Swift helper not running')
  }
  const msg = JSON.stringify({ command }) + '\n'
  swiftProcess.stdin.write(msg)
}

function broadcastSSE(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const client of sseClients) {
    try {
      client.reply.raw.write(payload)
    } catch {
      sseClients.delete(client)
    }
  }
}

// MARK: - Server

async function main() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  // Health
  app.get('/api/health', async () => ({
    status: 'ok',
    swift: swiftProcess !== null && !swiftProcess.killed,
  }))

  // Current track
  app.get('/api/now-playing', async () => currentTrack)

  // Control commands
  app.post('/api/control', async (req) => {
    const { action } = req.body as { action: string }
    if (!['toggle', 'next', 'prev', 'open'].includes(action)) {
      return { ok: false, error: 'Invalid action' }
    }
    sendCommand(action)
    return { ok: true }
  })

  // SSE endpoint
  app.get('/api/events', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const client = { reply }
    sseClients.add(client)

    // Send current state immediately
    reply.raw.write(`data: ${JSON.stringify(currentTrack)}\n\n`)

    req.raw.on('close', () => {
      sseClients.delete(client)
    })
  })

  // Serve frontend SPA in production
  const webDir = path.resolve(__dirname, '../web')
  try {
    await registerSpaStatic(app, webDir)
  } catch {
    app.log.warn('No built frontend found — skipping static file serving')
  }

  await app.listen({ port: PORT, host: '0.0.0.0' })

  // Start Swift helper after server is listening
  startSwiftHelper()

  registerTool({
    portalUrl: PORTAL_URL,
    manifest: {
      name: 'music',
      displayName: 'Music',
      description: '网易云音乐控制器',
      version: '0.1.0',
      url: `http://localhost:${PORT}`,
      health: '/api/health',
      pm2Name: 'music',
    },
  })

  app.log.info(`Music running at http://localhost:${PORT}`)

  // Cleanup
  const cleanup = () => {
    if (swiftProcess && !swiftProcess.killed) {
      swiftProcess.kill()
    }
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', cleanup)
}

main().catch((err) => {
  console.error('Failed to start Music:', err)
  process.exit(1)
})
