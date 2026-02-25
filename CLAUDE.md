# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this

My Toolbox is a local tool portal platform — a pnpm monorepo that manages and displays locally-running developer tools from a single dashboard. Tools register with the portal (automatically via `tool.yaml` discovery or via HTTP/SDK) and the portal tracks their health status.

## Commands

```bash
pnpm install                  # Install all dependencies
pnpm build                    # Build all packages in dependency order
pnpm dev:portal               # Dev mode for portal (Fastify :3000 + Vite :5173)
pnpm dev:cc-monitor           # Dev mode for cc-monitor (Fastify :3001 + Vite :5174)
pnpm --filter @my-toolbox/bookmarks dev      # Dev mode for bookmarks (:3002 + :5175)
pnpm --filter @my-toolbox/win-switcher dev   # Dev mode for win-switcher (:3003 + :5176)
pm2 start ecosystem.config.js # Production start via PM2
pm2 restart <name>            # Restart a single service after rebuild
pm2 status                    # Check running services
pm2 logs <name>               # Tail logs for a specific service
```

Build a single package (build `shared` first if it has changed): `pnpm --filter @my-toolbox/shared build && pnpm --filter @my-toolbox/portal build`

No test framework is configured yet.

**Environment variables** (set in `ecosystem.config.js` for production; override for local dev):

| Variable | Default | Used by |
|----------|---------|---------|
| `PORT` | 3000 / 3001 / 3002 / 3003 | all tool packages |
| `PORTAL_URL` | `http://localhost:3000` | cc-monitor, bookmarks, win-switcher |
| `CC_MONITOR_URL` | `http://localhost:3001` | hooks-install script |
| `NOTIFICATIONS_URL` | `http://localhost:3004` | cc-monitor (push notifications) |

## Architecture

**Monorepo layout** (`packages/*`, pnpm workspaces):

- **`shared`** — Types (`ToolManifest`, `ToolInfo`, `ToolStatus`) and `registerTool()` SDK for external tools to register + heartbeat with the portal. All other packages depend on this; build it first.
- **`portal`** (port 3000) — The main dashboard. Fastify server with SQLite (`better-sqlite3`, WAL mode) for the tool registry, plus a React+Vite SPA frontend.
- **`cc-monitor`** (port 3001) — Claude Code session monitor. Collects events via hooks, scans processes, and registers itself with the portal using the shared SDK.
- **`bookmarks`** (port 3002) — Web bookmark manager with screenshot support. SQLite for storage, og:image fetching, multipart upload, drag-and-drop reordering.
- **`win-switcher`** (port 3003) — macOS window switcher. Lists all open windows across Spaces via CGWindowList, captures thumbnails via `screencapture`, focuses windows via AX + private CGS APIs. Includes a native Swift script (`src/native/windows.swift`).

**Each tool package follows the same structure:**
- `src/server/` — Fastify backend (compiled via `tsc -p tsconfig.server.json` → `dist/server/`)
- `src/web/` — React SPA (built via Vite → `dist/web/`)
- `tool.yaml` — Tool manifest for auto-discovery by the portal
- Dev mode runs both concurrently (`tsx watch` for server + `vite` for frontend); the Vite dev server proxies `/api/*` to the backend

**Portal background services** (started after listen):
- `discovery` — Scans `packages/*/tool.yaml` at startup, upserts local tools into SQLite
- `heartbeat` — Checks heartbeat freshness (90s timeout), marks tools as unreachable
- `healthcheck` — Periodically hits each tool's health endpoint (60s interval), updates status

**Tool registration flow:**
1. Local tools (in monorepo): discovered automatically via `tool.yaml`
2. Remote tools: `POST /api/tools/register` or use `registerTool()` from `@my-toolbox/shared`
3. Heartbeats: `PUT /api/tools/:name/heartbeat` (SDK sends these every 30s)

## Adding a New Tool to the Monorepo

1. Create `packages/<tool-name>/` with `tool.yaml`, `package.json` (name: `@my-toolbox/<tool-name>`), and the `src/server/` + `src/web/` structure
2. Add a `tsconfig.server.json` extending `../../tsconfig.base.json`
3. Add a Vite config at `src/web/vite.config.ts` with proxy to the backend port
4. Add a PM2 entry in `ecosystem.config.js`
5. The portal discovers it automatically from `tool.yaml`

**`tool.yaml` required fields:** `name`, `url`. Optional: `displayName`, `description`, `version`, `health` (default: `/api/health`), `icon`, `category`, `pm2Name`.

**SQLite databases** live at `packages/<tool>/data/*.db` (created automatically on first run, gitignored).

## Port Conventions

| Port | Service | Vite Dev |
|------|---------|----------|
| 3000 | Portal | 5173 |
| 3001 | CC Monitor | 5174 |
| 3002 | Bookmarks | 5175 |
| 3003 | Win-Switcher | 5176 |
| 3004+ | Additional monorepo tools | 5177+ |
| 4001+ | External registered tools | — |

## Tech Stack

TypeScript (ESM, target ES2022), Fastify, React + Vite, SQLite (better-sqlite3, WAL mode), PM2. Node.js >= 20 required. All PM2 entries use `--experimental-specifier-resolution=node` for ESM.

## Win-Switcher Native Component

`packages/win-switcher/src/native/windows.swift` is a Swift script executed at runtime (not compiled ahead of time). It supports four commands:

- **`list`** — enumerate all windows via CGWindowListCopyWindowInfo (requires Screen Recording permission)
- **`focus <wid> <pid> <title>`** — raise a specific window via AXUIElement (requires Accessibility permission); raises first then activates to avoid macOS bringing the wrong window to front
- **`focus-by-cwd <pid> <cwd>`** — walk the ppid chain from `pid` to find the first ancestor app, then call `NSWorkspace.open([cwdURL], withApplicationAt:)` to focus the correct project window. This is the preferred method for Electron apps (VS Code, Cursor) which don't expose AX windows.
- **`check-permissions`** — returns `{accessibility, screenRecording}` booleans

The server calls it via `execFile('swift', [script, command, ...args])`. Thumbnails are cached in `/tmp/winswitcher/` with 15s TTL and max 4 concurrent captures.

The `POST /api/windows/focus-by-pid` route accepts `{pid, cwd?}`. When `cwd` is provided it uses `focus-by-cwd`; otherwise it falls back to window-list matching + `focus`.

## CC Monitor Hooks

Claude Code hooks send events to `http://localhost:3001/api/events`. Install/uninstall:
```bash
node packages/cc-monitor/scripts/hooks-install.js
node packages/cc-monitor/scripts/hooks-uninstall.js
```

Hooks are installed into `~/.claude/settings.json` and fire asynchronously (non-blocking) on: `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, `Notification`, `UserPromptSubmit`, `SessionEnd`.

CC Monitor also scans for `claude` processes every 15s via `ps` + `lsof` and merges process-detected sessions with hook-reported sessions by matching cwd.

## UI/UX 设计红线 (修改前端代码时严格执行)
- 严禁使用系统默认的通用蓝色系 (如 Tailwind 的 blue-500) 作为唯一主色调。
- 放弃均匀呆板的网格堆叠，强制引入非对称布局和大面积留白 (Negative space)。
- 字体排印：标题必须有极强的字重对比，正文颜色降低对比度 (如 text-gray-600) 以突出层级。
- 避免滥用纯白背景+深色阴影的"卡片风"，优先考虑通过极细的边框或微弱的背景色差来划分区域。
- 前端使用 inline styles + CSS custom properties，不使用 Tailwind 等 CSS 框架。
