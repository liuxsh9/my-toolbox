## Context

全新 greenfield 项目 `my-toolbox`。目标是构建一个本地工具门户平台,管理通过 PM2 运行的多个小工具。门户本身也是 PM2 管理的一个服务。

当前没有任何代码,需要从零建立 monorepo 结构、门户服务和第一个工具 (Claude Code Monitor)。

技术约束:
- 纯本地运行 (localhost),不考虑多机部署
- 用户通过浏览器访问各工具的 Web UI
- 工具可以在 monorepo 内部,也可以是外部独立项目

## Goals / Non-Goals

**Goals:**

- 建立可扩展的 monorepo 结构,方便后续快速添加新工具
- 门户提供工具注册、发现、状态监控的核心能力
- 门户 Dashboard 展示所有工具状态,点击跳转到工具自身 UI
- CC Monitor 能实时展示本地所有 Claude Code 实例的运行状态
- 定义清晰的 Tool Manifest 规范,内部和外部工具统一注册方式

**Non-Goals:**

- 不做反向代理或 iframe 嵌入 — 门户只做链接跳转
- 不做端口自动分配 — 工具自选端口,门户记录
- 不做用户认证 — 纯本地工具,无需权限控制
- 不做多机/远程部署 — 仅支持 localhost
- 不做工具间通信/编排 — 各工具独立运行

## Decisions

### 1. Monorepo 结构: pnpm workspaces

**选择**: pnpm workspaces, 不使用 turborepo/nx 等构建编排工具

**原因**: 项目初期工具数量少,pnpm workspaces 提供包管理和依赖链接,够用。构建编排可在工具数量增长后按需引入。

**替代方案**: Turborepo (过重), npm workspaces (不如 pnpm 严格), 独立仓库 (失去共享代码能力)

### 2. 后端框架: Fastify

**选择**: Fastify

**原因**: 原生 TypeScript 支持好,插件架构天然适合模块化工具,JSON Schema 验证内建,性能优于 Express,社区成熟。

**替代方案**: Express (更老旧, 缺乏原生 TS), Hono (较新, 生态较小), Koa (社区缩小)

### 3. 前端框架: React + Vite

**选择**: React 18 + Vite

**原因**: 生态最大,组件库丰富。Vite 构建快,开发体验好。构建产物是纯静态文件,由 Fastify 通过 `@fastify/static` serve。

**替代方案**: Vue (生态稍小), Svelte (生态更小), Next.js (不需要 SSR, 过重)

### 4. 数据库: SQLite (via better-sqlite3)

**选择**: SQLite, 通过 better-sqlite3 同步 API 访问

**原因**: 零配置, 无需额外进程, 一个文件搞定。门户的数据量极小 (工具注册表 + 事件日志), SQLite 绰绰有余。

**替代方案**: PostgreSQL (需要跑数据库服务, 过重), JSON 文件 (无查询能力, 并发问题)

### 5. 前后端合并部署

**选择**: 每个工具 = 一个 Fastify 进程, 同时 serve API 和静态前端

**原因**: 一个工具只占一个端口一个 PM2 进程。10 个工具 = 10 个进程, 而不是 20 个。开发时 Vite dev server proxy 到 Fastify。

### 6. Claude Code 状态获取: Hooks + 进程检测

**选择**: 全局 Claude Code Hooks 向 Monitor 上报事件, 辅以 `ps aux` 进程存活检测

**原因**: Hooks 是 Claude Code 官方支持的事件机制, 可获取 session_id, cwd, 事件类型等信息。配合进程检测可以处理 Hook 未覆盖的边界情况 (如进程崩溃)。

**Hook 事件利用**:
- `SessionStart` / `SessionEnd`: 会话生命周期
- `PostToolUse`: 活跃度 (最后工具调用时间)
- `Stop`: Claude 完成回复
- `Notification(idle_prompt)`: 等待用户输入
- `UserPromptSubmit`: 用户正在交互

### 7. 工具注册协议: HTTP REST + 心跳

**选择**: 工具启动时 POST 注册, 定期 PUT 心跳, 门户定时清理过期注册

**原因**: 最简单的方式。不需要服务发现框架, 不需要消息队列。HTTP 调用即可。

## Risks / Trade-offs

- **[Claude Code Hooks 侵入性]** 需要修改用户全局 `~/.claude/settings.json` → 提供安装/卸载脚本,明确告知用户影响
- **[Hook 事件不保证送达]** Hook 是 fire-and-forget, Monitor 可能丢失事件 → 定期 ps 扫描作为兜底, 容忍短暂状态不一致
- **[SQLite 并发写入]** 多个 Hook 同时写入 Monitor API → SQLite WAL 模式 + better-sqlite3 同步 API, 足够应对本地工具量级
- **[端口冲突]** 工具自选端口可能冲突 → 门户注册时检查端口占用, 返回警告
