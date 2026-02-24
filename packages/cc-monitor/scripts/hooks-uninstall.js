#!/usr/bin/env node

/**
 * Uninstalls Claude Code hooks for CC Monitor.
 * Removes monitor-related hook configurations from ~/.claude/settings.json
 * while preserving all other user hooks.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const MONITOR_URL = process.env.CC_MONITOR_URL || 'http://localhost:3001'
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')

const HOOK_EVENTS = [
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'Notification',
  'UserPromptSubmit',
  'SessionEnd',
]

function main() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    console.log('[cc-monitor] No settings.json found — nothing to uninstall.')
    return
  }

  let settings
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
  } catch (err) {
    console.error('Failed to parse settings.json:', err)
    process.exit(1)
  }

  if (!settings.hooks) {
    console.log('[cc-monitor] No hooks found — nothing to uninstall.')
    return
  }

  let removedCount = 0
  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) continue

    const before = settings.hooks[event].length
    settings.hooks[event] = settings.hooks[event].filter(
      (config) => !JSON.stringify(config).includes(MONITOR_URL + '/api/events')
    )
    removedCount += before - settings.hooks[event].length

    // Clean up empty arrays
    if (settings.hooks[event].length === 0) {
      delete settings.hooks[event]
    }
  }

  // Clean up empty hooks object
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
  console.log(`[cc-monitor] Removed ${removedCount} hook(s) from ${SETTINGS_PATH}`)
  console.log('[cc-monitor] Other hooks have been preserved.')
}

main()
