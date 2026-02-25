## ADDED Requirements

### Requirement: Focus window by process PID

Win-Switcher SHALL provide an endpoint that accepts a process PID, traverses the ppid chain to find the ancestor terminal window, and focuses it.

#### Scenario: Successful focus via PID

- **WHEN** a client POSTs `{ pid: 54321 }` to `/api/windows/focus-by-pid`
- **THEN** the server SHALL traverse the ppid chain from pid 54321 upward
- **THEN** the server SHALL stop when it finds a process whose app name matches a known terminal emulator (Terminal, iTerm2, Warp, Alacritty, kitty, Hyper, WezTerm)
- **THEN** the server SHALL find the CGWindow matching that terminal process PID
- **THEN** the server SHALL focus that window using the existing focus mechanism
- **THEN** the server SHALL return `{ ok: true, windowId: <wid>, app: <appName> }`

#### Scenario: PID not found in process tree

- **WHEN** the provided PID does not exist or has already exited
- **THEN** the server SHALL return `{ ok: false, error: 'process_not_found' }` with HTTP 404

#### Scenario: No terminal ancestor found

- **WHEN** the ppid chain is traversed to PID 1 (launchd) without finding a known terminal emulator
- **THEN** the server SHALL return `{ ok: false, error: 'no_terminal_window' }` with HTTP 404

#### Scenario: Terminal window not in CGWindowList

- **WHEN** the terminal ancestor PID is found but no matching window exists in the current window list
- **THEN** the server SHALL return `{ ok: false, error: 'window_not_found' }` with HTTP 404

### Requirement: Win-Switcher widget receives focus-by-pid messages

Win-Switcher's widget mode SHALL listen for `FOCUS_WINDOW` postMessages from the portal and trigger the focus-by-pid API.

#### Scenario: Widget receives FOCUS_WINDOW message

- **WHEN** win-switcher widget receives `{ type: 'FOCUS_WINDOW', pid: 54321 }` via `window.addEventListener('message', ...)`
- **THEN** win-switcher SHALL POST to its own `/api/windows/focus-by-pid` with `{ pid: 54321 }`
- **THEN** win-switcher SHALL briefly highlight the focused window card if it is visible in the current list
