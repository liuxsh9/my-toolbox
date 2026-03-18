# Work Hours — 工时统计工具设计文档

## 概述

Work Hours 是 my-toolbox 平台的一个新工具，用于精确记录和可视化每日工作时间。通过监听 macOS 系统事件（屏幕锁定/解锁）和用户活动（HIDIdleTime），自动采集上下班时间，结合中国法定节假日日历和公司特殊规则，计算有效工时和加班时长。

## 架构

### 单进程模型

一个 Node.js 进程同时承担两个职责：

1. **事件采集**：通过 `child_process.spawn` 启动常驻 Swift 脚本，监听系统事件，解析 stdout JSON lines 写入 SQLite
2. **Web 服务**：Fastify 提供 REST API + React SPA 前端

PM2 保活，与其他工具共用 `ecosystem.config.js`。Swift 脚本作为 Node 子进程，Node 挂了 PM2 拉起，Swift 跟着重启。

### 端口

- 后端：3007
- Vite dev：5179

### 包结构

```
packages/work-hours/
├── src/
│   ├── server/
│   │   ├── index.ts              # Fastify 入口 + Swift daemon 管理
│   │   ├── db.ts                 # SQLite 初始化
│   │   ├── calculator.ts         # 工时计算引擎（休息扣除、加班、月末周六）
│   │   └── routes/
│   │       ├── health.ts         # GET /api/health
│   │       ├── days.ts           # 日/范围查询 + 手动编辑
│   │       ├── today.ts          # 今日实时数据
│   │       ├── stats.ts          # 统计摘要
│   │       └── holidays.ts       # 节假日配置 CRUD
│   ├── native/
│   │   └── monitor.swift         # 常驻 Swift 脚本
│   └── web/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.html
│       ├── index.css
│       ├── vite.config.ts
│       └── components/
│           ├── TodayView.tsx      # 今日仪表盘
│           ├── DayView.tsx        # 日视图（时间轴）
│           ├── WeekView.tsx       # 周视图（柱状图）
│           ├── MonthView.tsx      # 月视图（日历热力图）
│           ├── TrendView.tsx      # 趋势折线图
│           ├── SummaryCards.tsx    # 摘要卡片
│           └── EditModal.tsx      # 手动编辑弹窗
├── data/
│   ├── work-hours.db             # SQLite 数据库（自动创建，gitignored）
│   └── holidays.json             # 节假日配置（手动维护）
├── package.json
├── tsconfig.server.json
└── tool.yaml
```

## Swift Daemon

### 文件

`src/native/monitor.swift`

### 监听机制

1. **屏幕锁定/解锁**：通过 `NSDistributedNotificationCenter` 监听：
   - `com.apple.screenIsLocked` → 输出 `screen_lock` 事件
   - `com.apple.screenIsUnlocked` → 输出 `screen_unlock` 事件

2. **用户空闲检测**：每 30 秒轮询 `IOHIDSystemActivity` 的 HIDIdleTime：
   - 空闲超过 5 分钟 → 输出 `idle_start` 事件
   - 从空闲恢复 → 输出 `idle_end` 事件

### 输出格式

stdout JSON lines，Node 逐行解析：

```json
{"type":"screen_unlock","timestamp":"2026-03-18T09:01:23+08:00"}
{"type":"screen_lock","timestamp":"2026-03-18T18:15:02+08:00"}
{"type":"idle_start","timestamp":"2026-03-18T15:30:00+08:00"}
{"type":"idle_end","timestamp":"2026-03-18T15:47:30+08:00"}
```

### Node 端处理

收到事件后：
- 计算 `work_day`（凌晨 4:00 分界：4:00 前的事件归属前一天）
- 写入 SQLite `events` 表
- 更新 `daily_summary` 缓存

启动时从 SQLite 读取当天已有事件，避免重启导致状态丢失。

## 数据模型

### events 表

原始事件流，daemon 写入的每一条记录。

| 列 | 类型 | 说明 |
|----|------|------|
| id | INTEGER PRIMARY KEY | 自增 |
| type | TEXT | `screen_unlock`, `screen_lock`, `idle_start`, `idle_end` |
| timestamp | TEXT | ISO 8601 格式 |
| work_day | TEXT | 归属工作日 YYYY-MM-DD |

### daily_summary 表

每日汇总，由 API 层按需从 events 计算并缓存。

