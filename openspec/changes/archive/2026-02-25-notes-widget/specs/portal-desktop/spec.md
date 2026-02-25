## MODIFIED Requirements

### Requirement: Desktop widget grid

The portal homepage SHALL render a desktop-style widget grid using react-grid-layout with a 12-column grid and configurable row height.

#### Scenario: Default layout on first visit

- **WHEN** user visits the portal homepage for the first time (no saved layout in localStorage)
- **THEN** the desktop SHALL display win-switcher, cc-monitor, bookmarks, and notes as pre-positioned widgets
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

## ADDED Requirements

### Requirement: Relaxed widget size constraints

All widgets in the portal desktop SHALL use relaxed minimum size constraints to allow users to freely resize widgets to their preferred dimensions.

#### Scenario: Widget minimum size

- **WHEN** a widget's tool.yaml declares minW and minH
- **THEN** the portal SHALL enforce those values as the minimum resize boundary
- **THEN** all monorepo tools SHALL declare minW ≤ 2 and minH ≤ 3 to allow compact sizing
