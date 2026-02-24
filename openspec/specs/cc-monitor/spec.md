### Requirement: Hook 事件接收

CC Monitor SHALL 提供 HTTP API 接收来自 Claude Code Hooks 的事件。

#### Scenario: 接收 SessionStart 事件

- **WHEN** Claude Code 实例触发 SessionStart Hook, POST 到 `/api/events`
- **THEN** Monitor SHALL 记录新会话, 包含 session_id, cwd (项目目录), 时间戳
- **THEN** Monitor SHALL 将该会话状态设为 `started`

#### Scenario: 接收 PostToolUse 事件

- **WHEN** Claude Code 实例触发 PostToolUse Hook
- **THEN** Monitor SHALL 更新该会话的 lastActivity 时间戳
- **THEN** Monitor SHALL 将该会话状态设为 `working`

#### Scenario: 接收 Stop 事件

- **WHEN** Claude Code 实例触发 Stop Hook
- **THEN** Monitor SHALL 将该会话状态设为 `idle` (回复完成, 等待用户输入)

#### Scenario: 接收 Notification 事件 (idle_prompt)

- **WHEN** Claude Code 实例触发 Notification Hook (matcher: idle_prompt)
- **THEN** Monitor SHALL 将该会话状态设为 `waiting_for_input`

#### Scenario: 接收 UserPromptSubmit 事件

- **WHEN** Claude Code 实例触发 UserPromptSubmit Hook
- **THEN** Monitor SHALL 将该会话状态设为 `processing`

#### Scenario: 接收 SessionEnd 事件

- **WHEN** Claude Code 实例触发 SessionEnd Hook
- **THEN** Monitor SHALL 将该会话状态设为 `ended`

### Requirement: 进程检测

CC Monitor SHALL 通过系统进程检测识别运行中的 Claude Code 实例。

#### Scenario: 扫描 Claude Code 进程

- **WHEN** Monitor 定时 (每 30 秒) 扫描系统进程
- **THEN** Monitor SHALL 通过 `ps` 命令找到所有 `claude` 进程
- **THEN** 对每个进程, 提取 PID, TTY, 启动参数, 运行时长

#### Scenario: 进程消失

- **WHEN** 之前检测到的 Claude 进程不再存在
- **THEN** Monitor SHALL 将对应会话状态标记为 `terminated`

#### Scenario: 无 Hook 但有进程

- **WHEN** 检测到 Claude 进程但未收到过该进程的 Hook 事件
- **THEN** Monitor SHALL 创建一个"未关联"的会话记录, 状态为 `detected` (仅进程级信息)

### Requirement: 会话状态查询 API

CC Monitor SHALL 提供 API 查询所有 Claude Code 会话状态。

#### Scenario: 获取所有会话

- **WHEN** 客户端 GET `/api/sessions`
- **THEN** Monitor SHALL 返回所有活跃会话列表, 包含: session_id, project (cwd), status, lastActivity, pid, tty

#### Scenario: 获取单个会话详情

- **WHEN** 客户端 GET `/api/sessions/:sessionId`
- **THEN** Monitor SHALL 返回该会话的完整信息, 包含事件历史

### Requirement: 监控面板 UI

CC Monitor SHALL 提供 Web UI 展示所有 Claude Code 实例的实时状态。

#### Scenario: 会话卡片展示

- **WHEN** 用户访问 Monitor 首页
- **THEN** 页面 SHALL 展示所有活跃 Claude Code 会话的卡片
- **THEN** 每张卡片 SHALL 包含: 项目名称 (从 cwd 提取), 状态标签, 运行时长, 最后活跃时间

#### Scenario: 状态颜色编码

- **WHEN** 页面展示会话卡片
- **THEN** 状态标签 SHALL 使用颜色编码:
  - 绿色: `working`, `processing`
  - 蓝色: `started`, `idle`
  - 黄色: `waiting_for_input`
  - 灰色: `ended`, `terminated`, `detected`

#### Scenario: 实时更新

- **WHEN** Monitor 页面打开
- **THEN** 页面 SHALL 每 5 秒轮询 `/api/sessions` 获取最新状态

### Requirement: Claude Code Hooks 配置

CC Monitor SHALL 提供 Hooks 配置方案, 使所有 Claude Code 实例自动上报事件。

#### Scenario: 安装 Hooks

- **WHEN** 用户运行 Monitor 提供的安装脚本
- **THEN** 脚本 SHALL 在 `~/.claude/settings.json` 中的 `hooks` 字段添加以下 Hook 配置:
  - `SessionStart`: POST 事件到 Monitor API
  - `PostToolUse`: POST 事件到 Monitor API
  - `Stop`: POST 事件到 Monitor API
  - `Notification` (matcher: `idle_prompt`): POST 事件到 Monitor API
  - `UserPromptSubmit`: POST 事件到 Monitor API
  - `SessionEnd`: POST 事件到 Monitor API
- **THEN** 脚本 SHALL 保留 settings.json 中的现有配置, 仅追加 hooks

#### Scenario: 卸载 Hooks

- **WHEN** 用户运行 Monitor 提供的卸载脚本
- **THEN** 脚本 SHALL 从 `~/.claude/settings.json` 的 `hooks` 中移除 Monitor 相关的配置
- **THEN** 脚本 SHALL 保留用户其他 hooks 配置

### Requirement: Monitor 自身健康端点

CC Monitor SHALL 暴露自身健康检查端点。

#### Scenario: 健康检查

- **WHEN** 客户端 GET `/api/health`
- **THEN** Monitor SHALL 返回 200 和 `{ "status": "ok" }`