| 列 | 类型 | 说明 |
|----|------|------|
| work_day | TEXT PRIMARY KEY | 工作日 YYYY-MM-DD |
| first_active | TEXT | 当天第一次活动时间 |
| last_active | TEXT | 当天最后一次活动时间 |
| raw_minutes | INTEGER | 原始在岗分钟数（last - first） |
| break_minutes | INTEGER | 扣除的休息分钟数 |
| effective_minutes | INTEGER | 有效工时 |
| overtime_minutes | INTEGER | 加班分钟数 |
| day_type | TEXT | `workday`, `weekend`, `holiday`, `adjusted_workday`, `month_end_saturday` |
| source | TEXT | `auto` 或 `manual` |

## 工时计算引擎

### calculator.ts

核心计算逻辑，集中在一个模块中。

### 工作日分界

凌晨 4:00 为日分界点。0:00-3:59 的活动归属前一天。

### 休息时段扣除

两个固定休息时段：
- 午休：12:30 - 14:00（90 分钟）
- 晚餐：18:00 - 18:30（30 分钟）

只扣除工作时段与休息时段的重叠部分。例如：
- 9:00-18:15 在岗 → 午休全扣 90 分钟，晚餐重叠 18:00-18:15 扣 15 分钟
- 但 18:15 离开按规则视为 18:00 离开，所以有效截止时间为 18:00，晚餐扣除 0 分钟

精确规则：如果 last_active 落在休息时段内，有效截止时间回退到该休息时段的开始时间。

### 加班计算

- 标准工时：8 小时/天
- 工作日：effective_minutes > 480 的部分为加班
- 周末/节假日：全部 effective_minutes 为加班
- 调休工作日：按正常工作日计算

### 月末周六规则

每月最后一个周六，如果该日期：
- 不是法定节假日
- 不是法定调休工作日

则视为 `month_end_saturday` 类型：
- 无论实际工时多少，effective_minutes 固定为 480（8 小时）
- overtime_minutes 固定为 0
- 上下班时间照常记录

### 日历判断

`data/holidays.json` 按年存储，格式：

```json
{
  "2026": {
    "holidays": ["2026-01-01", "2026-01-29", "2026-01-30", "..."],
    "adjusted_workdays": ["2026-01-25", "2026-02-08", "..."]
  }
}
```

判断优先级：
1. `holidays.json` 中的 `holidays` → 节假日
2. `holidays.json` 中的 `adjusted_workdays` → 调休工作日（即使是周末也算工作日）
3. 月末周六规则检查
4. 周一至周五 → 工作日
5. 周六周日 → 周末

## API 设计

端口 3007，所有路由前缀 `/api`。

### GET /api/health

健康检查，返回 daemon 状态。

### GET /api/today

今日实时数据。

```json
{
  "work_day": "2026-03-18",
  "day_type": "workday",
  "first_active": "09:03",
  "last_active": null,
  "status": "working",
  "raw_minutes": 552,
  "break_minutes": 105,
  "effective_minutes": 447,
  "overtime_minutes": 0,
  "daemon_running": true
}
```

`status`：`working`（有活动）、`idle`（空闲中）、`left`（已锁屏/长时间空闲）、`not_started`（今天还没活动）。

### GET /api/days?from=YYYY-MM-DD&to=YYYY-MM-DD

日期范围查询，返回 daily_summary 列表。

### GET /api/days/:date

单日详情，包含事件流和汇总。

### PUT /api/days/:date

手动编辑某天的上下班时间。

```json
{
  "first_active": "09:00",
  "last_active": "18:30"
}
```

写入时 `source` 标记为 `manual`，自动重新计算 effective_minutes 等字段。

### GET /api/stats?period=week|month

统计摘要。

```json
{
  "period": "week",
  "total_effective_hours": 38.5,
  "total_overtime_hours": 2.3,
  "avg_effective_hours": 7.7,
  "avg_start_time": "09:12",
  "avg_end_time": "18:45",
  "earliest_start": "08:30",
  "latest_end": "22:15",
  "days_worked": 5
}
```

### GET /api/holidays/:year

获取指定年份的节假日配置。

### PUT /api/holidays/:year

更新指定年份的节假日配置。

## 前端设计

### 技术栈

React + Vite + recharts（图表库）。Inline styles + CSS custom properties，不使用 Tailwind。

### Widget 模式适配

检测 URL 参数 `?mode=widget`：
- **Widget 模式（小尺寸）**：只显示今日摘要 — 状态指示灯、有效工时大数字、上班时间、当前状态
- **Widget 模式（大尺寸）**：摘要 + 本周迷你柱状图
- **独立页面模式**：完整的多 tab 视图

