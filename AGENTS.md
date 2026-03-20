# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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
pnpm --filter @my-toolbox/notes dev          # Dev mode for notes (:3005 + :5178)
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
| `PORT` | 3000–3008 | all tool packages |
| `PORTAL_URL` | `http://localhost:3000` | all tool packages (for SDK registration) |
| `CC_MONITOR_URL` | `http://localhost:3001` | hooks-install script |
| `NOTIFICATIONS_URL` | `http://localhost:3004` | cc-monitor (push notifications) |
| `LITELLM_URL` | `http://localhost:4000` | litellm-monitor |
| `LITELLM_KEY` | — | litellm-monitor (API key for LiteLLM) |

## Architecture

**Monorepo layout** (`packages/*`, pnpm workspaces):

- **`shared`** — Types (`ToolManifest`, `ToolInfo`, `ToolStatus`) and `registerTool()` SDK for external tools to register + heartbeat with the portal. All other packages depend on this; build it first.
- **`portal`** (port 3000) — The main dashboard. Fastify server with SQLite (`better-sqlite3`, WAL mode) for the tool registry, plus a React+Vite SPA frontend. Desktop-style widget grid with drag/resize/minimize/maximize.
- **`cc-monitor`** (port 3001) — Codex session monitor. Collects events via hooks, scans processes, and registers itself with the portal using the shared SDK.
- **`bookmarks`** (port 3002) — Web bookmark manager with screenshot support. SQLite for storage, og:image fetching, multipart upload, drag-and-drop reordering.
- **`win-switcher`** (port 3003) — macOS window switcher. Lists all open windows across Spaces via CGWindowList, captures thumbnails via `screencapture`, focuses windows via AX + private CGS APIs. Includes a native Swift script (`src/native/windows.swift`).
- **`notifications`** (port 3004) — Unified notification inbox. Receives push notifications from other tools and captures macOS system notifications via a native Swift banner-watcher. In-memory storage (ephemeral). Real-time updates via SSE.
- **`notes`** (port 3005) — Lightweight notepad. SQLite for storage.
- **`litellm-monitor`** (port 3006) — LiteLLM request statistics dashboard. Connects to an external PostgreSQL database (`LiteLLM_SpendLogs` table) to aggregate request counts, success/failure rates, and RPS. Refreshes every 3s. Note: uses `pg` (PostgreSQL), not SQLite.
- **`work-hours`** (port 3007) — Work hours tracker. Automatically records clock-in/out via a native Swift daemon that monitors screen lock/unlock and HID idle events. SQLite for daily summaries. Supports holiday calendars and manual time entry.
- **`api-quota`** (port 3008) — API daily usage quota monitor. Fetches quota from an upstream endpoint. File-based session storage (`data/session.json`). Supports HTTP proxy.

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
| 3004 | Notifications | 5177 |
| 3005 | Notes | 5178 |
| 3006 | LiteLLM Monitor | 5179 |
| 3007 | Work Hours | 5180 |
| 3008 | API Quota | 5181 |
| 4001+ | External registered tools | — |

## Tech Stack

TypeScript (ESM, target ES2022), Fastify, React + Vite, SQLite (better-sqlite3, WAL mode), PM2. Node.js >= 20 required. All PM2 entries use `--experimental-specifier-resolution=node` for ESM.

## CC Monitor Hooks

Codex hooks send events to `http://localhost:3001/api/events`. Install/uninstall:
```bash
node packages/cc-monitor/scripts/hooks-install.js
node packages/cc-monitor/scripts/hooks-uninstall.js
```

