# Music Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NetEase Cloud Music controller widget for the My Toolbox portal with playback controls, track info, album art, and progress bar.

**Architecture:** Swift helper script polls MediaRemote framework every 3s, outputs JSON to stdout. Node.js server spawns Swift process, exposes REST + SSE APIs. React widget displays horizontal layout with cover art, track info, progress bar, and controls.

**Tech Stack:** Swift (MediaRemote private framework), Node.js + Fastify, React + Vite, SSE for real-time updates.

**Port:** 3010 (server), 5183 (Vite dev). **PM2 name:** `music`.

---

## Task 1: Package Scaffold

Create all boilerplate files for `packages/music`.

**Files:**
- Create: `packages/music/package.json`
- Create: `packages/music/tool.yaml`
- Create: `packages/music/tsconfig.server.json`
- Create: `packages/music/src/web/vite.config.ts`
- Create: `packages/music/src/web/index.html`
- Create: `packages/music/src/web/index.css`
- Create: `packages/music/src/web/main.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@my-toolbox/music",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:web\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:web": "vite --config src/web/vite.config.ts",
    "build": "tsc -p tsconfig.server.json && vite build --config src/web/vite.config.ts",
    "start": "node dist/server/index.js"
  },
  "dependencies": {
    "@my-toolbox/shared": "workspace:*",
    "fastify": "^5.2.0",
    "@fastify/static": "^8.1.0",
    "@fastify/cors": "^11.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "concurrently": "^9.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.2.0"
  }
}
```

- [ ] **Step 2: Create tool.yaml**

```yaml
name: music
displayName: Music
description: 网易云音乐控制器
version: 0.1.0
url: http://localhost:3010
health: /api/health
pm2Name: music
category: media
widget:
  minW: 3
  minH: 2
  defaultW: 4
  defaultH: 2
```

- [ ] **Step 3: Create tsconfig.server.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist/server",
    "rootDir": "src/server"
  },
  "include": ["src/server"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, '../../dist/web'),
    emptyOutDir: true,
  },
  server: {
    port: 5183,
    proxy: {
      '/api': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Music</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create index.css**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg:       #1a1816;
  --surface:  #221f17;
  --surface2: #2a2720;
  --border:   rgba(255,255,255,0.09);
  --border2:  rgba(255,255,255,0.05);
  --text-1:   #ede8de;
  --text-2:   #8c8680;
  --text-3:   #4a4844;
  --accent:   #d4a040;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
}

body {
  background: var(--bg);
  color: var(--text-1);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

#root {
  display: flex;
  flex-direction: column;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-3); }
```

- [ ] **Step 7: Create main.tsx**

```typescript
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

const root = document.getElementById('root')!
createRoot(root).render(<App />)
```

- [ ] **Step 8: Run pnpm install**

```bash
cd /Users/lxs/code/my-toolbox && pnpm install
```

Expected: Dependencies installed, workspace link created.

- [ ] **Step 9: Commit scaffold**

```bash
git add packages/music/package.json packages/music/tool.yaml packages/music/tsconfig.server.json packages/music/src/web/vite.config.ts packages/music/src/web/index.html packages/music/src/web/index.css packages/music/src/web/main.tsx pnpm-lock.yaml
git commit -m "feat(music): scaffold package structure"
```

---

## Task 2: Swift Helper (music-helper.swift)

MediaRemote integration for reading now-playing info and sending control commands. Uses 3-second polling (proven reliable, matches work-hours pattern).

**Files:**
- Create: `packages/music/src/native/music-helper.swift`

- [ ] **Step 1: Create music-helper.swift**

```swift
#!/usr/bin/env swift
// music-helper.swift — NetEase Cloud Music controller via MediaRemote
// Polls now-playing info every 3s, accepts JSON commands on stdin

import Foundation

// MARK: - MediaRemote Framework Loading

let mediaRemotePath = "/System/Library/PrivateFrameworks/MediaRemote.framework/Versions/A/MediaRemote"
guard let handle = dlopen(mediaRemotePath, RTLD_LAZY) else {
    fputs("ERROR: Failed to load MediaRemote framework\n", stderr)
    exit(1)
}

func loadSymbol<T>(_ name: String) -> T {
    guard let sym = dlsym(handle, name) else {
        fputs("ERROR: Symbol not found: \(name)\n", stderr)
        exit(1)
    }
    return unsafeBitCast(sym, to: T.self)
}

// MARK: - MediaRemote Function Declarations

typealias GetNowPlayingClientFunc = @convention(c) (DispatchQueue, @escaping (Any?) -> Void) -> Void
typealias GetNowPlayingInfoFunc = @convention(c) (DispatchQueue, @escaping (Dictionary<String, Any>?) -> Void) -> Void
typealias SendCommandFunc = @convention(c) (Int, Any?, @escaping (Any?) -> Void) -> Void
typealias RegisterForNotificationsFunc = @convention(c) (AnyClass) -> Void

