## Why

开发者在多任务工作时，常常需要在大量打开的窗口之间快速跳转。macOS 自带的 Mission Control 需要手势或快捷键，Cmd+Tab 只切换 app 不切换窗口，Exposé 没有文字搜索。win-switcher 提供一个浏览器可访问的窗口总览，直观展示所有窗口的实时截图，点击即跳转，作为 my-toolbox 的一个工具统一管理。

## What Changes

- 新增 `packages/win-switcher` 工具包（Fastify :3003 + React SPA）
- 后端通过两个 macOS 内置工具驱动：
  - `swift src/native/windows.swift` 脚本（脚本模式，无需编译）：枚举所有屏幕窗口（含 CGWindowID、标题、app 名、PID、bounds），并通过 Accessibility API 聚焦指定窗口
  - `screencapture -l <windowId> -x` ：对指定 CGWindowID 截图，输出至 `/tmp/winswitcher/`
- 窗口列表每 5s 刷新一次（前端轮询），结果后端缓存 5s
- 缩略图按需生成，缓存在 `/tmp/winswitcher/thumb-<wid>.png`（TTL 15s）
- 系统级浮层窗口（kCGWindowLayer > 0）自动过滤
- 需要两个 macOS 权限：Screen Recording（截图）、Accessibility（聚焦窗口）
- 权限缺失时 UI 给出引导链接，功能降级运行
- 注册到 portal（via `tool.yaml`），端口 3003

## Capabilities

### New Capabilities

- `window-listing`: 通过 swift 脚本枚举当前屏幕所有普通应用窗口，返回 CGWindowID、标题、app 名、PID、bounds；结果后端缓存 5s
- `window-thumbnail`: 通过 screencapture 对指定窗口截图并缓存到本地文件；Fastify 静态托管缩略图文件
- `window-focus`: 通过 swift 脚本调用 AX API，将指定窗口提升为前台并激活对应 app

### Modified Capabilities

<!-- 无 -->

## Impact

- 新增 `packages/win-switcher/` 目录（server、web、native、tool.yaml）
- `ecosystem.config.js`：新增 win-switcher PM2 entry（port 3003）
- 新依赖：无（仅依赖 shared、fastify 及 macOS 系统工具）
- macOS 权限：Screen Recording + Accessibility（用户手动授权）
- `/tmp/winswitcher/` 目录：运行时自动创建，用于存放截图缓存
