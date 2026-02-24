### Requirement: Dashboard 页面

门户 SHALL 提供 Web Dashboard 展示所有已注册工具。

#### Scenario: 工具卡片展示

- **WHEN** 用户访问门户首页
- **THEN** 页面 SHALL 展示所有已注册工具的卡片列表
- **THEN** 每张卡片 SHALL 包含: 工具名称, 描述, 访问地址, 运行状态指示器 (绿色=running, 红色=stopped/unreachable, 黄色=unhealthy)

#### Scenario: 跳转到工具 UI

- **WHEN** 用户点击工具卡片的"打开"按钮
- **THEN** 浏览器 SHALL 在新标签页中打开该工具的 `url` 地址

#### Scenario: 无工具注册时

- **WHEN** 注册表为空
- **THEN** 页面 SHALL 展示空状态提示, 引导用户如何注册工具

### Requirement: 实时状态刷新

Dashboard SHALL 定期刷新工具状态。

#### Scenario: 定时轮询

- **WHEN** Dashboard 页面打开
- **THEN** 页面 SHALL 每 10 秒轮询 `/api/tools` 获取最新工具列表和状态
- **THEN** 页面 SHALL 无刷新更新卡片状态

### Requirement: Portal 自身健康端点

门户 SHALL 暴露自身健康检查端点。

#### Scenario: 健康检查

- **WHEN** 客户端 GET `/api/health`
- **THEN** 门户 SHALL 返回 200 和 `{ "status": "ok" }`