Hooks are installed into `~/.Codex/settings.json` and fire asynchronously (non-blocking) on: `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, `Notification`, `UserPromptSubmit`, `SessionEnd`.

CC Monitor also scans for `Codex` processes every 15s via `ps` + `lsof` and merges process-detected sessions with hook-reported sessions by matching cwd.

## Native Swift Components

Three packages include Swift scripts executed at runtime (not compiled ahead of time). All require macOS permissions.

- **`win-switcher/src/native/windows.swift`** — Enumerates windows via CGWindowList, focuses windows via AXUIElement + private CGS APIs. Commands: `list`, `focus <wid> <pid> <title>`, `focus-by-cwd <pid> <cwd>`, `check-permissions`. Called via `execFile('swift', [script, ...])`. Thumbnails cached in `/tmp/winswitcher/` (15s TTL, max 4 concurrent captures). Requires Screen Recording + Accessibility permissions. The `focus-by-cwd` command is preferred for Electron apps (VS Code, Cursor) which don't expose AX windows.

- **`notifications/src/native/banner-watcher.swift`** — Watches macOS notification banners via Accessibility API, parses title/body/source, and POSTs captured notifications to the notifications service. Runs as a separate PM2 process (`banner-watcher` in `ecosystem.config.js`), not spawned by Node.js. Requires Accessibility permission. Has a blocklist to filter system UI elements.

- **`work-hours/src/native/monitor.swift`** — Monitors screen lock/unlock via DistributedNotificationCenter and HID idle time (300s threshold). Outputs JSON lines to stdout, consumed by the Node.js server via `spawn()`. Event types: `screen_lock`, `screen_unlock`, `idle_start`, `idle_end`. Requires no special permissions beyond what the parent process has.

## UI/UX 设计红线 (修改前端代码时严格执行)
- 严禁使用系统默认的通用蓝色系 (如 Tailwind 的 blue-500) 作为唯一主色调。
- 放弃均匀呆板的网格堆叠，强制引入非对称布局和大面积留白 (Negative space)。
- 字体排印：标题必须有极强的字重对比，正文颜色降低对比度 (如 text-gray-600) 以突出层级。
- 避免滥用纯白背景+深色阴影的"卡片风"，优先考虑通过极细的边框或微弱的背景色差来划分区域。
- 前端使用 inline styles + CSS custom properties，不使用 Tailwind 等 CSS 框架。

## 统一色板 (所有 widget 必须遵守)

所有工具的暗色主题必须使用以下暖棕色系，禁止使用 Tailwind slate/gray 冷色系或纯黑 (#0a0a0a, #0f0f0f, #111210 等)。

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#1a1816` | 主背景 |
| `--surface` | `#221f17` | 卡片/面板 |
| `--surface2` | `#2a2720` | 次级面板、hover 状态 |
| `--text-1` | `#ede8de` | 主文字 |
| `--text-2` | `#8c8680` | 次要文字 |
| `--text-3` | `#4a4844` | 弱化文字 |
| `--border` | `rgba(255,255,255,0.09)` | 主边框 |
| `--border2` | `rgba(255,255,255,0.05)` | 弱边框 |
| `--accent` | `#d4a040` | 强调色 |

各包的 CSS 变量名可能略有不同 (如 `--text-primary`, `--muted`, `--wh-bg` 等)，但色值必须对应上表。

## 前端规范

- 每个工具包的 `src/web/` 必须有 `index.css`，在其中设置 `:root` 变量和 `html, body, #root { height: 100%; overflow: hidden; }` 以确保 iframe 嵌入时背景铺满、不漏边。
- `index.css` 必须在 `main.tsx` 中 import。
- 禁止在 App.tsx 的根 div 上通过 inline style 设置 CSS 变量 (如 `'--bg': '#xxx'`)，应统一放在 `index.css` 中。
- Widget 内的列表项使用 `borderBottom: '1px solid var(--border)'` 作为分隔线。
- 文案语言：widget 标题栏 (portal WidgetWindow 的 displayName) 和 widget 内部的 section header 统一使用英文大写标签 (如 "NOTES", "NOTIFICATIONS")。

## 已知问题

- **portal discovery 不更新 displayName**: `tool.yaml` 的 `displayName` 修改后，portal 的 discovery upsert 不会覆盖 SQLite 中已有的值。需要手动更新数据库：`sqlite3 packages/portal/data/portal.db "UPDATE tools SET displayName='NewName' WHERE name='tool-name';"`
