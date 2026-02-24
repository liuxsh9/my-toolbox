## Why

需要一个统一的门户来管理和展示本机上构建的众多小工具。随着工具数量增长,缺乏统一的注册、发现、监控机制会导致端口冲突、进程失控、工具难以找到。门户解决"工具治理"问题,同时作为第一个具体工具,构建 Claude Code Monitor 来监控本地所有 Claude Code 实例的运行状态。

## What Changes

- 建立 pnpm monorepo 项目结构,含 `packages/shared`、`packages/portal`、`packages/cc-monitor`
- 实现门户后端 (Fastify):工具注册 API、PM2 状态查询、心跳检测、健康检查
- 实现门户前端 (React + Vite):工具卡片列表 Dashboard,点击链接跳转到各工具
- 定义 Tool Manifest 规范 (`tool.yaml`),统一内部和外部工具的自描述格式
- 实现 shared 包:manifest 类型定义、工具注册 SDK (供外部工具调用)
- 实现 CC Monitor 后端:接收 Claude Code Hook 事件、进程检测、会话状态推断
- 实现 CC Monitor 前端:实时监控面板,展示所有 Claude Code 实例的状态
- 配置全局 Claude Code Hooks (`~/.claude/settings.json`),使所有实例自动向 Monitor 上报事件
- PM2 ecosystem 配置,统一管理门户和工具进程

## Capabilities

### New Capabilities

- `tool-registry`: 工具注册、发现、心跳检测、PM2 集成的门户核心服务
- `portal-dashboard`: 门户 Web Dashboard,展示所有注册工具的状态卡片和跳转链接
- `tool-manifest`: Tool Manifest 规范定义和注册 SDK
- `cc-monitor`: Claude Code 实例监控,通过 Hooks 事件收集和进程检测推断会话状态

### Modified Capabilities

(无,全新项目)

## Impact

- 新建整个项目结构 (monorepo, 多个 packages)
- 依赖: Node.js, pnpm, PM2, Fastify, React, Vite, better-sqlite3
- 需要修改用户全局 `~/.claude/settings.json` 添加 hooks 配置
- 占用端口: 门户 3000, CC Monitor 3001
