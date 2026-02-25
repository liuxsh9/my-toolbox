## Why

开发过程中经常需要快速记录临时文字——命令片段、会议要点、待办事项——但切换到独立应用打断心流。需要一个常驻桌面 widget、随时可写的轻量记事本。

## What Changes

- 新增 `packages/notes` 工具包（端口 3004），提供 Fastify 后端 + React 前端
- SQLite 持久化存储笔记，纯文本内容，保证代码/特殊字符粘贴无损
- 两视图 UI：列表视图（浏览/新建）↔ 编辑视图（写作/删除），500ms 自动保存
- 注册到 portal，支持 `?mode=widget` 嵌入桌面
- `tool.yaml` 声明宽松的 widget 尺寸约束（minW:2 minH:3），允许用户自由调整大小
- 更新 `ecosystem.config.js` 和 `Desktop.tsx` 默认布局加入 notes

## Capabilities

### New Capabilities

- `note-management`: 笔记的增删改查，SQLite 持久化，纯文本内容，自动保存

### Modified Capabilities

- `portal-desktop`: 默认布局加入 notes widget，调整各 widget 的 minW/minH 为更宽松的约束

## Impact

- 新包：`packages/notes/`，依赖 `@my-toolbox/shared`
- 新端口：3004
- `ecosystem.config.js`：新增 notes PM2 entry
- `packages/portal/src/web/components/Desktop.tsx`：默认布局加入 notes
- `packages/portal/src/web/components/Desktop.tsx`：各 widget minW/minH 约束放宽
