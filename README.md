# My Toolbox

A local tool portal platform — manage all your locally-running developer tools from a single dashboard.

## ✨ Features

- **Auto-discovery** — Tools in the monorepo are discovered automatically via `tool.yaml`
- **Health monitoring** — Periodic health checks with real-time status tracking
- **Claude Code Monitor** — Real-time session monitoring for [Claude Code](https://claude.ai/code) via hooks and process scanning
- **SDK registration** — External tools can register via HTTP API or the `@my-toolbox/shared` SDK

## 🚀 Quick Start

**Prerequisites:** Node.js >= 20, [pnpm](https://pnpm.io/), [PM2](https://pm2.io/)

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Build all packages

   ```bash
   pnpm build
   ```

3. Start with PM2

   ```bash
   pm2 start ecosystem.config.js
   ```

| Service    | URL                  | Description         |
|------------|----------------------|---------------------|
| Portal     | http://localhost:3000 | Tool dashboard      |
| CC Monitor | http://localhost:3001 | Claude Code monitor |

## ⚙️ Development

Dev mode runs both backend and frontend with hot-reload:

```bash
pnpm dev:portal       # Backend :3000 + Vite :5173
pnpm dev:cc-monitor   # Backend :3001 + Vite :5174
```

## 🔗 Claude Code Hooks

Install hooks so all Claude Code sessions report to the monitor automatically:

```bash
node packages/cc-monitor/scripts/hooks-install.js    # install
node packages/cc-monitor/scripts/hooks-uninstall.js  # uninstall
```

After installing, new Claude Code sessions will appear in the monitor dashboard in real-time.

## 🛠️ Project Structure

```
my-toolbox/
├── packages/
│   ├── shared/          # Types and registration SDK
│   ├── portal/          # Dashboard + tool registry (SQLite)
│   └── cc-monitor/      # Claude Code session monitor
├── ecosystem.config.js  # PM2 config
└── pnpm-workspace.yaml
```

## 📡 Registering External Tools

Via HTTP:

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

Via SDK:

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

## 📄 License

[MIT](LICENSE)
