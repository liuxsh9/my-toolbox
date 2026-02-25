## ADDED Requirements

### Requirement: Widget rendering mode

Each tool SHALL support a `?mode=widget` URL parameter that renders a compact, embeddable version of the tool UI suitable for display inside a portal iframe.

#### Scenario: Widget mode activated

- **WHEN** a tool is loaded with `?mode=widget` in the URL
- **THEN** the tool SHALL hide its top-level navigation, page title, and header chrome
- **THEN** the tool SHALL render only its core interactive content
- **THEN** the tool SHALL use compact spacing and smaller typography appropriate for a partial-screen view

#### Scenario: Widget mode preserves interactivity

- **WHEN** a tool is in widget mode
- **THEN** all core interactions SHALL remain functional (clicking, form inputs, navigation within the tool)
- **THEN** links that would open new pages SHALL open in a new browser tab (`target="_blank"`)

#### Scenario: Widget mode responsive to container

- **WHEN** the portal resizes a widget's iframe container
- **THEN** the tool's widget view SHALL adapt its layout to the available width and height
- **THEN** the tool SHALL NOT show horizontal scrollbars for widths above its declared `minW`

### Requirement: tool.yaml widget block

Each tool's `tool.yaml` MAY declare a `widget` block specifying size constraints and defaults for portal embedding.

#### Scenario: Widget block parsed by portal

- **WHEN** a tool's `tool.yaml` contains a `widget` block:
  ```yaml
  widget:
    minW: 3
    minH: 4
    defaultW: 4
    defaultH: 6
  ```
- **THEN** the portal SHALL use these values as grid constraints when placing the widget
- **THEN** the user SHALL NOT be able to resize the widget below `minW` × `minH`

#### Scenario: Missing widget block fallback

- **WHEN** a tool's `tool.yaml` has no `widget` block
- **THEN** the portal SHALL use default constraints: minW=3, minH=4, defaultW=4, defaultH=6