let MRMediaRemoteGetNowPlayingClient = loadSymbol<GetNowPlayingClientFunc>("MRMediaRemoteGetNowPlayingClient")
let MRMediaRemoteGetNowPlayingInfo = loadSymbol<GetNowPlayingInfoFunc>("MRMediaRemoteGetNowPlayingInfo")
let MRMediaRemoteSendCommand = loadSymbol<SendCommandFunc>("MRMediaRemoteSendCommand")
let MRMediaRemoteRegisterForNowPlayingNotifications = loadSymbol<RegisterForNotificationsFunc>("MRMediaRemoteRegisterForNowPlayingNotifications")

// Command IDs
let kMRMediaRemoteCommandPlayPause = 3
let kMRMediaRemoteCommandNextTrack = 4
let kMRMediaRemoteCommandPreviousTrack = 5

// Info keys
let kMRTitle = "kMRMediaRemoteNowPlayingInfoTitle"
let kMRArtist = "kMRMediaRemoteNowPlayingInfoArtist"
let kMRAlbum = "kMRMediaRemoteNowPlayingInfoAlbum"
let kMRDuration = "kMRMediaRemoteNowPlayingInfoDuration"
let kMRElapsed = "kMRMediaRemoteNowPlayingInfoElapsedTime"
let kMRRate = "kMRMediaRemoteNowPlayingInfoPlaybackRate"
let kMRArtworkData = "kMRMediaRemoteNowPlayingInfoArtworkData"

// MARK: - State

var lastOutputHash: String = ""
let neteaseBundleId = "com.netease.163music"

// MARK: - Output

func output(_ dict: [String: Any]) {
    do {
        let data = try JSONSerialization.data(withJSONObject: dict)
        if let str = String(data: data, encoding: .utf8) {
            print(str)
            fflush(stdout)
        }
    } catch {
        fputs("JSON encode error: \(error)\n", stderr)
    }
}

// MARK: - Get Now Playing Info

func fetchAndOutput() {
    let group = DispatchGroup()

    var currentBundleId: String? = nil
    var nowPlayingInfo: Dictionary<String, Any>? = nil

    group.enter()
    MRMediaRemoteGetNowPlayingClient(DispatchQueue.global()) { client in
        if let client = client {
            let mirror = Mirror(reflecting: client)
            // client is an MRNowPlayingClient - try to get bundleIdentifier
            // The client object responds to bundleIdentifier selector
            let sel = Selector(("bundleIdentifier"))
            if client.responds(to: sel) {
                let val = client.perform(sel)
                currentBundleId = val?.takeUnretainedValue() as? String
            }
        }
        group.leave()
    }

    group.enter()
    MRMediaRemoteGetNowPlayingInfo(DispatchQueue.global()) { info in
        nowPlayingInfo = info
        group.leave()
    }

    group.notify(queue: .global()) {
        guard currentBundleId == neteaseBundleId else {
            let hash = "inactive"
            if hash != lastOutputHash {
                lastOutputHash = hash
                output(["type": "nowPlaying", "inactive": true])
            }
            return
        }

        guard let info = nowPlayingInfo else {
            let hash = "no-info"
            if hash != lastOutputHash {
                lastOutputHash = hash
                output(["type": "nowPlaying", "inactive": true])
            }
            return
        }

        let title = info[kMRTitle] as? String ?? ""
        let artist = info[kMRArtist] as? String ?? ""
        let album = info[kMRAlbum] as? String ?? ""
        let duration = info[kMRDuration] as? Double ?? 0
        let elapsed = info[kMRElapsed] as? Double ?? 0
        let rate = info[kMRRate] as? Int ?? 0
        let artworkData = info[kMRArtworkData] as? Data
        let artworkBase64 = artworkData?.base64EncodedString()

        // Hash for change detection (title + rate + rounded elapsed)
        let elapsedRound = Int(elapsed)
        let hash = "\(title)|\(artist)|\(rate)|\(elapsedRound)"

        if hash != lastOutputHash {
            lastOutputHash = hash
            output([
                "type": "nowPlaying",
                "title": title,
                "artist": artist,
                "album": album,
                "duration": duration,
                "elapsed": elapsed,
                "rate": rate,
                "artworkBase64": artworkBase64 as Any,
            ] as [String: Any])
        }
    }
}

// MARK: - Send Command

func sendCommand(_ commandId: Int) {
    MRMediaRemoteSendCommand(commandId, nil) { _ in
        output(["type": "commandResult", "command": commandId, "success": true])
        // Refresh info after command
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            lastOutputHash = ""  // Force output
            fetchAndOutput()
        }
    }
}

// MARK: - Open NetEase