通过容器宽度自适应判断展示内容（`ResizeObserver`）。

### 配色

- 主色调：琥珀/橙色系 `#E8913A`，代表工作时间
- 加班：珊瑚色 `#E06060`
- 休息扣除：柔和灰 `#E5E5E5`（斜线纹理）
- 背景：微暖白 `#FAFAF8`（独立页面），portal 深色主题下使用 CSS 变量适配
- 文字层级：标题深色粗字重，正文 `#6B7280`

Widget 嵌入 portal 时使用 portal 的 CSS 变量（`var(--surface)`, `var(--text-1)` 等），独立页面使用自有配色。通过 `prefers-color-scheme` 或 `?mode=widget` 参数切换。

### 布局

非对称布局：左侧窄栏放摘要卡片和日期导航，右侧宽区域放图表。大面积留白。

### 视图

#### 今日视图（默认）
- 左栏：状态指示灯（工作中/已离开）、有效工时大数字、在岗时长、休息扣除、加班时长
- 右栏：横向时间轴条（8:00 - 次日 2:00），彩色段 = 工作，斜线纹理 = 休息扣除。下方本周迷你柱状图

#### 日视图
- 日期选择器
- 横向时间轴条，hover 显示详情
- 事件列表（锁屏/解锁/空闲记录）
- 编辑按钮 → 弹出 EditModal 修改上下班时间

#### 周视图
- 柱状图（recharts BarChart），每天一根柱子
- 颜色区分：正常工时（琥珀色）、加班部分（珊瑚色叠加在顶部）
- 顶部显示周合计工时和加班

#### 月视图
- 日历热力图网格，7 列（周一至周日）
- 格子颜色深浅 = 工时长短（浅橙 < 8h，标准橙 = 8h，深橙 > 8h）
- 周末/节假日灰色底
- 月末周六虚线边框 + 浅橙底特殊标记
- 今天高亮边框
- 点击格子跳转日视图
- 顶部显示月累计和加班

#### 趋势视图
- 折线图（recharts LineChart），最近 30/60/90 天可切换
- 有效工时折线 + 8 小时基准线
- 可叠加显示加班趋势线

### 摘要卡片

始终显示在页面顶部（非 widget 模式下）：
- 本周累计工时
- 本月累计工时
- 平均每日工时
- 平均上班时间
- 平均下班时间

## tool.yaml

```yaml
name: work-hours
displayName: Work Hours
description: 工时统计 — 自动记录上下班时间，可视化工作时长与加班
version: 0.1.0
url: http://localhost:3007
health: /api/health
pm2Name: work-hours
category: productivity
widget:
  minW: 2
  minH: 4
  defaultW: 4
  defaultH: 14
```

## PM2 配置

```javascript
{
  name: 'work-hours',
  script: 'packages/work-hours/dist/server/index.js',
  node_args: '--experimental-specifier-resolution=node',
  env: {
    NODE_ENV: 'production',
    PORT: 3007,
    PORTAL_URL: 'http://localhost:3000',
  },
}
```

## 依赖

### 运行时
- `@my-toolbox/shared` — 注册 SDK
- `fastify`, `@fastify/cors`, `@fastify/static` — Web 服务
- `better-sqlite3` — 数据存储

### 前端
- `react`, `react-dom` — UI
- `recharts` — 图表
- `@vitejs/plugin-react`, `vite` — 构建

### 开发
- `tsx`, `concurrently`, `typescript` — 开发工具链
- `@types/better-sqlite3`, `@types/react`, `@types/react-dom` — 类型

## 权限要求

Swift daemon 无需额外权限：
- `NSDistributedNotificationCenter` 监听锁屏通知不需要特殊权限
- `IOHIDSystemActivity` 读取 HIDIdleTime 不需要辅助功能权限

## 边界情况

1. **跨日工作**：凌晨 4:00 前的活动归前一天。如果 3:59 锁屏，算前一天下班；4:01 解锁，算新一天上班
2. **PM2 重启**：启动时从 SQLite 读取当天事件恢复状态，不丢失 first_active
3. **Swift 脚本崩溃**：Node 检测子进程退出后自动重启
4. **无活动日**：daily_summary 中不会有记录，API 返回空
5. **手动编辑覆盖**：manual 记录覆盖 auto 记录的 first_active/last_active，重新计算所有衍生字段
6. **休息时段内离开**：last_active 落在休息时段内时，有效截止时间回退到休息时段开始。例如 12:45 离开 → 有效截止 12:30
