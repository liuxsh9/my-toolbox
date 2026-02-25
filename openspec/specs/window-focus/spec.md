## ADDED Requirements

### Requirement: Focus window via Accessibility API
系统 SHALL 提供 `POST /api/windows/:wid/focus` 端点，通过 `swift src/native/windows.swift focus <pid> <title>` 将指定窗口提升为前台。Swift 脚本使用 `AXUIElementCreateApplication(pid)` 获取 AX 窗口数组，匹配 title 后设置 `kAXMainAttribute = true`，并调用 `NSRunningApplication(processIdentifier:).activate(ignoringOtherApps: true)` 激活应用。

#### Scenario: 成功聚焦窗口
- **WHEN** 客户端 POST `/api/windows/:wid/focus`，且 Accessibility 权限已授予
- **THEN** 系统调用 swift focus 脚本，目标窗口提升至前台，目标 app 成为活跃应用，返回 `{ ok: true }`

#### Scenario: Accessibility 权限未授予时降级
- **WHEN** 客户端请求聚焦窗口，但 Accessibility 权限不可用
- **THEN** 系统仅激活目标 app（`NSRunningApplication.activate`）而不精确聚焦子窗口，返回 `{ ok: true, degraded: true, reason: "no_accessibility" }`

#### Scenario: 目标窗口已关闭
- **WHEN** 请求聚焦时目标窗口已不存在
- **THEN** 系统返回 `{ ok: false, error: "window_not_found" }`，HTTP 404

### Requirement: Focus request uses wid from window list
`POST /api/windows/:wid/focus` 的请求体 SHALL 包含 `pid` 和 `title` 字段（从 `GET /api/windows` 列表中取得），后端用这两个字段调用 swift focus 脚本。wid 仅作为路由标识符使用。

#### Scenario: 请求体缺少必填字段
- **WHEN** 请求体缺少 pid 或 title
- **THEN** 系统返回 400 错误
