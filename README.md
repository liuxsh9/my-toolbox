# My Toolbox

Local tool portal platform — manage all your locally-running developer tools from a single dashboard.

本地工具门户平台 — 在一个入口管理你所有的小工具。

## Features

- **Auto-discovery** — Tools in the monorepo are discovered automatically via `tool.yaml`
- **Health monitoring** — Periodic health checks with status tracking
- **Claude Code Monitor** — Real-time session monitoring for [Claude Code](https://claude.ai/code) via hooks and process scanning
- **SDK registration** — External tools can register via HTTP API or the `@my-toolbox/shared` SDK

## Prerequisites

- Node.js >= 20
- pnpm (`npm install -g pnpm`)
- PM2 (`npm install -g pm2`)

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start with PM2
pm2 start ecosystem.config.js
```

| Service    | URL                    | Description        |
|------------|------------------------|--------------------|
| Portal     | http://localhost:3000   | Tool dashboard     |
| CC Monitor | http://localhost:3001   | Claude Code monitor |

## Development

```bash
# Portal (backend :3000 + Vite :5173)
pnpm dev:portal

# CC Monitor (backend :3001 + Vite :5174)
pnpm dev:cc-monitor
```

## Claude Code Hooks

Install hooks so all Claude Code sessions report to the monitor:

```bash
node packages/cc-monitor/scripts/hooks-install.js    # install
node packages/cc-monitor/scripts/hooks-uninstall.js  # uninstall
```

## Project Structure

```
my-toolbox/
├── packages/
│   ├── shared/          # Types and registration SDK
│   ├── portal/          # Dashboard + tool registry (SQLite)
│   └── cc-monitor/      # Claude Code session monitor
├── ecosystem.config.js  # PM2 config
└── pnpm-workspace.yaml
```

## Registering External Tools

```bash
curl -X POST http://localhost:3000/api/tools/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "my-tool",
    "displayName": "My Tool",
    "description": "Tool description",
    "version": "0.1.0",
    "url": "http://localhost:4001",
    "health": "/api/health"
  }'
```

Or via SDK:

```typescript
import { registerTool } from '@my-toolbox/shared'

registerTool({
  manifest: {
    name: 'my-tool',
    displayName: 'My Tool',
    description: 'Tool description',
    version: '0.1.0',
    url: 'http://localhost:4001',
    health: '/api/health',
  },
  portalUrl: 'http://localhost:3000',
})
```

## Port Conventions

| Port  | Service                  |
|-------|--------------------------|
| 3000  | Portal                   |
| 3001  | CC Monitor               |
| 3002+ | Additional monorepo tools |
| 4001+ | External registered tools |

## License

[MIT](LICENSE)
