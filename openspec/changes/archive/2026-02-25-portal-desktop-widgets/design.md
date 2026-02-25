## Context

The portal currently renders a static grid of tool cards that link out to individual tools. Each tool is a standalone Fastify + React app running on its own port. The goal is to transform the portal homepage into an interactive desktop where tools are embedded as iframes in a draggable/resizable grid, with cross-tool communication.

Current state:
- Portal: simple card grid, no interactivity beyond "Open" links
- Tools: full-page React apps, no widget/embed mode
- No inter-tool communication mechanism

## Goals / Non-Goals

**Goals:**
- Desktop-style portal with draggable, resizable widget panels
- Each tool renders a compact `?mode=widget` view inside an iframe
- CC Monitor sessions clickable → focuses associated terminal window via Win-Switcher
- Layout persisted to localStorage
- Default layout pre-populates win-switcher, cc-monitor, bookmarks

**Non-Goals:**
- Mobile/responsive portal desktop (desktop-only experience)
- Cross-browser sync of layouts
- Widget marketplace or external tool widget support (only monorepo tools)
- Real-time collaborative layout editing

## Decisions

### D1: iframe embedding over micro-frontends

**Decision**: Embed tools via `<iframe src="http://localhost:<port>?mode=widget">`.

**Rationale**: Tools are already complete React apps. iframes provide free CSS/JS/state isolation. No build system changes needed. The only cost is `postMessage` for cross-frame communication, which is well-understood.

**Alternatives considered**:
- Module Federation: requires unified React version, complex build config, overkill for local tools
- Web Components: Shadow DOM isolation is good but React↔WC interop is awkward

### D2: `?mode=widget` URL param over separate `/widget` route

**Decision**: Each tool detects `new URLSearchParams(location.search).get('mode') === 'widget'` and conditionally renders compact UI.

**Rationale**: Minimal code change per tool — just wrap existing components with a mode check. No new routes, no new entry points. The iframe URL is simply `http://localhost:<port>?mode=widget`.

### D3: Portal as postMessage message bus

**Decision**: Portal's `Desktop` component listens for `message` events from all iframes and routes them to target iframes.

```
CC Monitor iframe
  → postMessage({type:'FOCUS_WINDOW', pid:54321}, '*')
  → Portal window listener receives it
  → Portal forwards to Win-Switcher iframe via iframeRef.contentWindow.postMessage(...)
```

**Rationale**: Tools don't need to know each other's ports. Portal is the natural hub. Extensible — any future cross-tool action follows the same pattern.

**Message protocol**:
```ts
// Outbound (tool → portal)
{ type: 'FOCUS_WINDOW', pid: number, cwd?: string }

// Inbound (portal → win-switcher)
{ type: 'FOCUS_WINDOW', pid: number }

// Win-switcher response (optional, for feedback)
{ type: 'FOCUS_WINDOW_RESULT', success: boolean, windowId?: number }
```

### D4: PID-based window matching via ppid chain

**Decision**: New Win-Switcher endpoint `POST /api/windows/focus-by-pid` accepts `{ pid: number }`, traverses the ppid chain server-side using `ps -o ppid= -p <pid>`, finds the terminal window PID, then matches against the CGWindowList.

**Rationale**: CC Monitor knows the `claude` process PID. The terminal window's PID is the ancestor of that process. Server-side traversal keeps the logic in one place and avoids exposing process tree data to the frontend.

**ppid traversal**:
```
claude (pid: 54321)
  → ppid: zsh (54320)
    → ppid: Terminal.app (12000)  ← match against window list
```

Stop traversal when parent app is a known terminal emulator (Terminal, iTerm2, Warp, Alacritty, kitty, Hyper).

### D5: react-grid-layout for portal desktop

**Decision**: Use `react-grid-layout` (MIT, ~40KB) for the draggable/resizable grid.

**Rationale**: Mature library purpose-built for this use case. Handles drag, resize, collision avoidance, and layout serialization out of the box. The alternative (hand-rolling drag+resize) would be hundreds of lines of complex pointer event handling.

**Layout model**: Each widget has `{ i: toolName, x, y, w, h }` in grid units (12-column grid, row height 60px). Serialized to `localStorage` key `portal-desktop-layout`.

### D6: Portal renders widget window chrome

**Decision**: The portal's `WidgetWindow` component renders the title bar (tool name, status dot, minimize/maximize/close). The iframe fills the content area below.

**Rationale**: Uniform chrome across all widgets. Tools don't need to implement their own window decorations. Status dot can be driven by the portal's existing tool status polling.

### D7: tool.yaml widget block

**Decision**: Add optional `widget` block to `tool.yaml`:
```yaml
widget:
  minW: 3        # grid columns (of 12)
  minH: 4        # grid rows
  defaultW: 4
  defaultH: 6
  route: /       # path appended to tool URL for widget mode (default: /)
```

The `?mode=widget` param is always appended by the portal. `route` allows tools to specify a sub-path if needed (default `/`).

## Risks / Trade-offs

- **iframe focus/blur**: When user clicks a win-switcher card, macOS switches focus away from the browser. This is expected behavior — no mitigation needed.
- **iframe scroll isolation**: Nested scrolling in iframes can feel awkward. Widget views should minimize internal scrolling (show fewer items, not scroll).
- **ppid chain reliability**: Terminal emulator detection by app name is heuristic. Unknown terminals fall back to no-op with a console warning.
- **react-grid-layout bundle size**: Adds ~40KB to portal bundle. Acceptable for a local dev tool.
- **localStorage layout drift**: If a tool is removed, its widget entry stays in localStorage. Portal should filter layout entries against available tools on load.

## Migration Plan

1. Add `react-grid-layout` to portal package
2. Implement widget mode in each tool (win-switcher first, then cc-monitor, bookmarks)
3. Build portal Desktop + WidgetWindow components
4. Wire postMessage bus
5. Add `focus-by-pid` endpoint to win-switcher
6. Update `tool.yaml` files and shared types
7. Test end-to-end: CC Monitor click → win-switcher focus

No data migration needed. No breaking API changes to existing tool endpoints.

## Open Questions

- Should minimized widgets collapse to just the title bar (saves space) or be removed from the grid? → Propose: collapse to title bar only, restore on click.
- Should the portal show the old tool card grid as a fallback when no widgets are configured? → No, show empty desktop with "Add Widget" prompt.
