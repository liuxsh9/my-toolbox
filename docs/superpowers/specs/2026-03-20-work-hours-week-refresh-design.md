# Work Hours Week Refresh + Repo Tracking Cleanup 设计文档

## 背景

当前 Work Hours 的 widget 中：
- Today（实际由 `DayView` 承载）在当天场景下已有 `↻` 刷新按钮，可触发 `/api/today/refresh` 并重新拉取当日数据。
- Week 视图无论在完整页面还是 widget 模式下，都没有对应的手动刷新入口。

同时，主仓 `/Users/lxs/code/my-toolbox` 中存在“源码已存在但未被 git 正确追踪”的问题，尤其是 `packages/work-hours/` 整包仍处于未追踪状态，导致同一提交的其他 worktree 中看不到该工具。

## 目标

1. 为 Work Hours 的 Week 视图增加刷新按钮，在完整页面与 widget 模式下都可用。
2. 刷新按钮行为清晰、轻量，不引入额外后端 API。
3. 清理仓库追踪规则：
   - 该追踪的源码、配置、静态数据纳入 git。
   - 本地数据库、运行产物、缓存、临时目录继续忽略。
4. 变更拆成互不耦合的多个 commit，最后合入 `main` 并 push。

## 现状与根因

### Week 视图

`packages/work-hours/src/web/components/WeekView.tsx` 目前具备：
- 周偏移切换（前一周 / 后一周 / This week）
- 周摘要统计
- 柱状图展示
- 依赖 `fetch('/api/days?from=...&to=...')` 拉取当前选中周的数据

但没有手动重新请求的入口。

### 仓库追踪问题

主仓里 `packages/work-hours/` 为未追踪目录，因此：
- 它不会出现在同提交的其他 worktree 中；
- 当前 worktree 缺少该包不是工作树异常，而是因为代码尚未进入 git 索引；
- 修复方式不是复制文件到 worktree，而是让主仓把应追踪内容纳入版本控制。

## 方案对比

### 方案 A：仅给 WeekView 直接加按钮

在 `WeekView` 导航条增加 `↻`，点击后重新执行 `fetchWeek()`。

- 优点：最小改动，风险低。
- 缺点：需要顺手处理加载/禁用态，否则交互不完整。

### 方案 B：给 WeekView 加按钮，并与现有 DayView 刷新体验对齐（推荐）

在 `WeekView` 增加刷新按钮，并沿用 `DayView` 的交互思路：
- 点击后进入 `refreshing` 状态；
- 按钮禁用，透明度降低；
- 请求完成后恢复。

同时单独处理仓库追踪清理。

- 优点：交互一致，变更仍然很小。
- 缺点：需要多维护一个局部状态。

### 方案 C：抽共享刷新组件/Hook

将 Day / Week 的刷新逻辑进一步抽象。

- 优点：结构更统一。
- 缺点：对当前需求偏重，容易扩大提交范围。

## 决策

采用 **方案 B**。

## 详细设计

### 1. Week 刷新按钮

修改文件：
- `packages/work-hours/src/web/components/WeekView.tsx`

设计：
- 在顶部导航区增加 `↻` 刷新按钮；
- widget 与完整页面都显示；
- 样式沿用现有导航按钮风格：
  - widget 使用 `navBtnSmall`
  - 完整页面使用 `navBtnStyle`
- 刷新中：
  - `disabled=true`
  - `opacity: 0.5`

### 2. Week 刷新语义

刷新只做：
- 重新请求当前周的 `/api/days?from=...&to=...`

不新增后端 endpoint，不修改数据库逻辑。

理由：
- Week 视图展示的是周聚合数据；
- 只要重新拉取当前周数据，就能反映最新状态；
- 避免将 `DayView` 的 `/api/today/refresh` 语义误用到周视图。

### 3. TDD 验证策略

由于当前 `work-hours` 包没有现成测试基础设施，本次为前端组件补最小测试能力：
- 在 `packages/work-hours` 中增加 Vitest + Testing Library 基础配置；
- 为 `WeekView` 编写测试，覆盖：
  1. 渲染周导航时出现刷新按钮；
  2. 点击刷新按钮会再次请求当前周数据；
  3. 请求进行中按钮处于 disabled 状态。

### 4. 仓库追踪修复策略

先审计主仓未追踪内容，并分类：

#### 应追踪
- `packages/work-hours/` 源码与配置文件
- 其他明确属于源码/配置/文档且当前未追踪、又不属于本地产物的内容

#### 应忽略
- `packages/work-hours/data/work-hours.db*`
- 运行生成的截图、缓存、临时目录
- 本地代理/智能体目录（如 `.agents/`, `.superpowers/`）
- 构建产物

必要时更新根目录 `.gitignore`，以确保“应忽略”的内容不会再次污染状态。

## 提交拆分策略

预期拆分为以下独立 commit：

1. **chore(gitignore): ignore local runtime/generated artifacts**
   - 仅包含忽略规则调整。

2. **feat(work-hours): add package sources to version control**
   - 仅包含 `packages/work-hours/` 应纳入版本控制的源码/配置/静态数据。

3. **test(work-hours): add frontend test harness for week refresh behavior**
   - 仅包含测试基础设施与测试用例。

4. **feat(work-hours): add manual refresh button to week view**
   - 仅包含 Week 刷新功能本身。

如审计到其他完全独立、且也应被追踪的包（如 `packages/api-quota/`, `packages/litellm-monitor/`），再单独拆成各自 commit，不与 work-hours 混合。

## 风险与控制

### 风险 1：把本地数据或产物错误纳入 git

控制：
- 先审计 `git status --short --untracked-files=all`
- 明确分类后再 add
- 对数据库与产物路径先补 `.gitignore`

### 风险 2：Week 刷新按钮只“看起来能点”，但没有真的重新请求

控制：
- 用测试验证点击会触发第二次请求
- 用构建与测试双重校验

### 风险 3：测试基础设施引入过重

控制：
- 仅补最小可用的 Vitest + jsdom + Testing Library
- 只覆盖当前需求相关组件行为，不扩大到整个包

## 验证

完成后至少验证：
- `pnpm --filter @my-toolbox/work-hours test`
- `pnpm --filter @my-toolbox/work-hours build`
- `git status` 仅剩预期变更
- push 成功
