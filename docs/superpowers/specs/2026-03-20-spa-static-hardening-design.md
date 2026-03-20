# SPA Static Serving Hardening 设计文档

## 背景

本仓库多个工具包都采用相同的 Fastify + `@fastify/static` 模式来托管生产前端：
- `fastifyStatic({ root: webDir, prefix: '/', wildcard: false })`
- `app.setNotFoundHandler(() => reply.sendFile('index.html', webDir))`

这套写法在运行中存在两类风险：
1. **构建后的 hash 资源文件名变化，但服务未重启** 时，新 `/assets/*.js` 路由可能无法命中；
2. 某些包还关闭了 `decorateReply`，导致 fallback 路径里的 `reply.sendFile(...)` 可能不可用。

`work-hours` 已经实际触发了该问题，表现为首页/Widget 一片空白。

## 目标

对仓库内所有使用该模式的工具统一做一轮修复，使其：
- 能稳定返回最新构建产生的 hash 静态资源；
- 能正确返回 SPA 文档路由（如 `/`、`/foo/bar`）；
- 不把 `/api/*` 或带扩展名的资源路径错误回退到 `index.html`；
- 保持各工具现有 API 与前端功能不变。

## 影响范围

经审计，以下包存在同类模式，需要纳入统一修复：
- `portal`
- `cc-monitor`
- `notes`
- `notifications`
- `todo`
- `win-switcher`
- `api-quota`
- `litellm-monitor`
- `bookmarks`
- `work-hours`

其中 `bookmarks` 还同时注册了 `/screenshots/*` 静态目录，需确保该路径不受 SPA fallback 干扰。

## 方案对比

### 方案 A：逐包局部修补

每个包自己改 static 注册和 fallback。

- 优点：改动直观。
- 缺点：重复代码多，后续容易再次漂移。

### 方案 B：抽共享 helper（推荐）

在 `@my-toolbox/shared` 中新增一个统一的 `registerSpaStatic()`：
- 统一注册 `@fastify/static`
- 用显式路由而不是 `setNotFoundHandler` 处理 SPA fallback
- 在 helper 内统一处理 `/api/*`、带扩展名路径、普通文档路由

各包只保留自己的业务路由，然后调用该 helper。

- 优点：
  - 单点修复，避免重复；
  - 测试可以集中在 helper；
  - 以后新增工具也能直接复用。
- 缺点：
  - 需要给 `shared` 增加少量服务端依赖与测试。

### 方案 C：单独做一个 server-utils 包

新建专门的 server-utils workspace 包。

- 优点：边界最清晰。
- 缺点：对当前仓库来说偏重，超出需求。

## 决策

采用 **方案 B：抽共享 helper**。

## 详细设计

### 1. 共享 helper

新增文件：
- `packages/shared/src/spa-static.ts`

导出：
- `registerSpaStatic(app, webDir)`

行为：
1. 注册 `@fastify/static` 托管 `webDir`；
2. 使用显式 `GET /` 路由返回 `index.html`；
3. 使用显式 `GET /*` 路由作为 SPA fallback：
   - 若路径以 `/api/` 开头 → 返回 404；
   - 若路径带扩展名（如 `.js`, `.css`, `.png`, `.ico`）→ 返回 404；
   - 否则返回 `index.html`。

这样可以避免：
- 旧的 `wildcard: false` 导致新 hash 资源不命中；
- `setNotFoundHandler` 内部再次发送 404/文件时的行为不稳定；
- `decorateReply: false` 与 `reply.sendFile()` 的耦合问题。

### 2. 各工具迁移

将上述 10 个包的服务端入口统一迁移为：
- 删掉本地 `fastifyStatic` 的 SPA 前端注册块；
- 改为 `import { registerSpaStatic } from '@my-toolbox/shared'`；
- 调用 `await registerSpaStatic(app, webDir)`。

特殊情况：
- `bookmarks` 的 `/screenshots/` 静态服务保留原逻辑，只替换 SPA 前端部分。

### 3. 测试策略

在 `packages/shared` 中新增 Node 环境测试，覆盖 helper 的核心行为：
1. `GET /` 返回 `index.html`；
2. `GET /dashboard` 返回 `index.html`；
3. `GET /api/missing` 返回 404；
4. `GET /assets/new-hash.js` 在文件替换后仍可访问；
5. `GET /favicon.ico` 等扩展名路径返回 404（避免错误回退）。

这样可以用一组共享测试覆盖所有接入工具的核心静态托管行为。

### 4. 验证

完成后至少验证：
- `pnpm --filter @my-toolbox/shared test`
- `pnpm build`
- 对各在线工具做首页 + 当前 hash 资源 HTTP 检查
- 必要时重启 PM2 进程并抽查页面渲染

## 风险与控制

### 风险 1：共享 helper 引入后影响所有包

控制：
- 先在 helper 上做集中测试；
- 各包只做薄迁移，不混入业务逻辑变更；
- 用全仓构建与运行态探测收尾。

### 风险 2：catch-all 路由误吞 API 或静态资源

控制：
- helper 内显式排除 `/api/*` 与带扩展名路径；
- 用测试锁住这些边界。

### 风险 3：`bookmarks` 的截图静态目录受影响

控制：
- `/screenshots/*` 保持现有独立注册；
- helper 只处理 SPA webDir 与文档路由。
