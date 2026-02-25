### Requirement: Note CRUD via REST API

The notes server SHALL expose a REST API for creating, reading, updating, and deleting notes stored in SQLite.

#### Scenario: List all notes

- **WHEN** client sends `GET /api/notes`
- **THEN** server SHALL return an array of note objects sorted by `updated_at` descending
- **THEN** each note object SHALL include `id`, `content`, `created_at`, `updated_at`

#### Scenario: Create a note

- **WHEN** client sends `POST /api/notes` with `{ content: string }`
- **THEN** server SHALL insert a new row with a generated UUID `id` and current timestamp
- **THEN** server SHALL return the created note object with status 201

#### Scenario: Update a note

- **WHEN** client sends `PUT /api/notes/:id` with `{ content: string }`
- **THEN** server SHALL update the note's `content` and `updated_at`
- **THEN** server SHALL return the updated note object
- **WHEN** the note id does not exist
- **THEN** server SHALL return 404

#### Scenario: Delete a note

- **WHEN** client sends `DELETE /api/notes/:id`
- **THEN** server SHALL remove the note from SQLite
- **THEN** server SHALL return 204 No Content
- **WHEN** the note id does not exist
- **THEN** server SHALL return 404

### Requirement: Plain text content preservation

The notes system SHALL store and return note content as plain text without any transformation.

#### Scenario: Code snippet paste round-trip

- **WHEN** a note is created with content containing backticks, angle brackets, backslashes, or null bytes
- **THEN** the stored content SHALL be byte-identical to the input
- **THEN** the returned content SHALL be byte-identical to the stored content

### Requirement: Notes widget UI — list view

The notes frontend SHALL render a list view as the default screen showing all notes sorted by recency.

#### Scenario: Empty state

- **WHEN** no notes exist
- **THEN** the list view SHALL display an empty state prompt encouraging the user to create a note

#### Scenario: Note list item

- **WHEN** notes exist
- **THEN** each list item SHALL display the first line of content as the title (truncated to 40 chars)
- **THEN** items with empty first line SHALL display "无标题" as the title
- **THEN** each item SHALL display a relative timestamp (e.g. "2分钟前")

#### Scenario: Navigate to edit view

- **WHEN** user clicks a note list item
- **THEN** the UI SHALL transition to the edit view for that note

#### Scenario: Create new note

- **WHEN** user clicks the [+] button in the list view header
- **THEN** a new empty note SHALL be created via `POST /api/notes`
- **THEN** the UI SHALL immediately transition to the edit view for the new note

### Requirement: Notes widget UI — edit view

The notes frontend SHALL render an edit view with a full-height textarea for writing.

#### Scenario: Auto-save on input

- **WHEN** user types in the textarea
- **THEN** the note SHALL be saved via `PUT /api/notes/:id` after a 500ms debounce
- **THEN** a `· saved` indicator SHALL appear briefly then fade out after save completes

#### Scenario: Return to list

- **WHEN** user clicks the ← back button
- **THEN** the UI SHALL transition back to the list view
- **THEN** any pending unsaved changes SHALL be flushed immediately before navigating

#### Scenario: Delete note with inline confirmation

- **WHEN** user clicks the delete (trash) icon in the edit view
- **THEN** the button SHALL change to a "确认删除？" state
- **WHEN** user clicks again within 3 seconds
- **THEN** the note SHALL be deleted via `DELETE /api/notes/:id`
- **THEN** the UI SHALL transition to the list view
- **WHEN** 3 seconds elapse without a second click
- **THEN** the button SHALL revert to the normal trash icon state

### Requirement: Widget mode support

The notes tool SHALL support `?mode=widget` URL parameter for portal iframe embedding.

#### Scenario: Widget mode activated

- **WHEN** the notes frontend is loaded with `?mode=widget`
- **THEN** the tool SHALL hide any top-level navigation or page chrome
- **THEN** the tool SHALL render the list view or edit view filling the full iframe height
