### Requirement: Tool Manifest 格式定义

每个工具 SHALL 通过一个 `tool.yaml` 文件声明自身元数据。Manifest 包含以下必填字段:
- `name`: 工具唯一标识符 (kebab-case)
- `displayName`: 工具显示名称
- `description`: 工具功能描述
- `version`: 语义化版本号
- `url`: 工具 Web UI 的完整访问地址 (含协议、主机、端口)
- `health`: 健康检查端点路径 (相对于 url)

可选字段:
- `icon`: 图标标识
- `category`: 工具分类
- `pm2Name`: PM2 进程名称 (用于门户查询 PM2 状态)

#### Scenario: 有效的 tool.yaml

- **WHEN** 工具项目根目录存在以下 `tool.yaml`:
  ```yaml
  name: cc-monitor
  displayName: Claude Code Monitor
  description: 监控本地所有 Claude Code 实例的运行状态
  version: 0.1.0
  url: http://localhost:3001
  health: /api/health
  pm2Name: cc-monitor
  ```
- **THEN** 门户 SHALL 能解析该文件并提取所有字段

#### Scenario: 缺少必填字段

- **WHEN** `tool.yaml` 缺少 `name` 或 `url` 字段
- **THEN** 门户 SHALL 拒绝注册并返回错误信息, 列出缺失的字段

### Requirement: 注册 SDK

shared 包 SHALL 提供 `registerTool()` 函数, 外部工具可通过该函数向门户注册。

#### Scenario: 外部工具通过 SDK 注册

- **WHEN** 外部工具调用 `registerTool({ portalUrl: 'http://localhost:3000', manifest: { ... } })`
- **THEN** SDK SHALL POST manifest 到门户 `/api/tools/register` 端点
- **THEN** SDK SHALL 启动定时心跳 (默认每 30 秒), PUT `/api/tools/:name/heartbeat`

#### Scenario: 门户不可达时的 SDK 行为

- **WHEN** 门户未启动或网络不通
- **THEN** SDK SHALL 静默重试, 不阻塞工具自身启动
- **THEN** SDK SHALL 在日志中记录连接失败
