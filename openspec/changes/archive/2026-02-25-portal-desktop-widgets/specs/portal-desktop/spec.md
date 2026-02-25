## ADDED Requirements

### Requirement: Desktop widget grid

The portal homepage SHALL render a desktop-style widget grid using react-grid-layout with a 12-column grid and configurable row height.

#### Scenario: Default layout on first visit

- **WHEN** user visits the portal homepage for the first time (no saved layout in localStorage)
- **THEN** the desktop SHALL display win-switcher, cc-monitor, and bookmarks as pre-positioned widgets
- **THEN** each widget SHALL occupy a reasonable default size (at minimum minW × minH from tool.yaml widget block)

#### Scenario: Layout persistence

- **WHEN** user drags or resizes a widget
- **THEN** the new layout SHALL be saved to localStorage key `portal-desktop-layout` immediately
- **WHEN** user revisits the portal
- **THEN** the saved layout SHALL be restored

#### Scenario: Add widget

- **WHEN** user clicks the "+ Add Widget" button
- **THEN** a picker SHALL appear listing all registered tools not currently on the desktop
- **WHEN** user selects a tool
- **THEN** a new widget SHALL be added to the grid at a free position with default dimensions

#### Scenario: Remove widget

- **WHEN** user clicks the close (×) button on a widget title bar
- **THEN** the widget SHALL be removed from the desktop
- **THEN** the layout SHALL be updated in localStorage

#### Scenario: Minimize widget

- **WHEN** user clicks the minimize (−) button on a widget title bar
- **THEN** the widget SHALL collapse to show only its title bar (iframe hidden)
- **WHEN** user clicks the title bar of a minimized widget
- **THEN** the widget SHALL expand and restore the iframe

#### Scenario: Maximize widget

- **WHEN** user clicks the maximize (□) button on a widget title bar
- **THEN** the widget SHALL expand to fill the full desktop area (overlay mode)
- **WHEN** user clicks the restore button
- **THEN** the widget SHALL return to its previous grid position and size

### Requirement: Widget window chrome

The portal SHALL render a uniform title bar for each widget containing the tool name, live status indicator, and window controls.

#### Scenario: Status indicator in title bar

- **WHEN** a widget is displayed
- **THEN** the title bar SHALL show a colored dot reflecting the tool's current status (green=running, yellow=unhealthy, red=unreachable/stopped)
- **THEN** the status SHALL update in sync with the portal's existing 10-second tool polling

#### Scenario: Layout stale entry cleanup

- **WHEN** portal loads a saved layout from localStorage
- **THEN** any widget entries referencing tools no longer registered SHALL be silently removed from the layout
