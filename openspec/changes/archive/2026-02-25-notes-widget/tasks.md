## 1. Package Scaffold

- [x] 1.1 Create `packages/notes/` directory structure (`src/server/`, `src/web/`, `data/`)
- [x] 1.2 Create `packages/notes/package.json` with name `@my-toolbox/notes`, dependencies (fastify, better-sqlite3, @my-toolbox/shared)
- [x] 1.3 Create `packages/notes/tsconfig.server.json` extending `../../tsconfig.base.json`
- [x] 1.4 Create `packages/notes/src/web/vite.config.ts` with proxy to port 3005
- [x] 1.5 Create `packages/notes/tool.yaml` (port 3005, minW:2 minH:3, defaultW:4 defaultH:6)

## 2. Backend

- [x] 2.1 Create `src/server/db.ts` — init SQLite, create `notes` table (id TEXT PK, content TEXT, created_at INTEGER, updated_at INTEGER)
- [x] 2.2 Create `src/server/routes/notes.ts` — GET /api/notes, POST /api/notes, PUT /api/notes/:id, DELETE /api/notes/:id
- [x] 2.3 Create `src/server/routes/health.ts` — GET /api/health
- [x] 2.4 Create `src/server/index.ts` — Fastify server, register routes, serve SPA, call registerTool()
- [x] 2.5 Add `notes` PM2 entry to `ecosystem.config.js`

## 3. Frontend

- [x] 3.1 Create `src/web/main.tsx` — React entry point, detect `?mode=widget`
- [x] 3.2 Create `src/web/App.tsx` — two-view state machine (list | edit), fetch notes on mount
- [x] 3.3 Implement list view — note items with extracted title + relative timestamp, [+] new note button, empty state
- [x] 3.4 Implement edit view — full-height `<textarea>`, 500ms debounce auto-save, `· saved` indicator, ← back button
- [x] 3.5 Implement inline delete confirmation — trash icon → "确认删除？" → confirm/cancel with 3s timeout
- [x] 3.6 Create `src/web/index.css` — CSS custom properties matching portal design tokens (--bg, --surface, --border, --text-1/2/3, --accent)

## 4. Portal Integration

- [x] 4.1 Update `Desktop.tsx` default layout to include `notes` at position x:0 y:8 w:4 h:6 (below win-switcher)
- [x] 4.2 Update `Desktop.tsx` `getDefaultLayout` minW/minH fallback from 3/4 to 2/3
- [x] 4.3 Update `win-switcher/tool.yaml` widget constraints to minW:2 minH:3
- [x] 4.4 Update `bookmarks/tool.yaml` widget constraints to minW:2 minH:3
- [x] 4.5 Update `cc-monitor/tool.yaml` widget constraints to minW:2 minH:3

## 5. Build Wiring

- [x] 5.1 Add `notes` to pnpm workspace (`pnpm-workspace.yaml` if needed, or verify auto-detection)
- [x] 5.2 Run `pnpm install` to link workspace dependencies
- [x] 5.3 Build `@my-toolbox/shared` then `@my-toolbox/notes` to verify TypeScript compiles clean
