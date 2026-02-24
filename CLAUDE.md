# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this

My Toolbox is a local tool portal platform — a pnpm monorepo that manages and displays locally-running developer tools from a single dashboard. Tools register with the portal (automatically via `tool.yaml` discovery or via HTTP/SDK) and the portal tracks their health status.

## Commands

```bash
pnpm install                  # Install all dependencies
pnpm build                    # Build all packages (shared → portal → cc-monitor)
pnpm dev:portal               # Dev mode for portal (Fastify :3000 + Vite :5173)
pnpm dev:cc-monitor           # Dev mode for cc-monitor (Fastify :3001 + Vite :5174)
pm2 start ecosystem.config.js # Production start via PM2
pm2 status                    # Check running services
pm2 logs portal               # Tail logs for a specific service
```

Build a single package: `pnpm --filter @my-toolbox/portal build`

No test framework is configured yet.

## Architecture

**Monorepo layout** (`packages/*`, pnpm workspaces):

- **`shared`** — Types (`ToolManifest`, `ToolInfo`, `ToolStatus`) and `registerTool()` SDK for external tools to register + heartbeat with the portal. All other packages depend on this; build it first.
- **`portal`** (port 3000) — The main dashboard. Fastify server with SQLite (`better-sqlite3`, WAL mode) for the tool registry, plus a React+Vite SPA frontend.
- **`cc-monitor`** (port 3001) — Claude Code session monitor. Collects events via hooks, scans processes, and registers itself with the portal using the shared SDK.

**Each tool package follows the same structure:**
- `src/server/` — Fastify backend (compiled via `tsc -p tsconfig.server.json` → `dist/server/`)
- `src/web/` — React SPA (built via Vite → `dist/web/`)
- `tool.yaml` — Tool manifest for auto-discovery by the portal
- Dev mode runs both concurrently; the Vite dev server proxies `/api/*` to the backend

**Portal background services** (started after listen):
- `discovery` — Scans `packages/*/tool.yaml` at startup, upserts local tools into SQLite
- `heartbeat` — Checks heartbeat freshness, marks tools as unreachable
- `healthcheck` — Periodically hits each tool's health endpoint, updates status

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

## Port Conventions

| Port | Service |
|------|---------|
| 3000 | Portal |
| 3001 | CC Monitor |
| 3002+ | Additional monorepo tools |
| 4001+ | External registered tools |

## Tech Stack

TypeScript (ESM, target ES2022), Fastify, React + Vite, SQLite (better-sqlite3), PM2. Node.js >= 20 required.

## CC Monitor Hooks

Claude Code hooks send events to `http://localhost:3001/api/events`. Install/uninstall:
```bash
node packages/cc-monitor/scripts/hooks-install.js
node packages/cc-monitor/scripts/hooks-uninstall.js
```
