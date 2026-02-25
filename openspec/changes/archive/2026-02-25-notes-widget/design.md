## Context

My Toolbox 是一个本地工具门户 monorepo。现有工具（bookmarks、win-switcher、cc-monitor）都遵循相同的包结构：Fastify 后端 + React 前端 + SQLite + `tool.yaml` 自动注册。Notes 作为第四个工具包，完全复用这套模式。

Portal 桌面使用 react-grid-layout，12 列网格，每行 60px。Widget 通过 iframe 嵌入，URL 加 `?mode=widget` 参数触发紧凑视图。

## Goals / Non-Goals

**Goals:**
- 新增 `packages/notes` 工具包，端口 3004，SQLite 持久化
- 两视图 UI（列表 ↔ 编辑），500ms 自动保存，纯文本 textarea
- 注册到 portal，支持 widget 模式
- 放宽所有 widget 的 minW/minH 约束，允许用户自由调整大小
- 默认布局加入 notes（右下角区域）

**Non-Goals:**
- Markdown 渲染
- 笔记搜索/全文检索（可后续扩展）
- 多用户/同步
- 富文本编辑

## Decisions

**D1: 纯 `<textarea>` 而非 contenteditable**
理由：textarea 对代码、特殊字符、换行的处理是浏览器原生行为，粘贴无损，无 XSS 风险。contenteditable 会对 HTML 实体做转义，粘贴代码时行为不可预测。

**D2: 标题从 content 第一行提取，不单独存字段**
理由：减少 UI 复杂度，用户不需要维护两个输入框。第一行为空时显示"无标题"。

**D3: 自动保存（500ms debounce），不显示保存按钮**
理由：记事本场景下显式保存是摩擦，用户期望"写即保存"。右上角显示淡色 `· saved` 状态反馈即可。

**D4: minW:2 minH:3 宽松约束**
理由：用户明确要求能自由调整大小，过强的 minW/minH 会阻止缩小到合适尺寸。2列≈屏幕宽度1/6，3行=180px，是可用的最小尺寸。其他现有 widget 同步放宽。

**D5: 删除需二次确认（inline，不弹 modal）**
理由：widget 空间小，modal 遮挡内容体验差。点删除按钮后按钮变为"确认删除？"，再点一次才执行，3秒后自动恢复。

## Risks / Trade-offs

- [风险] textarea 在极小尺寸（minW:2）下内容可能被截断 → 用 `resize:none; overflow:auto` 保证滚动可用
- [风险] 第一行提取标题时，如果用户第一行写很长 → 列表视图截断显示（max 40 字符 + 省略号）
- [风险] 放宽 minW/minH 后用户可能把 widget 缩得很小导致 UI 不可用 → 这是用户的选择，不做额外保护
