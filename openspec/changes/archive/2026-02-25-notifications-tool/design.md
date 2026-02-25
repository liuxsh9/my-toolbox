## Context

my-toolbox 是一个本地工具门户 monorepo。现有工具（cc-monitor、bookmarks、win-switcher）各自独立运行，没有统一的通知机制。用户需要手动切换到各工具查看状态，无法被动感知重要事件（如 Claude 完成任务、需要决策）。

现有基础设施：
- 各工具通过 `tool.yaml` 自动注册到门户
- 门户有 widget 嵌入机制（iframe）
- inter-widget-messaging 规范定义了 postMessage 通信
- cc-monitor 的 `collector.ts` 已有完整的事件状态机（Stop、Notification 等事件）

## Goals / Non-Goals

**Goals:**
- 新建 `packages/notifications` 独立工具（port 3004），提供通知推送 API 和 SSE 实时流
- cc-monitor 在 `Stop` 和 `Notification` 事件时向通知服务推送
- Widget UI：紧凑通知列表，点击消除，显示未读角标

**Non-Goals:**
- 读取 macOS 系统通知（无公开 API，需 Full Disk Access，不稳定）
- 持久化历史（内存存储，重启清空）
- 通知分组、优先级、静音等高级功能

## Decisions

### 独立 package vs 门户内置

选择独立 package（`packages/notifications`）。

理由：符合 monorepo 工具哲学，每个工具独立可运行；门户内置会让门户职责膨胀；未来其他外部工具也能直接 POST 到 :3004。

### 内存存储 vs SQLite

选择内存存储（`Map<string, Notification>`）。

理由：用户明确不需要历史记录；内存存储零依赖、零配置；通知的生命周期就是"看到即消除"，持久化无意义。

### 实时推送：SSE vs 轮询 vs WebSocket

选择 SSE（Server-Sent Events）。

理由：通知是单向推送（服务端→客户端），SSE 天然适合；比 WebSocket 简单，无需握手协议；Fastify 原生支持；轮询有延迟且浪费资源。

### cc-monitor 推送时机

- `Stop` 事件 → "Claude 完成了工作"（最高频、最有价值）
- `Notification` 事件 → "Claude 需要你的决策"（permission request 场景）

不推送 `SessionStart`、`PreToolUse`、`PostToolUse`（太频繁，噪音大）。

### 通知消除语义

点击即删除（从内存移除），不区分"已读"和"删除"。理由：用户明确不需要历史，简化状态模型。

## Risks / Trade-offs

- [cc-monitor 推送失败] → 静默忽略，不影响 cc-monitor 主功能；通知服务不可用时降级为无通知
- [内存存储重启丢失] → 已知且接受，通知的时效性决定了这不是问题
- [SSE 连接数] → 本地工具，连接数极少（1-2个 widget），无压力
- [端口冲突] → 遵循约定使用 3004，ecosystem.config.js 统一管理

## Migration Plan

1. 新建 `packages/notifications/`，加入 pnpm workspaces
2. 加入 `ecosystem.config.js`
3. cc-monitor 新增推送逻辑（可选依赖，推送失败不报错）
4. `pnpm install && pnpm build` 后 `pm2 restart all`
