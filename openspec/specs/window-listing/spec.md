## ADDED Requirements

### Requirement: Enumerate on-screen windows
系统 SHALL 通过 `swift src/native/windows.swift list` 调用 macOS `CGWindowListCopyWindowInfo`，枚举当前屏幕上所有 `kCGWindowLayer == 0` 的普通应用窗口，返回 JSON 数组，每条记录包含：`id`（CGWindowID）、`title`（窗口标题）、`app`（应用名）、`pid`（进程 PID）、`x`/`y`/`width`/`height`（窗口位置和尺寸）。

#### Scenario: 成功枚举窗口列表
- **WHEN** 客户端请求 `GET /api/windows`
- **THEN** 系统返回当前屏幕所有普通窗口的 JSON 数组，每项含 id、title、app、pid、x、y、width、height 字段

#### Scenario: 过滤系统浮层窗口
- **WHEN** 客户端请求 `GET /api/windows`
- **THEN** 系统返回列表中不包含 `kCGWindowLayer > 0` 的系统级窗口（如 Dock、控制中心、通知横幅）

#### Scenario: 结果缓存
- **WHEN** 在上次 swift 调用完成后 5s 内再次请求 `GET /api/windows`
- **THEN** 系统直接返回缓存结果，不重新调用 swift 脚本

### Requirement: Report permission status
`GET /api/windows` 响应 SHALL 包含 `permissions` 字段，报告 Screen Recording 和 Accessibility 两个权限的当前状态，供前端展示引导信息。

#### Scenario: 权限齐全
- **WHEN** 系统已授予 Screen Recording 和 Accessibility 权限
- **THEN** 响应中 `permissions.screenRecording` 和 `permissions.accessibility` 均为 `true`

#### Scenario: 权限缺失
- **WHEN** 某项权限未授予
- **THEN** 对应字段为 `false`，窗口列表仍正常返回（功能降级）
