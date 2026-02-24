# My Toolbox

本地工具门户平台 — 在一个入口管理你所有的小工具。

## 前置要求

- Node.js >= 20
- pnpm (`npm install -g pnpm`)
- PM2 (`npm install -g pm2`)

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 构建全部包

```bash
pnpm build
```

### 3. 用 PM2 启动

```bash
pm2 start ecosystem.config.js
```

启动后：

| 服务 | 地址 | 说明 |
|------|------|------|
| Portal | http://localhost:3000 | 工具门户 Dashboard |
| CC Monitor | http://localhost:3001 | Claude Code 监控面板 |

### 4. 查看运行状态

```bash
pm2 status
pm2 logs          # 查看实时日志
pm2 logs portal   # 只看门户日志
```

### 5. 停止服务

```bash
pm2 stop all      # 停止
pm2 delete all    # 停止并移除
```

## 开发模式

开发时使用热重载，前后端同时启动：

```bash
# 启动门户（后端 :3000 + 前端 Vite :5173）
pnpm dev:portal

# 启动 Monitor（后端 :3001 + 前端 Vite :5174）
pnpm dev:cc-monitor
```

开发模式下前端通过 Vite proxy 转发 `/api/*` 到后端，直接访问 Vite 地址即可。

## 安装 Claude Code Hooks

让所有 Claude Code 实例自动上报状态到 Monitor：

```bash
cd packages/cc-monitor
node scripts/hooks-install.js
```

安装后新开的 Claude Code 会话会自动向 `http://localhost:3001/api/events` 上报事件。

卸载：

```bash
node scripts/hooks-uninstall.js
```

## 项目结构

```
my-toolbox/
├── packages/
│   ├── shared/          # 公共类型和注册 SDK
│   ├── portal/          # 门户服务（Dashboard + 工具注册表）
│   └── cc-monitor/      # Claude Code 监控工具
├── ecosystem.config.js  # PM2 配置
└── pnpm-workspace.yaml
```

## 注册外部工具

monorepo 内的工具（带 `tool.yaml`）会在门户启动时自动发现注册。外部工具通过 HTTP 注册：

```bash
curl -X POST http://localhost:3000/api/tools/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "my-tool",
    "displayName": "My Tool",
    "description": "工具描述",
    "version": "0.1.0",
    "url": "http://localhost:3002",
    "health": "/api/health"
  }'
```

或在代码中使用 SDK：

```typescript
import { registerTool } from '@my-toolbox/shared'

registerTool({
  manifest: {
    name: 'my-tool',
    displayName: 'My Tool',
    description: '工具描述',
    version: '0.1.0',
    url: 'http://localhost:3002',
    health: '/api/health',
  },
  portalUrl: 'http://localhost:3000',
})
```

## 端口约定

| 端口 | 服务 |
|------|------|
| 3000 | Portal 门户 |
| 3001 | CC Monitor |
| 3002+ | 其他工具自选 |
