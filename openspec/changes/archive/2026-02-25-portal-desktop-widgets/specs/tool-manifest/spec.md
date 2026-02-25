## MODIFIED Requirements

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
- `widget`: widget 嵌入配置块 (见下)

`widget` 可选子字段:
- `minW`: 最小宽度 (网格列数，12列制，默认 3)
- `minH`: 最小高度 (网格行数，默认 4)
- `defaultW`: 默认宽度 (网格列数，默认 4)
- `defaultH`: 默认高度 (网格行数，默认 6)

#### Scenario: 有效的 tool.yaml（含 widget 块）

- **WHEN** 工具项目根目录存在以下 `tool.yaml`:
  ```yaml
  name: win-switcher
  displayName: Window Switcher
  description: macOS 窗口切换器
  version: 0.1.0
  url: http://localhost:3003
  health: /api/health
  pm2Name: win-switcher
  widget:
    minW: 3
    minH: 5
    defaultW: 4
    defaultH: 7
  ```
- **THEN** 门户 SHALL 能解析该文件并提取所有字段包括 widget 块

#### Scenario: 缺少必填字段

- **WHEN** `tool.yaml` 缺少 `name` 或 `url` 字段
- **THEN** 门户 SHALL 拒绝注册并返回错误信息, 列出缺失的字段

#### Scenario: 缺少 widget 块

- **WHEN** `tool.yaml` 没有 `widget` 块
- **THEN** 门户 SHALL 使用默认 widget 约束: minW=3, minH=4, defaultW=4, defaultH=6
