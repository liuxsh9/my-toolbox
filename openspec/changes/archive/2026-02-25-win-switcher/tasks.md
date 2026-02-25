## 1. 包初始化

- [x] 1.1 创建 `packages/win-switcher/package.json`（name: `@my-toolbox/win-switcher`，port 3003，依赖 shared、fastify、@fastify/static、@fastify/cors）
- [x] 1.2 创建 `tsconfig.server.json` 继承 `../../tsconfig.base.json`
- [x] 1.3 创建 `tool.yaml`（name: win-switcher, url: http://localhost:3003, category: productivity）
- [x] 1.4 在根 `ecosystem.config.js` 添加 win-switcher PM2 entry（port 3003, PORTAL_URL env）
- [x] 1.5 创建目录结构：`src/server/routes/`、`src/server/services/`、`src/native/`、`src/web/`

## 2. Swift 原生脚本

- [x] 2.1 创建 `src/native/windows.swift`：`list` 子命令——使用 `CGWindowListCopyWindowInfo` 枚举 `kCGWindowLayer == 0` 的窗口，输出 JSON 数组（id、title、app、pid、x、y、width、height）
- [x] 2.2 实现 `src/native/windows.swift` `focus <pid> <title>` 子命令——`AXIsProcessTrusted()` 检测权限，有权限则用 AX API 精确聚焦，无权限则只 `NSRunningApplication.activate()`
- [x] 2.3 实现 `src/native/windows.swift` `check-permissions` 子命令——检测 Screen Recording（尝试截图）和 Accessibility（`AXIsProcessTrusted()`）状态，输出 JSON
- [x] 2.4 本地测试 swift 脚本：`swift src/native/windows.swift list` 能正确输出 JSON

## 3. 后端：基础设施

- [x] 3.1 创建 `src/server/db.ts` → 改名为 `src/server/cache.ts`：内存缓存模块，存储窗口列表（TTL 5s）
- [x] 3.2 创建 `src/server/services/native.ts`：封装 `execFile` 调用 swift 脚本和 screencapture，包含并发限制（max 4 个 screencapture 进程）
- [x] 3.3 创建 `src/server/routes/health.ts`：`GET /api/health` 返回 `{ ok: true }`
- [x] 3.4 创建 `src/server/index.ts`：Fastify 主入口，注册 cors、static（dist/web + /tmp/winswitcher），启动后调用 `registerTool()`

## 4. 后端：窗口列表路由

- [x] 4.1 创建 `src/server/routes/windows.ts`：`GET /api/windows` 返回 `{ windows: [...], permissions: { screenRecording, accessibility } }`（带 5s 内存缓存）
- [x] 4.2 实现权限检测：调用 `windows.swift check-permissions`，结果缓存 30s（权限不会频繁变化）

## 5. 后端：缩略图路由

- [x] 5.1 在 `src/server/routes/windows.ts` 实现 `GET /api/windows/:wid/thumb`：检查 `/tmp/winswitcher/thumb-<wid>.png` 是否存在且 mtime < 15s，否则调用 `screencapture -l <wid> -x -t png <path>`，然后 `sendFile`
- [x] 5.2 确保 `/tmp/winswitcher/` 目录在服务启动时自动创建
- [x] 5.3 配置 Fastify static 让缩略图路径 `/api/windows/:wid/thumb` 通过路由处理（非 static 托管）

## 6. 后端：聚焦路由

- [x] 6.1 在 `src/server/routes/windows.ts` 实现 `POST /api/windows/:wid/focus`：接收 `{ pid, title }`，调用 `windows.swift focus <pid> <title>`，返回 `{ ok, degraded?, reason? }`

## 7. 前端：项目结构

- [x] 7.1 创建 `src/web/vite.config.ts`（port 5176，代理 `/api/*` 到 http://localhost:3003）
- [x] 7.2 创建 `src/web/index.html`、`src/web/main.tsx`、`src/web/index.css`（复用 bookmarks 的 CSS 变量风格）

## 8. 前端：API 层

- [x] 8.1 创建 `src/web/api.ts`：`fetchWindows()`、`focusWindow(wid, pid, title)`、`thumbUrl(wid, t)`

## 9. 前端：界面实现

- [x] 9.1 创建 `src/web/App.tsx`：布局骨架，顶部标题栏（含刷新按钮 + 权限状态提示）+ 按 app 分组的窗口网格
- [x] 9.2 实现权限提示横幅：缺少 Screen Recording 或 Accessibility 时显示，含 System Settings 跳转链接
- [x] 9.3 实现 `WindowCard` 组件：显示缩略图（`<img src={thumbUrl(wid, t)}>`）、窗口标题、app 名；点击触发 `focusWindow`
- [x] 9.4 实现按 app 分组视图：app 名作为小标题，同 app 的窗口横排，遵循设计红线（强字重对比、非通用色、细边框）
- [x] 9.5 实现刷新逻辑：窗口列表每 5s 自动轮询；缩略图 `t` 时间戳每 30s 或手动点击刷新按钮时更新
- [x] 9.6 实现空状态（无窗口或权限全缺失时的引导页）

## 10. 集成验证

- [x] 10.1 `pnpm --filter @my-toolbox/win-switcher build` 验证 TypeScript 编译通过
- [x] 10.2 启动服务，验证 `GET /api/windows` 返回正确的窗口列表 JSON
- [x] 10.3 验证 `GET /api/windows/:wid/thumb` 返回 PNG 图片
- [x] 10.4 验证点击窗口卡片后目标窗口成功跳转到前台
- [x] 10.5 在 portal 验证 win-switcher 卡片显示为 Running
