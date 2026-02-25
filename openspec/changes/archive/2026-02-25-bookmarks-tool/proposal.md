## Why

开发者在日常工作中积累了大量常用网址，分散在浏览器书签、便签、聊天记录中，缺乏一个统一的可视化聚合入口。作为 my-toolbox 的组成工具，bookmarks 填补了「快速访问常用网页」这一高频需求。

## What Changes

- 新增 `packages/bookmarks` 工具包（Fastify :3002 + React SPA）
- 新增书签 CRUD：添加、编辑、删除书签
- 每个书签包含标题、URL、分组、缩略图（截图）
- 截图策略：优先抓取目标页面的 og:image，失败时允许用户手动上传（支持粘贴板粘贴）
- 截图文件存储在 `packages/bookmarks/data/screenshots/`，由 Fastify 静态托管
- 数据存储：SQLite（`packages/bookmarks/data/bookmarks.db`）
- 自动注册到 portal（via `tool.yaml`），在门户首页显示为工具卡片
- 新增 `ecosystem.config.js` PM2 entry（port 3002）

## Capabilities

### New Capabilities

- `bookmark-management`: 书签的增删改查，包含标题、URL、分组、排序字段；SQLite 存储
- `screenshot-capture`: 对给定 URL 抓取 og:image 作为缩略图；失败时返回空，由前端引导用户上传
- `screenshot-upload`: 用户手动上传或粘贴板粘贴图片作为书签缩略图，保存为文件并返回可访问 URL

### Modified Capabilities

<!-- 无现有能力的需求变更 -->

## Impact

- 新增 `packages/bookmarks/` 目录（含 server、web、tool.yaml、package.json）
- `ecosystem.config.js`：新增 bookmarks 应用条目
- `packages/portal/src/server/services/discovery.ts`：无需修改，自动发现 tool.yaml
- 新依赖：`js-yaml`（已在 portal 中使用）、`better-sqlite3`（已在 portal 中使用）
- 端口 3002 分配给 bookmarks
