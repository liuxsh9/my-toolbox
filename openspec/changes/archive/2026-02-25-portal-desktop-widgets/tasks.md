## 1. Shared Types & tool.yaml

- [x] 1.1 Add `widget` optional block to `ToolManifest` type in `packages/shared/src/types.ts` (minW, minH, defaultW, defaultH)
- [x] 1.2 Update portal's `tool.yaml` discovery parser to read and pass through the `widget` block
- [x] 1.3 Update `tool.yaml` for win-switcher, cc-monitor, and bookmarks with appropriate widget size constraints

## 2. Win-Switcher: focus-by-pid API

- [x] 2.1 Add ppid chain traversal utility in `packages/win-switcher/src/server/services/native.ts` — given a PID, walk ppid chain until a known terminal emulator is found
- [x] 2.2 Add `POST /api/windows/focus-by-pid` route in `packages/win-switcher/src/server/routes/windows.ts`
- [x] 2.3 Return `{ ok: true, windowId, app }` on success; `{ ok: false, error }` with 404 on failure cases (process not found, no terminal ancestor, window not in list)

## 3. Win-Switcher: widget mode

- [x] 3.1 Detect `?mode=widget` in `packages/win-switcher/src/web/App.tsx` and pass mode down as prop/context
- [x] 3.2 Create compact `WidgetView` component: no header/title, tighter grid (minmax ~120px), smaller thumbnails, single-line app+title labels
- [x] 3.3 Add `window.addEventListener('message', ...)` in widget mode to handle `{ type: 'FOCUS_WINDOW', pid }` — call `/api/windows/focus-by-pid` and briefly highlight matched card
- [x] 3.4 Update `packages/win-switcher/tool.yaml` with `widget: { minW: 3, minH: 5, defaultW: 5, defaultH: 7 }`

## 4. CC Monitor: widget mode

- [x] 4.1 Detect `?mode=widget` in `packages/cc-monitor/src/web/App.tsx`
- [x] 4.2 Create compact `WidgetView` component: no header, sessions as compact rows (project name, status dot, last tool, uptime), hide ended sessions by default
- [x] 4.3 On session row click in widget mode: if session has a PID, call `window.parent.postMessage({ type: 'FOCUS_WINDOW', pid, cwd }, '*')`
- [x] 4.4 Update `packages/cc-monitor/tool.yaml` with `widget: { minW: 3, minH: 4, defaultW: 4, defaultH: 6 }`

## 5. Bookmarks: widget mode

- [x] 5.1 Detect `?mode=widget` in `packages/bookmarks/src/web/App.tsx`
- [x] 5.2 Create compact `WidgetView` component: no header chrome, tighter card grid (minmax ~100px), thumbnail-only cards with title on hover, keep "+ 添加" button
- [x] 5.3 Category filter tabs hidden in widget mode (show all or most recent)
- [x] 5.4 Update `packages/bookmarks/tool.yaml` with `widget: { minW: 3, minH: 4, defaultW: 4, defaultH: 6 }`

## 6. Portal: Desktop layout engine

- [x] 6.1 Add `react-grid-layout` dependency to `packages/portal/package.json` and run `pnpm install`
- [x] 6.2 Create `packages/portal/src/web/components/Desktop.tsx` — main desktop container using `ReactGridLayout`, 12-column grid, row height 60px, draggable + resizable
- [x] 6.3 Implement layout persistence: load from `localStorage` key `portal-desktop-layout` on mount; save on every layout change; filter out stale entries for unregistered tools
- [x] 6.4 Implement default layout: if no saved layout, pre-populate with win-switcher (x:0,y:0,w:5,h:7), cc-monitor (x:5,y:0,w:4,h:6), bookmarks (x:0,y:7,w:4,h:6)
- [x] 6.5 Implement "+ Add Widget" button and picker modal: list tools not currently on desktop, click to add at a free position

## 7. Portal: WidgetWindow component

- [x] 7.1 Create `packages/portal/src/web/components/WidgetWindow.tsx` — renders title bar (tool displayName, status dot, −/□/× buttons) + iframe content area
- [x] 7.2 Implement minimize: collapse to title bar only (iframe `display:none`), restore on title bar click
- [x] 7.3 Implement maximize: overlay mode covering full desktop area, restore button returns to grid position
- [x] 7.4 Implement close: remove widget from layout state (triggers localStorage save)
- [x] 7.5 Wire status dot to portal's tool polling — pass `ToolInfo.status` from parent Desktop into each WidgetWindow

## 8. Portal: postMessage message bus

- [x] 8.1 In `Desktop.tsx`, add `window.addEventListener('message', handleMessage)` on mount
- [x] 8.2 Implement `handleMessage`: for `type: 'FOCUS_WINDOW'`, find the win-switcher iframe ref and forward the message via `iframeRef.contentWindow.postMessage(...)`
- [x] 8.3 Store iframe refs in a `Map<toolName, RefObject<HTMLIFrameElement>>` in Desktop state

## 9. Portal: replace Dashboard with Desktop

- [x] 9.1 Replace `<Dashboard>` with `<Desktop>` in `packages/portal/src/web/App.tsx`
- [x] 9.2 Pass tool list (from existing `/api/tools` polling) into Desktop as props
- [x] 9.3 Remove old `Dashboard.tsx` component (or keep as dead code until Desktop is verified working)

## 10. Integration & polish

- [ ] 10.1 End-to-end test: open portal, verify three widgets load with correct iframe content
- [ ] 10.2 End-to-end test: click a CC Monitor session → verify win-switcher focuses the terminal window
- [ ] 10.3 End-to-end test: drag/resize widgets → reload page → verify layout restored
- [ ] 10.4 Verify widget mode hides chrome correctly for all three tools
- [x] 10.5 Update `pnpm-lock.yaml` after adding react-grid-layout (run `pnpm install`)
