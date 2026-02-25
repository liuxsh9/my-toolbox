## Why

The portal homepage currently only provides navigation links to individual tools. Developers want a unified workspace where multiple tools are visible and interactive simultaneously — like a desktop with multiple open windows — without switching browser tabs.

## What Changes

- Portal homepage replaced with a desktop-style layout using a draggable, resizable widget grid
- Each tool gets a `?mode=widget` rendering mode: compact UI without chrome (no nav/header), responsive to container size
- Win-Switcher gains a new API endpoint to find windows by PID (ppid chain traversal)
- CC Monitor sessions become clickable — clicking triggers win-switcher to focus the associated terminal window
- Inter-widget communication via `postMessage` routed through the portal (message bus)
- `tool.yaml` extended with optional `widget` block declaring min/default sizes and widget route
- Layout persisted to `localStorage` per user
- Default layout pre-populates all three tools (win-switcher, cc-monitor, bookmarks)

## Capabilities

### New Capabilities

- `portal-desktop`: Desktop-style widget grid in the portal — draggable/resizable panels, add/remove widgets, layout persistence
- `widget-mode`: Each tool supports `?mode=widget` URL param rendering a compact, embeddable version via iframe
- `inter-widget-messaging`: `postMessage` message bus in the portal enabling cross-tool actions (e.g., cc-monitor → win-switcher focus)
- `window-focus-by-pid`: Win-Switcher API endpoint that accepts a PID, traverses the ppid chain, and returns/focuses the matching terminal window

### Modified Capabilities

- `portal-dashboard`: Homepage UI replaced entirely by the desktop widget grid (existing tool card grid removed)
- `tool-manifest`: `tool.yaml` schema extended with optional `widget` block

## Impact

- `packages/portal/src/web/` — Dashboard replaced; new Desktop + WidgetWindow components; `react-grid-layout` added
- `packages/win-switcher/src/server/` — New `/api/windows/find-by-pid` endpoint; ppid traversal logic
- `packages/win-switcher/src/web/` — Widget mode view (compact window grid, no header)
- `packages/cc-monitor/src/web/` — Widget mode view (compact session list); click-to-focus via postMessage
- `packages/bookmarks/src/web/` — Widget mode view (compact bookmark grid)
- `packages/shared/src/types.ts` — `ToolManifest` extended with `widget` field
- All `tool.yaml` files — Add `widget` block
- New dependency: `react-grid-layout` in portal package
