## Context

win-switcher 是 my-toolbox monorepo 的第三个工具包，遵循相同的 Fastify + React + tool.yaml 模式。与前两个工具不同，它没有持久化数据需求（无 SQLite），但需要与 macOS 系统深度交互——枚举窗口、截图、聚焦。核心约束是只使用 macOS 内置工具（`swift` 脚本模式 + `screencapture`），不引入任何原生 npm 绑定或需要编译的二进制。

## Goals / Non-Goals

**Goals:**
- 列举所有普通应用窗口（标题、app 名、实时截图），在浏览器中展示
- 点击窗口卡片后精确聚焦该窗口（提升至前台，激活 app）
- 缩略图低频实时刷新（~15s TTL），不占用过多 CPU
- 权限缺失时降级：无 Screen Recording → 显示 app icon；无 Accessibility → 激活 app 而非精确聚焦窗口
- UI 遵循 CLAUDE.md 设计红线（非通用蓝、非对称布局、强字重对比、细边框区分）

**Non-Goals:**
- 不做全局快捷键 / menubar 入口（浏览器访问即可）
- 不持久化任何数据（无 SQLite）
- 不支持窗口移动/调整大小等操控
- 不做 macOS 版本兼容性降级（仅支持 macOS 12+）

## Decisions

### 1. 窗口枚举：swift 脚本模式（不编译）

**决策**：`packages/win-switcher/src/native/windows.swift` 作为脚本运行（`swift windows.swift list`），使用 `CGWindowListCopyWindowInfo` 枚举窗口，返回 JSON。

**为什么不预编译二进制**：脚本模式无需 build 步骤、无需处理架构差异（x86_64 vs arm64）、无需 git 管理二进制文件，`swift` 命令在任何安装了 Xcode CLT 的开发机上都有。

**启动延迟**：swift 脚本首次执行约 2-3s（JIT）。通过后端缓存 5s 结果来屏蔽这个延迟——实际上 swift 进程每 5s 才被调用一次，用户感知不到。

**备选：osascript JXA** → 无法获取 CGWindowID，导致 `screencapture -l` 无法使用，截图只能用区域截取（精度低），拒绝。

### 2. 截图：screencapture -l \<wid\>

**决策**：`screencapture -l <windowId> -x -t png /tmp/winswitcher/thumb-<wid>.png`

`screencapture` 是 macOS 内置命令，精确按窗口 ID 截图（不受其他窗口遮挡），比区域截图精准得多。截图保存到 `/tmp/winswitcher/`，Fastify 静态托管该目录。

**缓存策略**：文件存在且修改时间 < 15s 时直接返回缓存文件，不重新截图。15s TTL 平衡了实时性和 CPU 开销。

### 3. 窗口聚焦：swift 脚本 + AX API

**决策**：在 `windows.swift focus <pid> <windowTitle>` 子命令中使用 `AXUIElementCreateApplication(pid)` 获取 AX 窗口数组，匹配 title 后设置 `kAXMainAttribute = true` + `NSRunningApplication(processIdentifier:).activate()`。

**降级路径**：若 Accessibility 权限不可用（`AXIsProcessTrusted()` 返回 false），则只调用 `NSRunningApplication.activate(ignoringOtherApps: true)`，激活 app 但不能精确聚焦子窗口。

### 4. 缩略图刷新策略

**决策**：前端通过 `<img src="/api/windows/:wid/thumb?t=<timestamp}">` 加载截图，时间戳由前端控制。

- 页面初始加载：每个窗口立即请求缩略图（并发，后端限制最多 4 个并发 screencapture 进程）
- 自动刷新：前端每 30s 更新所有时间戳，触发浏览器重新拉取缩略图
- 手动刷新：按钮更新时间戳立即触发
- 后端 TTL 15s 保证即使前端频繁请求也不会重复截图

### 5. 无 SQLite，无持久化

窗口状态是实时从 OS 读取的，无需存储。服务器完全无状态（除了内存缓存）。

## Risks / Trade-offs

- [swift 首次执行慢] 首次调用约 2-3s，后续因 OS 层 JIT 缓存会快一些 → 后端缓存 5s，用户不感知
- [Screen Recording 权限来源] macOS 的 Screen Recording 权限授予的是"发起 screencapture 的 responsible app"（即启动 PM2 的 Terminal/iTerm）→ 文档中明确说明需要 Terminal 有该权限
- [窗口标题不唯一] focus 时按 (pid + title) 匹配，若同 app 有两个同名窗口会匹配第一个 → 可接受，极少数情况
- [CGWindowID 在窗口关闭后失效] 缩略图缓存文件的 wid 可能对应已关闭的窗口 → 前端从最新窗口列表中取 wid，不会出现失效情况
- [并发 screencapture 进程] 大量窗口时首次加载并发截图 → 后端限制并发数为 4

## Open Questions

- 无
