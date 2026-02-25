## 1. 包初始化

- [x] 1.1 创建 `packages/bookmarks/` 目录，添加 `package.json`（name: `@my-toolbox/bookmarks`，port 3002，依赖 shared、fastify、@fastify/static、@fastify/cors、@fastify/multipart、better-sqlite3）
- [x] 1.2 创建 `tsconfig.server.json` 继承 `../../tsconfig.base.json`
- [x] 1.3 创建 `tool.yaml`（name: bookmarks, url: http://localhost:3002, port: 3002, category: productivity）
- [x] 1.4 在根 `ecosystem.config.js` 添加 bookmarks PM2 entry（port 3002, PORTAL_URL env）

## 2. 后端：数据库与基础设施

- [x] 2.1 创建 `src/server/db.ts`：初始化 SQLite（WAL 模式），建立 `bookmarks` 表（id TEXT PK, title, url, category, screenshot, sortOrder, createdAt, updatedAt）
- [x] 2.2 创建 `src/server/index.ts`：Fastify 主入口，注册 cors、static（dist/web + screenshots）、multipart，启动后调用 `registerTool()`
- [x] 2.3 创建 `src/server/routes/health.ts`：`GET /api/health` 返回 `{ ok: true }`

## 3. 后端：书签 CRUD 路由

- [x] 3.1 创建 `src/server/routes/bookmarks.ts`：`GET /api/bookmarks`（支持 ?category= 筛选，按 sortOrder/createdAt 排序）
- [x] 3.2 实现 `POST /api/bookmarks`（创建书签，title+url 必填，生成 UUID）
- [x] 3.3 实现 `PATCH /api/bookmarks/:id`（部分更新，更新 updatedAt）
- [x] 3.4 实现 `DELETE /api/bookmarks/:id`（删除书签 + 清理截图文件）
- [x] 3.5 实现 `PATCH /api/bookmarks/reorder`（批量更新 sortOrder）
- [x] 3.6 实现 `GET /api/bookmarks/categories`（返回去重 category 数组）

## 4. 后端：截图服务

- [x] 4.1 创建 `src/server/services/screenshot.ts`：实现 `fetchOgImage(url)` 函数——服务端 fetch URL，解析 HTML 获取 og:image，下载图片到 `data/screenshots/{uuid}.{ext}`，返回本地路径或 null + reason
- [x] 4.2 创建 `src/server/routes/screenshots.ts`：`POST /api/bookmarks/:id/fetch-screenshot`（调用 fetchOgImage，成功则更新书签 screenshot 字段）
- [x] 4.3 实现 `POST /api/bookmarks/:id/upload-screenshot`（multipart 上传，验证 image/\* MIME，保存文件，删除旧截图，更新书签 screenshot 字段）
- [x] 4.4 配置 Fastify static 托管 `data/screenshots/` 目录到 `/screenshots/*` 路径

## 5. 前端：项目结构

- [x] 5.1 创建 `src/web/vite.config.ts`（代理 `/api/*` 和 `/screenshots/*` 到 http://localhost:3002）
- [x] 5.2 创建 `src/web/index.html` 和 `src/web/main.tsx`
- [x] 5.3 安装前端依赖：React 19、Tailwind CSS（或 UnoCSS）

## 6. 前端：书签列表页

- [x] 6.1 创建 `src/web/App.tsx`：布局骨架，顶部标题栏 + 分组筛选 tab + 书签网格
- [x] 6.2 实现分组 tab 栏：从 `/api/bookmarks/categories` 加载，含「全部」选项，非对称布局（参照设计红线）
- [x] 6.3 实现书签卡片组件 `BookmarkCard`：显示截图（或 favicon 占位）、标题、URL 域名；点击卡片在新标签页打开链接；卡片右上角悬停显示编辑/删除操作图标
- [x] 6.4 实现空状态视图（无书签时引导用户添加）

## 7. 前端：添加/编辑书签

- [x] 7.1 实现添加/编辑 Modal（或抽屉），包含 title、url、category 输入框
- [x] 7.2 在 Modal 内实现截图区域：提交 URL 后自动调用 `/api/bookmarks/:id/fetch-screenshot`；显示截图预览；抓取失败时展示上传区域
- [x] 7.3 实现上传区域：支持点击选择文件、拖拽文件、粘贴板粘贴（监听 `paste` 事件，过滤 image/\* blob）
- [x] 7.4 实现删除确认（inline 确认，避免弹窗嵌套）

## 8. 集成验证

- [x] 8.1 `pnpm --filter @my-toolbox/bookmarks dev` 验证开发模式正常启动
- [x] 8.2 验证 portal 能自动发现并在首页展示 bookmarks 工具卡片
- [x] 8.3 验证书签 CRUD 全流程（创建 → og:image 抓取 → 手动上传 → 粘贴板粘贴 → 编辑 → 删除）
- [x] 8.4 `pnpm --filter @my-toolbox/bookmarks build` 验证生产构建成功