func openNetease() {
    let workspace = NSWorkspace.shared
    if let appURL = workspace.urlForApplication(withBundleIdentifier: neteaseBundleId) {
        workspace.openApplication(at: appURL, configuration: NSWorkspace.OpenConfiguration(), completionHandler: nil)
        output(["type": "commandResult", "command": "open", "success": true])
    } else {
        output(["type": "commandResult", "command": "open", "success": false])
    }
}

// MARK: - Stdin Command Reader

func setupStdinReader() {
    let stdinStream = FileHandle.standardInput
    stdinStream.waitForDataInBackgroundAndNotify()

    NotificationCenter.default.addObserver(
        forName: NSNotification.Name.NSFileHandleDataAvailable,
        object: stdinStream,
        queue: .main
    ) { _ in
        let data = stdinStream.availableData
        if data.count == 0 {
            // EOF — parent process closed
            exit(0)
        }
        if let line = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
           let lineData = line.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: lineData) as? [String: Any],
           let command = json["command"] as? String {

            switch command {
            case "info":
                lastOutputHash = ""
                fetchAndOutput()
            case "toggle":
                sendCommand(kMRMediaRemoteCommandPlayPause)
            case "next":
                sendCommand(kMRMediaRemoteCommandNextTrack)
            case "prev":
                sendCommand(kMRMediaRemoteCommandPreviousTrack)
            case "open":
                openNetease()
            default:
                break
            }
        }

        stdinStream.waitForDataInBackgroundAndNotify()
    }
}

// MARK: - Register for Notifications (best-effort)

// Register for MediaRemote notifications so we get updates faster than 3s polling
MRMediaRemoteRegisterForNowPlayingNotifications(NSObject.self)

// Also listen via DistributedNotificationCenter as a secondary channel
DistributedNotificationCenter.default().addObserver(
    forName: NSNotification.Name("com.apple.MediaRemote.playerInfo"),
    object: nil,
    queue: .main
) { _ in
    lastOutputHash = ""
    fetchAndOutput()
}

// MARK: - Polling Timer (3s fallback)

Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { _ in
    fetchAndOutput()
}

// MARK: - Startup

