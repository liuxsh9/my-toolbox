#!/usr/bin/env node

/**
 * Installs Claude Code hooks for CC Monitor.
 * Adds hook configurations to ~/.claude/settings.json so all Claude Code
 * instances automatically report events to the monitor.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const MONITOR_URL = process.env.CC_MONITOR_URL || 'http://localhost:3001'
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')

// The hook command: read stdin (JSON from Claude Code), POST to monitor
// We use a shell script approach that pipes stdin through curl
const hookCommand = `cat /dev/stdin | curl -s -X POST ${MONITOR_URL}/api/events -H 'Content-Type: application/json' -d @- > /dev/null 2>&1 || true`

// All hooks are async: true because the monitor is a pure observer and should never block Claude Code
const MONITOR_HOOKS = {
  SessionStart: [
    {
      hooks: [{ type: 'command', command: hookCommand, timeout: 5, async: true }],
    },
  ],
  PreToolUse: [
    {
      hooks: [{ type: 'command', command: hookCommand, timeout: 5, async: true }],
    },
  ],
  PostToolUse: [
    {
      hooks: [{ type: 'command', command: hookCommand, timeout: 5, async: true }],
    },
  ],
  Stop: [
    {
      hooks: [{ type: 'command', command: hookCommand, timeout: 5, async: true }],
    },
  ],
  Notification: [
    {
      hooks: [{ type: 'command', command: hookCommand, timeout: 5, async: true }],
    },
  ],
  UserPromptSubmit: [
    {
      hooks: [{ type: 'command', command: hookCommand, timeout: 5, async: true }],
    },
  ],
  SessionEnd: [
    {
      hooks: [{ type: 'command', command: hookCommand, timeout: 5, async: true }],
    },
  ],
}

function main() {
  // Read existing settings
  let settings = {}
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    } catch (err) {
      console.error('Failed to parse existing settings.json:', err)
      process.exit(1)
    }
  }

  // Merge hooks - append to existing hook arrays, don't overwrite
  if (!settings.hooks) {
    settings.hooks = {}
  }

  for (const [event, hookConfigs] of Object.entries(MONITOR_HOOKS)) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = []
    }

    // Remove any existing monitor hooks (identified by monitor URL in command)
    settings.hooks[event] = settings.hooks[event].filter(
      (config) => !JSON.stringify(config).includes(MONITOR_URL + '/api/events')
    )

    // Add new monitor hooks
    settings.hooks[event].push(...hookConfigs)
  }

  // Ensure directory exists
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })

  // Write back
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
  console.log(`[cc-monitor] Hooks installed in ${SETTINGS_PATH}`)
  console.log(`[cc-monitor] Events will be sent to ${MONITOR_URL}/api/events`)
  console.log('[cc-monitor] New Claude Code sessions will automatically report to the monitor.')
}

main()
