export type SessionStatus =
  | 'started'
  | 'processing'
  | 'working'
  | 'idle'
  | 'waiting_for_input'
  | 'ended'
  | 'terminated'
  | 'detected'

export interface SessionEvent {
  hookEventName: string
  toolName?: string
  timestamp: string
}

export interface SessionInfo {
  sessionId: string
  project: string
  status: SessionStatus
  lastActivity: string
  startedAt: string
  pid?: number
  tty?: string
  events: SessionEvent[]
}

export interface SessionStats {
  totalSessions: number
  activeSessions: number
  lastEventTime: string | null
}

export class SessionManager {
  private sessions = new Map<string, SessionInfo>()
  private lastEventTime: string | null = null

  handleEvent(data: Record<string, unknown>) {
    const sessionId = data.session_id as string
    const hookEventName = data.hook_event_name as string
    const cwd = data.cwd as string | undefined
    const now = new Date().toISOString()

    if (!sessionId || !hookEventName) return

    this.lastEventTime = now

    let session = this.sessions.get(sessionId)
    if (!session) {
      session = {
        sessionId,
        project: cwd || 'unknown',
        status: 'started',
        lastActivity: now,
        startedAt: now,
        events: [],
      }
      this.sessions.set(sessionId, session)
    }

    session.lastActivity = now
    session.events.push({
      hookEventName,
      toolName: data.tool_name as string | undefined,
      timestamp: now,
    })

    // Keep only last 100 events per session
    if (session.events.length > 100) {
      session.events = session.events.slice(-100)
    }

    // Update status based on event type
    switch (hookEventName) {
      case 'SessionStart':
        session.status = 'started'
        if (cwd) session.project = cwd
        break
      case 'UserPromptSubmit':
        session.status = 'processing'
        break
      case 'PreToolUse':
      case 'PostToolUse':
        session.status = 'working'
        break
      case 'Stop':
        session.status = 'idle'
        break
      case 'Notification':
        session.status = 'waiting_for_input'
        break
      case 'SessionEnd':
        session.status = 'ended'
        break
    }
  }

  getAll(): SessionInfo[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status !== 'ended' && s.status !== 'terminated')
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
  }

  getAllIncludingEnded(): SessionInfo[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
  }

  getById(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId)
  }

  getStats(): SessionStats {
    const all = Array.from(this.sessions.values())
    const active = all.filter(s => s.status !== 'ended' && s.status !== 'terminated')
    return {
      totalSessions: all.length,
      activeSessions: active.length,
      lastEventTime: this.lastEventTime,
    }
  }

  /** Called by process scanner to register detected processes */
  registerProcess(pid: number, tty: string, cwd?: string) {
    // Check if any hook-reported session already has this PID
    for (const session of this.sessions.values()) {
      if (session.pid === pid && !session.sessionId.startsWith('process-')) return
    }

    // Try to merge with a hook-reported session that shares the same cwd
    if (cwd) {
      for (const session of this.sessions.values()) {
        if (
          !session.pid &&
          !session.sessionId.startsWith('process-') &&
          session.project === cwd &&
          session.status !== 'ended' && session.status !== 'terminated'
        ) {
          session.pid = pid
          session.tty = tty
          // Remove the old process-* entry if it exists
          this.sessions.delete(`process-${pid}`)
          return
        }
      }
    }

    // Update existing process-* entry or create new one
    const pseudoId = `process-${pid}`
    let session = this.sessions.get(pseudoId)
    if (!session) {
      session = {
        sessionId: pseudoId,
        project: cwd || 'unknown',
        status: 'detected',
        lastActivity: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        pid,
        tty,
        events: [],
      }
      this.sessions.set(pseudoId, session)
    }
    session.lastActivity = new Date().toISOString()
    session.pid = pid
    session.tty = tty
    if (cwd) session.project = cwd
  }

  /** Mark sessions whose processes have disappeared */
  markTerminated(activePids: Set<number>) {
    for (const session of this.sessions.values()) {
      if (session.pid && !activePids.has(session.pid) && session.status !== 'ended' && session.status !== 'terminated') {
        session.status = 'terminated'
        session.lastActivity = new Date().toISOString()
      }
    }
  }
}
