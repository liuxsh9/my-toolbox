## 1. 项目基础设施

- [x] 1.1 初始化 pnpm workspace: 创建 `pnpm-workspace.yaml`, 根 `package.json`, `tsconfig.base.json`
- [x] 1.2 创建 `packages/shared` 包: package.json, tsconfig.json, 入口文件
- [x] 1.3 在 shared 中定义 ToolManifest 类型和 API 类型 (`types.ts`)
- [x] 1.4 在 shared 中实现 registerTool SDK (`register.ts`): POST 注册 + 定时心跳 + 门户不可达时静默重试
- [x] 1.5 创建 PM2 ecosystem.config.js 配置文件

## 2. Portal 后端

- [x] 2.1 创建 `packages/portal` 包: package.json, tsconfig.json, Fastify 入口
- [x] 2.2 初始化 SQLite 数据库: 工具注册表 schema (name, displayName, description, version, url, health, pm2Name, status, source, lastHeartbeat, createdAt)
- [x] 2.3 实现 POST `/api/tools/register`: 注册工具, 重复注册时更新
- [x] 2.4 实现 PUT `/api/tools/:name/heartbeat`: 更新心跳时间
- [x] 2.5 实现 GET `/api/tools`: 返回所有工具列表 (含状态)
- [x] 2.6 实现 GET `/api/tools/:name`: 返回单个工具详情 (含 PM2 状态)
- [x] 2.7 实现 DELETE `/api/tools/:name`: 注销工具
- [x] 2.8 实现 GET `/api/health`: 门户健康检查端点
- [x] 2.9 实现 monorepo 内部工具发现: 启动时扫描 `packages/*/tool.yaml` 并自动注册
- [x] 2.10 实现 PM2 状态查询服务: 通过 pm2 programmatic API 查询进程状态
- [x] 2.11 实现心跳超时检测: 定时任务, 超过 90 秒未心跳的工具标记为 `unreachable`
- [x] 2.12 实现健康检查轮询: 定时任务 (每 60 秒), GET 各工具 health 端点更新状态
- [x] 2.13 配置 `@fastify/static` serve 前端构建产物, `@fastify/cors` 支持开发时跨域

## 3. Portal 前端

- [x] 3.1 初始化 React + Vite 项目 (在 `packages/portal/src/web/`)
- [x] 3.2 配置 Vite dev proxy: `/api/*` 代理到 Fastify 后端
- [x] 3.3 实现 Dashboard 页面: 工具卡片列表, 每张卡片含名称、描述、地址、状态指示器 (绿/红/黄)
- [x] 3.4 实现跳转逻辑: 点击卡片"打开"按钮, 在新标签页中打开工具 URL
- [x] 3.5 实现空状态: 无工具注册时展示引导信息
- [x] 3.6 实现 10 秒轮询自动刷新工具状态
- [x] 3.7 构建产物输出到 `dist/web/`, Fastify 生产模式 serve 该目录

## 4. CC Monitor 后端

- [x] 4.1 创建 `packages/cc-monitor` 包: package.json, tsconfig.json, tool.yaml, Fastify 入口
- [x] 4.2 实现 POST `/api/events`: 接收 Claude Code Hook 事件, 按 hook_event_name 分发处理
- [x] 4.3 实现会话状态管理: 内存中维护 session 状态表, 根据事件更新状态 (started → working → idle → waiting_for_input → ended 等)
- [x] 4.4 实现进程检测服务: 定时 (每 30 秒) 执行 `ps` 扫描 claude 进程, 提取 PID/TTY/参数/运行时长
- [x] 4.5 实现进程-会话关联: 进程存在但无 Hook 事件时创建 `detected` 状态记录; 进程消失时标记 `terminated`
- [x] 4.6 实现 GET `/api/sessions`: 返回所有活跃会话列表
- [x] 4.7 实现 GET `/api/sessions/:sessionId`: 返回单个会话详情含事件历史
- [x] 4.8 实现 GET `/api/health`: Monitor 健康检查端点
- [x] 4.9 启动时通过 shared SDK 向门户注册自身

## 5. CC Monitor 前端

- [x] 5.1 初始化 React + Vite 项目 (在 `packages/cc-monitor/src/web/`)
- [x] 5.2 实现监控面板: 会话卡片列表, 每张卡片含项目名称、状态标签 (颜色编码)、运行时长、最后活跃时间
- [x] 5.3 实现状态颜色编码: 绿色(working/processing), 蓝色(started/idle), 黄色(waiting_for_input), 灰色(ended/terminated/detected)
- [x] 5.4 实现 5 秒轮询自动刷新会话状态
- [x] 5.5 构建产物输出到 `dist/web/`, Fastify 生产模式 serve 该目录

## 6. Claude Code Hooks 配置

- [x] 6.1 创建 hooks 安装脚本: 读取 `~/.claude/settings.json`, 向 hooks 字段追加 Monitor 事件上报配置 (SessionStart, PostToolUse, Stop, Notification, UserPromptSubmit, SessionEnd)
- [x] 6.2 创建 hooks 卸载脚本: 从 settings.json 移除 Monitor 相关 hooks, 保留用户其他配置
- [x] 6.3 Hook 命令实现: 每个 hook 通过 curl POST 事件 JSON 到 `http://localhost:3001/api/events`

## 7. 集成与验收

- [x] 7.1 PM2 启动测试: `pm2 start ecosystem.config.js` 启动门户和 Monitor, 验证两者正常运行
- [x] 7.2 注册流程测试: Monitor 启动后自动注册到门户, 门户 Dashboard 展示 Monitor 卡片
- [x] 7.3 Hooks 集成测试: 安装 hooks 后, 新开 Claude Code 实例, 验证 Monitor 能收到事件并展示会话状态
- [x] 7.4 跳转测试: 门户 Dashboard 点击 Monitor 卡片能正确跳转到 Monitor UI