setupStdinReader()
fetchAndOutput()
RunLoop.current.run()
```

- [ ] **Step 2: Test Swift helper standalone**

```bash
swift packages/music/src/native/music-helper.swift
```

Expected: JSON lines output every 3 seconds with nowPlaying info. Press Ctrl+C to stop. Verify:
- With NetEase playing: outputs title, artist, album, artworkBase64, rate=1
- With NetEase paused: rate=0
- With NetEase closed: `{"type":"nowPlaying","inactive":true}`

- [ ] **Step 3: Commit Swift helper**

```bash
git add packages/music/src/native/music-helper.swift
git commit -m "feat(music): add MediaRemote Swift helper with polling + notifications"
```

---

## Task 3: Server (Fastify + Process Management)

Spawn Swift helper, parse JSON, expose REST + SSE APIs.

**Files:**
- Create: `packages/music/src/server/index.ts`

- [ ] **Step 1: Create server index.ts**

```typescript
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
```

- [ ] **Step 2: Verify server compiles**

```bash
cd /Users/lxs/code/my-toolbox && pnpm --filter @my-toolbox/music build
```

Expected: TypeScript compiles without errors.

- [ ] **Step 3: Commit server**

```bash
git add packages/music/src/server/index.ts
git commit -m "feat(music): Fastify server with Swift process management and SSE"
```

---

## Task 4: Frontend Widget (App.tsx)

Horizontal layout: cover art on left, track info + controls on right. SSE for real-time updates.

**Files:**
- Create: `packages/music/src/web/App.tsx`

- [ ] **Step 1: Create App.tsx**

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'

interface NowPlaying {
  inactive?: boolean
  title?: string
  artist?: string
  album?: string
  duration?: number
  elapsed?: number
  rate?: number
  artworkBase64?: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function App() {
  const [track, setTrack] = useState<NowPlaying>({ inactive: true })
  const [progress, setProgress] = useState(0)
  const animRef = useRef<number>(0)
  const lastUpdateRef = useRef<{ elapsed: number; rate: number; time: number }>({ elapsed: 0, rate: 0, time: Date.now() })

  // SSE connection
  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'nowPlaying') {
          setTrack(data)
          if (data.elapsed != null && data.rate != null) {
            lastUpdateRef.current = { elapsed: data.elapsed, rate: data.rate, time: Date.now() }
          }
        }
      } catch { /* ignore parse errors */ }
    }
    return () => es.close()
  }, [])

  // Initial load
  useEffect(() => {
    fetch('/api/now-playing')
      .then((r) => r.json())
      .then((data) => {
        if (data.type === 'nowPlaying') {
          setTrack(data)
          if (data.elapsed != null && data.rate != null) {
            lastUpdateRef.current = { elapsed: data.elapsed, rate: data.rate, time: Date.now() }
          }
        }
      })
      .catch(() => {})
  }, [])

  // Smooth progress interpolation
  useEffect(() => {
    const animate = () => {
      const { elapsed, rate, time } = lastUpdateRef.current
      const dt = (Date.now() - time) / 1000
      const current = elapsed + dt * rate
      setProgress(current)
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const control = useCallback(async (action: string) => {
    try {
      await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
    } catch { /* ignore */ }
  }, [])

  // Inactive state
  if (track.inactive) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 16,
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>未检测到网易云音乐</span>
        <button
          onClick={() => control('open')}
          style={{
            background: 'var(--surface2)',
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 16px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          打开网易云音乐
        </button>
      </div>
    )
  }

  const duration = track.duration || 1
  const elapsed = track.elapsed || 0
  const pct = Math.min((progress / duration) * 100, 100)
  const isPlaying = (track.rate ?? 0) !== 0
  const artworkSrc = track.artworkBase64 ? `data:image/jpeg;base64,${track.artworkBase64}` : undefined

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 10,
    }}>
      {/* Cover Art */}
      <div style={{
        width: 72,
        height: 72,
        minWidth: 72,
        borderRadius: 8,
        background: 'var(--surface2)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {artworkSrc ? (
          <img src={artworkSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        )}
      </div>

      {/* Info + Controls */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {/* Track info */}
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}>
          {track.title || '未知曲目'}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-2)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}>
          {[track.artist, track.album].filter(Boolean).join(' - ') || '未知艺术家'}
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <div style={{
            flex: 1,
            height: 3,
            background: 'var(--border2)',
            borderRadius: 2,
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              width: `${pct}%`,
              height: '100%',
              background: 'var(--accent)',
              borderRadius: 2,
              transition: 'width 0.3s linear',
            }} />
          </div>
          <span style={{ fontSize: 9, color: 'var(--text-3)', minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(progress)} / {formatTime(duration)}
          </span>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: 2,
        }}>
          <CtrlBtn onClick={() => control('prev')} label="上一曲">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
          </CtrlBtn>
          <CtrlBtn onClick={() => control('toggle')} label={isPlaying ? '暂停' : '播放'}>
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </CtrlBtn>
          <CtrlBtn onClick={() => control('next')} label="下一曲">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
          </CtrlBtn>
          <CtrlBtn onClick={() => control('open')} label="打开网易云" style={{ marginLeft: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
          </CtrlBtn>
        </div>
      </div>
    </div>
  )
}

function CtrlBtn({ children, onClick, label, style }: {
  children: React.ReactNode
  onClick: () => void
  label: string
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: 'var(--text-1)',
        cursor: 'pointer',
        transition: 'background 0.15s',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Commit frontend**

```bash
git add packages/music/src/web/App.tsx
git commit -m "feat(music): horizontal layout widget with SSE and smooth progress"
```

---

## Task 5: PM2 Config + Ecosystem Update

Add music service to the monorepo's PM2 configuration.

**Files:**
- Modify: `ecosystem.config.js`

- [ ] **Step 1: Add music entry to ecosystem.config.js**

Add this entry after the `api-quota` block:

```javascript
{
  name: 'music',
  script: 'packages/music/dist/server/index.js',
  node_args: '--experimental-specifier-resolution=node',
  env: {
    NODE_ENV: 'production',
    PORT: 3010,
    PORTAL_URL: 'http://localhost:3000',
  },
},
```

- [ ] **Step 2: Commit PM2 config**

```bash
git add ecosystem.config.js
git commit -m "feat(music): add PM2 entry for music service on port 3010"
```

---

## Task 6: Build, Verify, and Integrate

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/lxs/code/my-toolbox && pnpm install
```

- [ ] **Step 2: Build shared package (if changed)**

```bash
pnpm --filter @my-toolbox/shared build
```

- [ ] **Step 3: Build music package**

```bash
pnpm --filter @my-toolbox/music build
```

Expected: TypeScript compiles, Vite builds successfully.

- [ ] **Step 4: Test dev mode**

```bash
pnpm --filter @my-toolbox/music dev
```

Verify in browser:
1. Open `http://localhost:5183` — widget loads
2. With NetEase playing: shows cover art, title, artist, progress bar animating
3. Click play/pause — toggles playback
4. Click next/prev — changes track
5. Click open — opens NetEase Cloud Music app
6. SSE works: track changes update without refresh

- [ ] **Step 5: Test production mode**

```bash
pm2 start ecosystem.config.js --only music
```

Verify:
1. `http://localhost:3010` serves the widget
2. `http://localhost:3010/api/health` returns `{ status: "ok", swift: true }`
3. Widget auto-discovers in portal dashboard

- [ ] **Step 6: Final commit (if any fixes needed)**

Commit any fixes discovered during testing.
