## ADDED Requirements

### Requirement: Push notification endpoint

The notification center SHALL expose a POST endpoint for any tool to push a notification.

#### Scenario: Tool pushes a notification

- **WHEN** a tool sends `POST /api/notifications` with `{ title, body, source }`
- **THEN** the server SHALL store the notification in memory with a generated `id` and `createdAt`
- **THEN** the server SHALL broadcast the notification to all active SSE subscribers
- **THEN** the server SHALL return `{ ok: true, data: { id } }` with status 201

#### Scenario: Missing required fields

- **WHEN** a tool sends `POST /api/notifications` without `title` or `body` or `source`
- **THEN** the server SHALL return `{ ok: false, error: "Missing required fields" }` with status 400

### Requirement: List notifications endpoint

The notification center SHALL expose a GET endpoint to retrieve all current (unread) notifications.

#### Scenario: Fetch current notifications

- **WHEN** a client sends `GET /api/notifications`
- **THEN** the server SHALL return `{ ok: true, data: Notification[] }` ordered by `createdAt` descending

#### Scenario: No notifications

- **WHEN** there are no notifications in memory
- **THEN** the server SHALL return `{ ok: true, data: [] }`

### Requirement: Dismiss notification endpoint

The notification center SHALL allow a notification to be dismissed (deleted) by ID.

#### Scenario: Dismiss existing notification

- **WHEN** a client sends `DELETE /api/notifications/:id`
- **THEN** the server SHALL remove the notification from memory
- **THEN** the server SHALL broadcast a `dismissed` event to all SSE subscribers with the dismissed `id`
- **THEN** the server SHALL return `{ ok: true }`

#### Scenario: Dismiss non-existent notification

- **WHEN** a client sends `DELETE /api/notifications/:id` for an unknown ID
- **THEN** the server SHALL return `{ ok: false, error: "Not found" }` with status 404

### Requirement: Dismiss all notifications endpoint

The notification center SHALL allow all notifications to be cleared at once.

#### Scenario: Clear all notifications

- **WHEN** a client sends `DELETE /api/notifications`
- **THEN** the server SHALL remove all notifications from memory
- **THEN** the server SHALL broadcast a `cleared` event to all SSE subscribers
- **THEN** the server SHALL return `{ ok: true }`

### Requirement: SSE real-time stream

The notification center SHALL provide a Server-Sent Events stream for real-time updates.

#### Scenario: Client connects to SSE stream

- **WHEN** a client sends `GET /api/notifications/stream`
- **THEN** the server SHALL keep the connection open with `Content-Type: text/event-stream`
- **THEN** the server SHALL send a `connected` event immediately upon connection

#### Scenario: New notification broadcast

- **WHEN** a new notification is pushed via POST
- **THEN** the server SHALL send an SSE event with `event: notification` and the full notification object as JSON data to all connected clients

#### Scenario: Notification dismissed broadcast

- **WHEN** a notification is dismissed via DELETE
- **THEN** the server SHALL send an SSE event with `event: dismissed` and `{ id }` as JSON data to all connected clients

#### Scenario: All notifications cleared broadcast

- **WHEN** all notifications are cleared via DELETE /api/notifications
- **THEN** the server SHALL send an SSE event with `event: cleared` and no data to all connected clients

#### Scenario: Client disconnects

- **WHEN** an SSE client disconnects
- **THEN** the server SHALL remove the client from the subscriber list without error

### Requirement: Health endpoint

The notification center SHALL expose a health endpoint for portal discovery.

#### Scenario: Health check

- **WHEN** a client sends `GET /api/health`
- **THEN** the server SHALL return `{ ok: true, status: "running" }` with status 200

### Requirement: Widget UI

The notification center SHALL provide a widget-optimized React UI showing current notifications.

#### Scenario: Widget displays notifications

- **WHEN** the widget is open and there are unread notifications
- **THEN** the UI SHALL display each notification with title, body, source, and relative time
- **THEN** the UI SHALL show an unread count badge

#### Scenario: Click to dismiss

- **WHEN** the user clicks a notification item
- **THEN** the UI SHALL call `DELETE /api/notifications/:id`
- **THEN** the notification SHALL disappear from the list immediately

#### Scenario: Clear all button

- **WHEN** the user clicks the "清空" (clear all) button
- **THEN** the UI SHALL call `DELETE /api/notifications`
- **THEN** all notifications SHALL disappear from the list

#### Scenario: Empty state

- **WHEN** there are no notifications
- **THEN** the UI SHALL display a friendly empty state message

#### Scenario: Real-time updates via SSE

- **WHEN** a new notification arrives via SSE
- **THEN** the UI SHALL display it immediately without page refresh
