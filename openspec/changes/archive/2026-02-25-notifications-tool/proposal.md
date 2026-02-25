## Why

工具门户缺乏统一的通知机制——当 Claude Code 完成任务或需要用户决策时，用户无法感知，只能手动切换窗口查看。需要一个轻量的通知中心，让各工具能主动推送通知，用户在门户 widget 中即可感知并处理。

## What Changes

- 新增 `packages/notifications` 工具包（port 3004），提供通知推送、消费和实时流式接口
- cc-monitor 在 `Stop`（Claude 完成工作）和 `Notification`（Claude 需要决策）事件时向通知服务推送通知
- 通知以内存存储，点击即消失，不保留历史

## Capabilities

### New Capabilities

- `notification-center`: 通知中心服务——接收推送、SSE 实时分发、点击消除，作为独立 widget 运行于 port 3004
- `cc-monitor-notifications`: cc-monitor 在关键 Claude Code 事件时向通知中心推送通知

### Modified Capabilities

<!-- 无现有 spec 需要修改 -->

## Impact

- 新增 `packages/notifications/`，需加入 `ecosystem.config.js` 和 pnpm workspaces
- `packages/cc-monitor/src/server/services/collector.ts` 新增推送逻辑
- `packages/shared/src/types.ts` 可能新增 `Notification` 类型（供多工具复用）
- 门户 `tool.yaml` 发现机制自动注册新工具，无需修改门户代码
