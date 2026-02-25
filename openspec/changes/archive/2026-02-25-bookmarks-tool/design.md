## Context

my-toolbox 是一个 pnpm monorepo，现有 portal（3000）和 cc-monitor（3001）两个工具包。每个工具包采用相同的结构：Fastify 后端 + React/Vite 前端 + SQLite 数据库 + `tool.yaml` 自动注册。bookmarks 工具遵循同样的模式新增于 port 3002。

截图是本工具最具差异性的功能点：需要在「自动化抓取」与「零重型依赖」之间做权衡。

## Goals / Non-Goals

**Goals:**
- 实现书签 CRUD（标题、URL、分组、缩略图）
- 截图策略：先尝试抓取页面 og:image，失败时用户可手动上传（支持粘贴板）
- 截图以文件形式存储，Fastify 静态托管，SQLite 存文件路径
- 完全符合现有 monorepo 模式（tool.yaml、registerTool、ecosystem.config.js）
- UI 遵循 CLAUDE.md 设计红线：无通用蓝、非对称布局、强字重对比、细边框区分区域

**Non-Goals:**
- 不引入 Puppeteer / Playwright（避免 ~200MB Chromium 依赖）
- 不支持多用户或权限控制
- 不做浏览器扩展集成
- 不做书签导入/导出（可后续迭代）

## Decisions

### 1. 截图方案：og:image 优先 + 手动上传兜底

**决策**：后端提供 `POST /api/bookmarks/:id/fetch-screenshot` 端点，服务端 fetch 目标 URL 并解析 `<meta property="og:image">` 或 `<link rel="icon">`，返回图片 URL 或将图片下载到本地文件。前端在创建/编辑书签后调用此端点；若失败或用户不满意，前端提供上传区域（支持点击 + 拖拽 + 粘贴板 `paste` 事件）。

**为什么不用 Puppeteer**：Chromium 二进制体积约 200MB，本地工具启动慢，且 og:image 能覆盖绝大多数主流网站（GitHub、Notion、Figma、YouTube 等均有高质量 og:image）。

**备选**：外部截图 API（screenshotone 等）→ 拒绝，需外网，有隐私风险。

### 2. 截图存储：文件系统 + 静态托管

**决策**：截图保存为 `packages/bookmarks/data/screenshots/{uuid}.{ext}`，Fastify 通过 `@fastify/static` 托管 `/screenshots/*`。SQLite 中仅存相对路径字符串（如 `/screenshots/abc123.png`）。

**为什么不存 base64 in SQLite**：SQLite 不适合存大型 blob，文件系统迁移/清理更方便，路径引用更轻量。

### 3. 分组设计：单层 category 字符串

**决策**：书签有一个可选的 `category` 字段（自由文本字符串），前端动态归集所有出现的分类值作为筛选 tab。不做独立的分类表，避免过度设计。

**备选**：多对多 tags 表 → 当前需求不需要，过度复杂。

### 4. 排序：手动拖拽 + 数字序号

**决策**：表中加 `sortOrder INTEGER` 字段，默认按插入时间递增。前端展示时按 `sortOrder` 排序；拖拽重排后批量 `PATCH /api/bookmarks/reorder`。初期不实现拖拽，按 createdAt 排序即可，字段预留。

### 5. 数据模型

```sql
CREATE TABLE bookmarks (
  id       TEXT PRIMARY KEY,          -- UUID
  title    TEXT NOT NULL,
  url      TEXT NOT NULL,
  category TEXT,                      -- nullable, free text
  screenshot TEXT,                    -- nullable, URL path like /screenshots/xxx.png
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
)
```

## Risks / Trade-offs

- [og:image 抓取失败率] 部分网站有 CORS/robot 限制，服务端 fetch 可能返回 403 → 兜底到手动上传，用户体验降级但不崩溃
- [og:image 跨域重定向] og:image 有时指向 CDN 上的跨域图片，服务端 fetch 后需下载并本地化，否则前端直接引用可能失败 → 统一下载到本地 screenshots/
- [截图文件累积] 删除书签时需同步删除截图文件 → 路由层在删除书签后清理文件
- [粘贴板 API 兼容性] `navigator.clipboard.read()` 需 HTTPS 或 localhost → 本工具运行在 localhost，满足条件

## Open Questions

- 无
