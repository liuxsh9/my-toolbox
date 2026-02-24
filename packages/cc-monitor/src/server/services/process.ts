import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { SessionManager } from './collector.js'

const execAsync = promisify(exec)
const SCAN_INTERVAL_MS = 15_000

interface ProcessInfo {
  pid: number
  tty: string
  command: string
  cwd?: string
}

async function scanClaudeProcesses(): Promise<ProcessInfo[]> {
  try {
    // Use awk to precisely match processes where the command basename is "claude"
    // This avoids matching shell wrappers or unrelated processes containing "claude" in args
    const { stdout } = await execAsync(
      `ps -eo pid,tty,command | awk '$3 == "claude" || $3 ~ /\\/claude$/'`
    )
    const lines = stdout.trim().split('\n').filter(Boolean)
    const processes: ProcessInfo[] = []

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      const pid = parseInt(parts[0], 10)
      const tty = parts[1]
      const command = parts.slice(2).join(' ')
      if (isNaN(pid)) continue

      // Try to get the process working directory via lsof
      let cwd: string | undefined
      try {
        const { stdout: lsofOut } = await execAsync(
          `lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`
        )
        // lsof -Fn outputs lines like "p<pid>" and "n<path>"
        const nameLine = lsofOut.split('\n').find(l => l.startsWith('n'))
        if (nameLine) {
          cwd = nameLine.slice(1) // strip leading 'n'
        }
      } catch {
        // lsof may fail for permission reasons; ignore
      }

      processes.push({ pid, tty, command, cwd })
    }

    return processes
  } catch {
    return [] // no claude processes found
  }
}

export function startProcessScanner(sessions: SessionManager) {
  async function scan() {
    const processes = await scanClaudeProcesses()
    const activePids = new Set<number>()

    for (const proc of processes) {
      activePids.add(proc.pid)
      sessions.registerProcess(proc.pid, proc.tty, proc.cwd)
    }

    sessions.markTerminated(activePids)
  }

  // Initial scan
  scan()
  setInterval(scan, SCAN_INTERVAL_MS)
}
