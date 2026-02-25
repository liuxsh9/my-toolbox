## ADDED Requirements

### Requirement: Portal postMessage message bus

The portal SHALL act as a message bus, receiving postMessage events from embedded tool iframes and routing them to target tool iframes.

#### Scenario: Tool sends cross-tool action

- **WHEN** an embedded tool iframe calls `window.parent.postMessage({ type: 'FOCUS_WINDOW', pid: 54321 }, '*')`
- **THEN** the portal SHALL receive the message
- **THEN** the portal SHALL forward it to the win-switcher iframe if win-switcher is present on the desktop

#### Scenario: Target tool not on desktop

- **WHEN** the portal receives a cross-tool message but the target tool's widget is not currently on the desktop
- **THEN** the portal SHALL silently discard the message (no error thrown)

#### Scenario: Message type routing

- **WHEN** the portal receives a message with `type: 'FOCUS_WINDOW'`
- **THEN** the portal SHALL route it to the win-switcher iframe
- **THEN** the portal SHALL NOT forward it to any other iframe

### Requirement: CC Monitor session click triggers window focus

CC Monitor SHALL allow users to click a session row in widget mode to request focus on the associated terminal window.

#### Scenario: Session click in widget mode

- **WHEN** user clicks a session row in CC Monitor's widget view
- **THEN** CC Monitor SHALL call `window.parent.postMessage({ type: 'FOCUS_WINDOW', pid: <session.pid>, cwd: <session.cwd> }, '*')`
- **THEN** the portal SHALL route this to win-switcher
- **THEN** win-switcher SHALL attempt to focus the terminal window containing that process

#### Scenario: Session has no PID

- **WHEN** user clicks a session that has no associated PID (hook-only session without process detection)
- **THEN** CC Monitor SHALL NOT send a postMessage (no-op, no error shown)
