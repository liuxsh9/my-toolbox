# Todo List 工具设计规格

## 概述

为 my-toolbox 门户新增一个轻量级个人日常待办工具。单一列表、纯标题、勾选划掉、可归档、拖拽排序。主要在 portal widget 场景使用，需自适应 widget 尺寸。金色系配色，与 portal 风格统一。

## 数据模型

SQLite 数据库 `data/todo.db`，WAL 模式。

### todos 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 主键，UUID |
| `title` | TEXT NOT NULL | 待办标题 |
| `completed` | INTEGER DEFAULT 0 | 0=未完成, 1=已完成 |
| `archived` | INTEGER DEFAULT 0 | 0=活跃, 1=已归档 |
| `sort_order` | INTEGER NOT NULL | 排序位置，越小越靠前 |
| `created_at` | TEXT NOT NULL | ISO 8601 创建时间 |
| `updated_at` | TEXT NOT NULL | ISO 8601 更新时间 |

索引：`CREATE INDEX idx_todos_active ON todos(archived, sort_order)` 用于列表查询。

## API 设计

基础路径：`http://localhost:3009`

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/todos` | 获取未归档列表 | — | `{ todos: Todo[] }` 按 sort_order 升序 |
| POST | `/api/todos` | 创建待办 | `{ title: string }` | `{ todo: Todo }` sort_order 自动取 max+1 |
| PUT | `/api/todos/:id` | 更新待办 | `{ title?, completed? }` | `{ todo: Todo }` |
| PUT | `/api/todos/reorder` | 批量更新排序 | `{ ids: string[] }` | `{ success: true }` ids 数组顺序即新排序 |
| POST | `/api/todos/archive-completed` | 归档所有已完成项 | — | `{ archived: number }` 归档数量 |
| DELETE | `/api/todos/:id` | 删除单条 | — | `{ success: true }` |
| GET | `/api/health` | 健康检查 | — | `{ status: 'ok' }` |

## 前端设计

### 布局

单视图列表，自上而下：
1. 可滚动的待办列表（flex:1，占满可用空间）
2. 底部固定区域：输入框 + 归档按钮

### 列表项

每个待办项一行：
- 左侧：圆形 checkbox（16px，金色边框 `#c8a96e`）
- 中间：标题文字（13px，`#ede8de`）
- 右侧：拖拽手柄 ⠿（`#4a4844`，hover 时变亮）

已完成项：
- Checkbox 填充金色背景 + 白色 ✓
- 标题划掉 + 变灰（`#8c8680`，opacity 0.45）
- 可点击取消完成

### 添加

底部输入框，placeholder "+ 添加待办..."，回车提交，提交后清空并保持焦点。

### 归档

底部右侧「归档 ✓」文字按钮，点击归档所有已完成项。无已完成项时隐藏此按钮。

### 删除

暂不实现复杂的左滑删除。提供简单的右键上下文菜单或 hover 时显示 × 按钮来删除单条。

### 拖拽排序

使用 `@dnd-kit/core` + `@dnd-kit/sortable`。拖拽手柄触发，拖拽时项目半透明。放下后调用 reorder API 批量更新排序。

### 配色

复用 portal 的 CSS custom properties 体系：

```css
:root {
  --bg:       #221f17;   /* 匹配 portal surface，widget 内无需二次背景 */
  --surface:  #2a2720;
  --border:   rgba(255,255,255,0.06);
  --text-1:   #ede8de;
  --text-2:   #8c8680;
  --text-3:   #4a4844;
  --accent:   #c8a96e;
}
```

### 自适应策略

通过 `ResizeObserver` 监听根容器宽度：

| 容器宽度 | 调整 |
|----------|------|
| ≥ 200px | 正常模式：完整 UI |
| < 200px | 紧凑模式：隐藏拖拽手柄，字号 12px，间距缩小，归档按钮隐藏 |

## 包结构

```
packages/todo/
├── tool.yaml
├── package.json           # @my-toolbox/todo
├── tsconfig.server.json   # extends ../../tsconfig.base.json
├── src/
│   ├── server/
│   │   ├── index.ts       # Fastify 入口 + registerTool()
│   │   ├── db.ts          # SQLite 初始化
│   │   └── routes/
│   │       ├── health.ts
│   │       └── todos.ts
│   └── web/
│       ├── index.html
│       ├── index.css
│       ├── main.tsx
│       ├── App.tsx
│       └── vite.config.ts # port 5182, proxy → 3009
```

## tool.yaml

```yaml
name: todo
displayName: Todo
description: 轻量待办清单，勾选完成、拖拽排序、一键归档
version: 0.1.0
url: http://localhost:3009
health: /api/health
pm2Name: todo
category: productivity
widget:
  minW: 2
  minH: 4
  defaultW: 3
  defaultH: 10
```

## 端口

- Server: 3009
- Vite dev: 5182

## 依赖

- `@my-toolbox/shared` (workspace)
- `fastify`, `@fastify/cors`, `@fastify/static`
- `better-sqlite3`
- `react`, `react-dom`
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `vite`, `@vitejs/plugin-react`

## PM2 配置

在 `ecosystem.config.js` 中添加：

```javascript
{
  name: 'todo',
  script: 'packages/todo/dist/server/index.js',
  node_args: '--experimental-specifier-resolution=node',
  env: { PORT: 3009 }
}
```

## 不做的事

- 不做多列表/分组
- 不做优先级、截止日期、备注
- 不做搜索/过滤
- 不做归档列表查看（归档即清理）
- 不做动画效果（保持轻量）
