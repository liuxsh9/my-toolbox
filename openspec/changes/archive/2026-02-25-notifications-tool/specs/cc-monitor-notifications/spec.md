## ADDED Requirements

### Requirement: Push notification on Claude task completion

CC Monitor SHALL push a notification to the notification center when a Claude Code session reaches the `idle` state (Stop event).

#### Scenario: Claude completes a task

- **WHEN** cc-monitor receives a `Stop` hook event for a session
- **THEN** cc-monitor SHALL send `POST http://localhost:3004/api/notifications` with:
  - `title`: "Claude 完成了工作"
  - `body`: the session's project path (basename only, e.g. "my-toolbox")
  - `source`: "cc-monitor"
- **THEN** cc-monitor SHALL NOT block or throw if the notification service is unavailable

#### Scenario: Notification service unavailable

- **WHEN** cc-monitor attempts to push a notification but the notification center is not running
- **THEN** cc-monitor SHALL silently ignore the error (fire-and-forget)
- **THEN** cc-monitor's own functionality SHALL be unaffected

### Requirement: Push notification on Claude waiting for decision

CC Monitor SHALL push a notification to the notification center when a Claude Code session reaches the `waiting_for_input` state (Notification event).

#### Scenario: Claude needs user decision

- **WHEN** cc-monitor receives a `Notification` hook event for a session
- **THEN** cc-monitor SHALL send `POST http://localhost:3004/api/notifications` with:
  - `title`: "Claude 需要你的决策"
  - `body`: the session's project path (basename only)
  - `source`: "cc-monitor"
- **THEN** cc-monitor SHALL NOT block or throw if the notification service is unavailable

### Requirement: Notification push is fire-and-forget

CC Monitor's notification push SHALL be non-blocking and fault-tolerant.

#### Scenario: Push does not delay event handling

- **WHEN** cc-monitor handles any hook event that triggers a notification push
- **THEN** the push SHALL be initiated asynchronously (no await blocking the event handler)
- **THEN** the event handler SHALL return immediately regardless of push outcome
