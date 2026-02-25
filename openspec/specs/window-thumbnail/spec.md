## ADDED Requirements

### Requirement: Generate window thumbnail on demand
系统 SHALL 提供 `GET /api/windows/:wid/thumb` 端点，返回指定 CGWindowID 的窗口截图（PNG）。后端通过 `screencapture -l <wid> -x -t png <path>` 生成截图并缓存到 `/tmp/winswitcher/thumb-<wid>.png`；若缓存文件存在且修改时间在 15s 以内，直接返回缓存文件。

#### Scenario: 首次请求缩略图
- **WHEN** 客户端请求一个尚无缓存的窗口缩略图
- **THEN** 系统调用 screencapture 生成 PNG，保存到 `/tmp/winswitcher/`，返回该图片

#### Scenario: 缓存命中
- **WHEN** 客户端请求的缩略图缓存文件存在且修改时间 < 15s
- **THEN** 系统直接返回缓存文件，不重新调用 screencapture

#### Scenario: 强制刷新
- **WHEN** 客户端请求 URL 包含不同的 `t=` 时间戳查询参数，且缓存已超过 15s
- **THEN** 系统重新调用 screencapture 生成新截图并返回

#### Scenario: 无效窗口 ID
- **WHEN** 请求的 wid 不对应任何窗口（窗口已关闭）
- **THEN** screencapture 失败，系统返回 404

### Requirement: Limit concurrent screenshot processes
系统 SHALL 限制同时运行的 screencapture 进程数量不超过 4 个，防止首次加载时大量并发截图占用过多系统资源。

#### Scenario: 并发请求超出限制
- **WHEN** 同时有超过 4 个缩略图请求
- **THEN** 超出的请求排队等待，最终均返回结果，不丢失
