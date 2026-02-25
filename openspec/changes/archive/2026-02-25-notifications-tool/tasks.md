## 1. Package Scaffold

- [x] 1.1 创建 `packages/notifications/` 目录结构（`src/server/`, `src/web/`, `data/`）
- [x] 1.2 创建 `packages/notifications/package.json`（name: `@my-toolbox/notifications`, port 3004）
- [x] 1.3 创建 `packages/notifications/tsconfig.server.json` 继承 `../../tsconfig.base.json`
- [x] 1.4 创建 `packages/notifications/tool.yaml`（name, url, displayName, description, health, widget config）
- [x] 1.5 在 `pnpm-workspace.yaml` 或根 `package.json` 确认 workspaces 包含新包（通常 `packages/*` 已覆盖）
- [x] 1.6 在 `ecosystem.config.js` 添加 notifications PM2 entry（port 3004）

## 2. 通知中心后端

- [x] 2.1 创建 `src/server/index.ts`：Fastify 服务入口，监听 port 3004，静态服务 `dist/web/`
- [x] 2.2 创建 `src/server/store.ts`：内存通知存储（`Map<string, Notification>`），含 add/remove/clear/getAll 方法
- [x] 2.3 创建 `src/server/sse.ts`：SSE 订阅管理器，含 subscribe/unsubscribe/broadcast 方法
- [x] 2.4 创建 `src/server/routes.ts`：注册所有路由
  - `POST /api/notifications`（推送，广播 SSE `notification` 事件）
  - `GET /api/notifications`（列表）
  - `DELETE /api/notifications/:id`（消除单条，广播 SSE `dismissed` 事件）
  - `DELETE /api/notifications`（清空，广播 SSE `cleared` 事件）
  - `GET /api/notifications/stream`（SSE 长连接）
  - `GET /api/health`

## 3. 通知中心前端

- [x] 3.1 创建 `src/web/vite.config.ts`（proxy `/api/*` → `http://localhost:3004`，port 5177）
- [x] 3.2 创建 `src/web/main.tsx` 和 `src/web/index.html` 入口
- [x] 3.3 创建 `src/web/App.tsx`：通知列表主组件
  - 启动时 `GET /api/notifications` 加载初始数据
  - 连接 SSE `/api/notifications/stream` 监听实时事件
  - 点击通知调用 `DELETE /api/notifications/:id`
  - "清空"按钮调用 `DELETE /api/notifications`
  - 空状态友好提示
  - 遵循 UI 红线：inline styles + CSS custom properties，无 Tailwind

## 4. CC Monitor 推送集成

- [x] 4.1 在 `packages/cc-monitor/src/server/services/collector.ts` 的 `handleEvent` 中，`Stop` 事件后 fire-and-forget 推送通知到 `http://localhost:3004/api/notifications`
- [x] 4.2 同上，`Notification` 事件后推送"Claude 需要你的决策"通知
- [x] 4.3 推送逻辑封装为独立函数 `pushNotification(title, body, source)`，错误静默忽略

## 5. 构建与集成验证

- [x] 5.1 运行 `pnpm install` 确认新包依赖安装正常
- [x] 5.2 运行 `pnpm --filter @my-toolbox/notifications build` 确认编译无误
- [x] 5.3 运行 `pnpm --filter @my-toolbox/cc-monitor build` 确认 cc-monitor 编译无误
- [x] 5.4 启动服务后验证门户自动发现 notifications 工具（`GET http://localhost:3000/api/tools`）
- [x] 5.5 手动 `POST http://localhost:3004/api/notifications` 验证推送和 SSE 广播正常
