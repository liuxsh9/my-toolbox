# Work Hours Global Refresh 设计文档

## 背景

当前 Work Hours 已有局部刷新能力：
- `DayView` 在当天场景下可通过 `↻` 调用 `/api/today/refresh` 后重新拉取当日数据；
- `WeekView` 的 `↻` 会重新拉取当前周数据。

但这些刷新都是**局部的**：
- 只影响当前面板；
- 不会让同一个 Work Hours 页面内的其它面板同步刷新；
- 也不会让 portal 中另一个 Work Hours widget / iframe 一起刷新。

用户希望点击任意 Work Hours 刷新按钮后，实现 **Work Hours 工具范围内的全局刷新**：
- 当前页面里的 Summary / Today / Day / Week / Month / Trend 一起刷新；
- portal 外层打开的 Work Hours widget 也一起刷新；
- 不影响其他工具 widget。

## 目标

1. 点击任意 Work Hours 刷新入口后，当前 Work Hours 实例内所有数据面板都重新取数。
2. 同时通知其他 Work Hours 实例（如 portal iframe / 另一个标签页）一起刷新。
3. 不引入 portal 级联刷新，不影响其他工具。
4. 保持刷新逻辑轻量、前端主导，不新增复杂后端协议。

## 方案对比

### 方案 A：只做单实例内 React 状态广播

在当前页面实例中维护一个 refresh token，所有组件订阅它。

- 优点：实现最简单。
- 缺点：无法刷新 portal 中另一个 Work Hours iframe，不满足需求。

### 方案 B：同工具跨实例广播（推荐）

前端增加 Work Hours 专用 refresh bus：
- 当前实例内同步通知；
- 实例间通过 `BroadcastChannel('work-hours-refresh')` 广播；
- 可选加 `localStorage` 事件兜底。

各数据组件订阅该事件后自行重新 fetch。

- 优点：
  - 满足“页面 + widget 一起刷新”；
  - 只影响 Work Hours；
  - 不需要修改 portal。
- 缺点：需要增加少量基础设施与订阅逻辑。

### 方案 C：通过 portal 消息总线跨 iframe 下发刷新

Work Hours 向 portal 发消息，portal 再把 refresh 转发给所有 Work Hours iframe。

- 优点：体系更统一。
- 缺点：改动 portal，明显超出当前需求。

## 决策

采用 **方案 B：Work Hours 专用跨实例 refresh bus**。

## 详细设计

### 1. refresh bus 模块

新增：
- `packages/work-hours/src/web/refreshBus.ts`

提供：
- `emitGlobalRefresh(source?: string)`
- `subscribeGlobalRefresh(listener)`
- `requestTodayRefreshThenBroadcast()`（可选 helper，专门给 Today/Day 的当天刷新按钮用）

行为：
- 同实例内：维护一个本地 listener 集合，`emitGlobalRefresh()` 会立即通知本实例所有订阅者；
- 跨实例：通过 `BroadcastChannel('work-hours-refresh')` 广播 refresh 消息；
- 若未来需要兼容更弱环境，可增加 `localStorage` 事件兜底，但首版优先 `BroadcastChannel`。

### 2. 各组件订阅逻辑

以下组件在挂载时订阅全局 refresh，并在收到事件后执行自身已有 fetch 逻辑：
- `SummaryCards`
- `TodayView`
- `DayView`
- `WeekView`
- `MonthView`
- `TrendView`

原则：
- **每个组件仍然只负责自己的数据源**；
- refresh bus 只负责触发，不负责拼装所有 API。

### 3. 刷新入口语义

#### WeekView 刷新按钮
- 触发 `emitGlobalRefresh('week')`
- 本组件也会通过订阅路径刷新当前周数据
- 不单独再手写一套本地专用 refresh 路径，避免双重语义

#### DayView 当天刷新按钮
- 保留 `/api/today/refresh` 这个特殊能力，因为它会把“结束时间更新到 now”
- 点击逻辑改为：
  1. 调用 `/api/today/refresh`
  2. 成功后 `emitGlobalRefresh('day')`

这样可以保证：
- Today / Summary / Week / Month / Trend 都看到最新数据；
- 其他 Work Hours 实例也同步刷新。

### 4. 各组件刷新内容

- `SummaryCards`：重新拉 `week` / `month` stats
- `TodayView`：重新拉 `/api/today` + 当前周 `/api/days?...`
- `DayView`：重新拉当前 date 的 `/api/days/:date`
- `WeekView`：重新拉当前显示周 `/api/days?...`
- `MonthView`：重新拉当前显示月 `/api/days?...`
- `TrendView`：重新拉当前 range 的 `/api/days?...`

### 5. 测试策略

至少覆盖：

1. **refresh bus 测试**
- `emitGlobalRefresh()` 会触发本实例订阅者；
- 收到 BroadcastChannel 消息时也会触发订阅者。

2. **组件测试**
- `WeekView` 点击刷新后会发出全局 refresh 事件；
- `SummaryCards`（或另一个代表性组件）在收到 refresh 后重新 fetch；
- `DayView` 当天刷新按钮会先调用 `/api/today/refresh` 再广播 refresh。

## 风险与控制

### 风险 1：广播后重复刷新过多

控制：
- 组件只在订阅事件时执行一次自己的 fetch；
- 刷新按钮避免“本地 fetch + 广播 fetch”双执行。

### 风险 2：DayView 当天刷新与普通 refresh 语义混淆

控制：
- 将“写操作（/api/today/refresh）”只保留在当天 DayView 按钮里；
- 其它入口只做只读 reload。

### 风险 3：跨实例广播影响其它工具

控制：
- 使用 Work Hours 专用 channel 名称；
- 只在 Work Hours 前端代码中接入。

## 验证

完成后至少验证：
- `pnpm --filter @my-toolbox/work-hours test`
- `pnpm --filter @my-toolbox/work-hours build`
- 浏览器中点击 Week 或 Today 刷新后，当前页面各面板重新请求数据；
- portal 中的 Work Hours widget 也能收到刷新广播并更新。
