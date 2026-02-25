export interface WindowInfo {
  id: number
  title: string
  app: string
  pid: number
  x: number
  y: number
  width: number
  height: number
  onScreen: boolean
}

export interface PermissionStatus {
  accessibility: boolean
  screenRecording: boolean
}

export interface WindowsResponse {
  windows: WindowInfo[]
  permissions: PermissionStatus
}

export async function fetchWindows(): Promise<WindowsResponse> {
  const res = await fetch('/api/windows')
  if (!res.ok) throw new Error('Failed to fetch windows')
  return res.json()
}

export async function focusWindow(wid: number, pid: number, title: string): Promise<void> {
  await fetch(`/api/windows/${wid}/focus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid, title }),
  })
}

export async function focusByPid(pid: number): Promise<{ ok: boolean; windowId?: number; app?: string; error?: string }> {
  const res = await fetch('/api/windows/focus-by-pid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid }),
  })
  return res.json()
}

export function thumbUrl(wid: number, t: number): string {
  return `/api/windows/${wid}/thumb?t=${t}`
}
