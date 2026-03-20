# Claude Code Monitor Static Asset Refresh 设计文档

## 背景

`cc-monitor` 生产模式使用 `@fastify/static` 提供 React build 产物，并开启了 `wildcard: false`。该模式会在服务启动时按当时磁盘上的文件列表注册静态路由。

当 `packages/cc-monitor/src/web` 重新 build 后，`dist/web/index.html` 会引用新的 hash 资源文件，但老的 Node/PM2 进程并不会自动获得这些新路由。结果是：

- `/` 返回新的 `index.html`
- `index.html` 再请求新的 `/assets/index-*.js`
- 服务未注册该新文件路由，请求落入 SPA fallback
- fallback 返回 `index.html`（`text/html`）而不是 JS
- 浏览器报 `Expected a JavaScript module script`，widget 白屏

## 目标

1. `cc-monitor` 在不重启进程的前提下，也能正确提供新 build 出来的静态资源。
2. SPA 路由 fallback 继续工作。
3. 增加一个回归测试，能稳定复现“启动后新增 hash 资源文件”的场景。

## 方案对比

### 方案 A：改为 `wildcard: true`（推荐）

让静态资源请求在运行时按路径解析文件，而不是仅依赖启动时注册好的固定文件路由。

- 优点：改动最小，直接解决 hash 资源变更问题。
- 优点：不需要改部署流程，也不依赖 PM2 重启。
- 缺点：路径匹配范围更宽，但在本项目中可接受。

### 方案 B：保持 `wildcard: false`，要求每次 build 后重启 PM2

- 优点：保留当前静态路由模式。
- 缺点：对人和流程都有依赖，容易再次出现同类故障。

### 方案 C：自定义 `/assets/*` 文件读取逻辑

- 优点：控制力最强。
- 缺点：实现更重，不符合本次问题规模。

## 决策

采用 **方案 A**：把 `cc-monitor` 的静态资源注册改为 `wildcard: true`。

## 测试设计

由于仓库没有统一测试框架，本次使用 Node 内建 `node:test`：

1. 在临时目录创建一个最小 `webDir`，写入初始 `index.html` 和旧 asset。
2. 启动测试版 Fastify app。
3. 服务启动后，再把 `index.html` 更新为引用新 hash，并在磁盘上新增新 asset 文件。
4. 断言：
   - `/assets/new.js` 返回 `application/javascript`
   - `/` 仍返回 `text/html`

这个测试在旧实现下会失败，在新实现下会通过。
