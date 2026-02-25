# My Toolbox

A local tool portal platform — manage all your locally-running developer tools from a single desktop dashboard.

## Features

- **Desktop widget grid** — Drag, resize, minimize, and maximize tools as widgets on a unified desktop
- **Auto-discovery** — Tools in the monorepo are discovered automatically via `tool.yaml`
- **Health monitoring** — Periodic health checks with real-time status indicators
- **Claude Code Monitor** — Real-time session monitoring for [Claude Code](https://claude.ai/code) via hooks and process scanning
- **Notifications** — macOS system notification capture via Accessibility API
- **SDK registration** — External tools can register via HTTP API or the `@my-toolbox/shared` SDK

## Quick Start

**Prerequisites:** Node.js >= 20, [pnpm](https://pnpm.io/), [PM2](https://pm2.io/)

```bash
pnpm install
pnpm build
pm2 start ecosystem.config.js
```

| Service       | URL                   | Description                  |
|---------------|-----------------------|------------------------------|
| Portal        | http://localhost:3000 | Desktop dashboard            |
| CC Monitor    | http://localhost:3001 | Claude Code session monitor  |
| Bookmarks     | http://localhost:3002 | Web bookmark manager         |
| Win Switcher  | http://localhost:3003 | macOS window switcher        |
| Notifications | http://localhost:3004 | System notification center   |
| Notes         | http://localhost:3005 | Lightweight notepad          |

## Development

```bash
pnpm dev:portal                              # Portal: backend :3000 + Vite :5173
pnpm dev:cc-monitor                          # CC Monitor: backend :3001 + Vite :5174
pnpm --filter @my-toolbox/bookmarks dev      # Bookmarks: backend :3002 + Vite :5175
pnpm --filter @my-toolbox/win-switcher dev   # Win Switcher: backend :3003 + Vite :5176
pnpm --filter @my-toolbox/notes dev          # Notes: backend :3005 + Vite :5178
```

## Project Structure

```
my-toolbox/
├── packages/
│   ├── shared/        # Types and registration SDK
│   ├── portal/        # Desktop dashboard + tool registry (SQLite)
│   ├── cc-monitor/    # Claude Code session monitor
│   ├── bookmarks/     # Web bookmark manager with screenshot support
│   ├── win-switcher/  # macOS window switcher (Swift native)
│   ├── notifications/ # macOS notification capture (AX API)
│   └── notes/         # Lightweight notepad (SQLite)
├── ecosystem.config.js
└── pnpm-workspace.yaml
```

## Claude Code Hooks

```bash
node packages/cc-monitor/scripts/hooks-install.js    # install
node packages/cc-monitor/scripts/hooks-uninstall.js  # uninstall
```

## Registering External Tools

Via HTTP:

```bash
curl -X POST http://localhost:3000/api/tools/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "my-tool",
    "displayName": "My Tool",
    "description": "Tool description",
    "url": "http://localhost:4001",
    "health": "/api/health"
  }'
```

Via SDK:

```typescript
import { registerTool } from '@my-toolbox/shared'

registerTool({
  manifest: {
    name: 'my-tool',
    displayName: 'My Tool',
    description: 'Tool description',
    url: 'http://localhost:4001',
    health: '/api/health',
  },
  portalUrl: 'http://localhost:3000',
})
```

## License

[MIT](LICENSE)
