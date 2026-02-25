import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SWIFT_SCRIPT = path.resolve(__dirname, '../../../src/native/windows.swift')
const THUMB_DIR = '/tmp/winswitcher'
const THUMB_TTL_MS = 15_000

// Ensure thumb directory exists
fs.mkdirSync(THUMB_DIR, { recursive: true })

// Concurrency limiter for screencapture
let runningCaptures = 0
const MAX_CAPTURES = 4
const captureQueue: Array<() => void> = []

function acquireCapture(): Promise<void> {
  return new Promise((resolve) => {
    if (runningCaptures < MAX_CAPTURES) {
      runningCaptures++
      resolve()
    } else {
      captureQueue.push(() => { runningCaptures++; resolve() })
    }
  })
}

function releaseCapture() {
  runningCaptures--
  const next = captureQueue.shift()
  if (next) next()
}

export interface WindowInfo {
  id: number
  title: string
  app: string
  pid: number
  x: number
  y: number
  width: number
  height: number
}

export interface PermissionStatus {
  accessibility: boolean
  screenRecording: boolean
}

export async function listWindows(): Promise<WindowInfo[]> {
  const { stdout } = await execFileAsync('swift', [SWIFT_SCRIPT, 'list'], { timeout: 10_000 })
  return JSON.parse(stdout.trim()) as WindowInfo[]
}

export async function checkPermissions(): Promise<PermissionStatus> {
  const { stdout } = await execFileAsync('swift', [SWIFT_SCRIPT, 'check-permissions'], { timeout: 10_000 })
  return JSON.parse(stdout.trim()) as PermissionStatus
}

export async function focusWindow(wid: number, pid: number, title: string): Promise<{ ok: boolean; degraded?: boolean; reason?: string }> {
  const { stdout } = await execFileAsync('swift', [SWIFT_SCRIPT, 'focus', String(wid), String(pid), title], { timeout: 10_000 })
  return JSON.parse(stdout.trim())
}

export async function focusByCwd(pid: number, cwd: string): Promise<{ ok: boolean; error?: string }> {
  const { stdout } = await execFileAsync('swift', [SWIFT_SCRIPT, 'focus-by-cwd', String(pid), cwd], { timeout: 10_000 })
  return JSON.parse(stdout.trim())
}

export async function captureThumb(wid: number): Promise<string> {
  const filePath = path.join(THUMB_DIR, `thumb-${wid}.png`)

  // Check cache freshness
  try {
    const stat = fs.statSync(filePath)
    if (Date.now() - stat.mtimeMs < THUMB_TTL_MS) {
      return filePath
    }
  } catch {
    // file doesn't exist yet
  }

  await acquireCapture()
  try {
    await execFileAsync('screencapture', ['-l', String(wid), '-x', '-t', 'png', filePath], { timeout: 8_000 })
    return filePath
  } catch {
    // screencapture fails for off-screen/minimized windows — serve stale cache if available
    if (fs.existsSync(filePath)) return filePath
    throw new Error('Thumbnail unavailable')
  } finally {
    releaseCapture()
  }
}

export function thumbPath(wid: number): string {
  return path.join(THUMB_DIR, `thumb-${wid}.png`)
}

async function getPpid(pid: number): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'ppid=', '-p', String(pid)], { timeout: 3_000 })
    const ppid = parseInt(stdout.trim(), 10)
    return isNaN(ppid) || ppid <= 1 ? null : ppid
  } catch {
    return null
  }
}

export async function findTerminalWindowByPid(pid: number, cwd?: string): Promise<{ windowId: number; app: string } | { error: string }> {
  // Walk ppid chain to find first ancestor that owns a window.
  // When multiple windows share the same pid (e.g. VS Code), match by cwd folder name in title.
  let windows: WindowInfo[]
  try {
    windows = await listWindows()
  } catch {
    return { error: 'list_failed' }
  }

  // Build pid → windows[] map (multiple windows per pid for apps like VS Code)
  const windowsByPid = new Map<number, WindowInfo[]>()
  for (const w of windows) {
    const arr = windowsByPid.get(w.pid)
    if (arr) arr.push(w)
    else windowsByPid.set(w.pid, [w])
  }

  let current = pid
  for (let depth = 0; depth < 12; depth++) {
    const ppid = await getPpid(current)
    if (!ppid) break
    const wins = windowsByPid.get(ppid)
    if (wins?.length) {
      // If cwd provided and multiple windows, pick the one whose title contains the folder name
      if (cwd && wins.length > 1) {
        const folder = cwd.split('/').filter(Boolean).pop() ?? ''
        const matched = wins.find(w => w.title.includes(folder))
        const win = matched ?? wins[0]
        return { windowId: win.id, app: win.app }
      }
      return { windowId: wins[0].id, app: wins[0].app }
    }
    current = ppid
  }

  return { error: 'no_terminal_window' }
}
