## MODIFIED Requirements

### Requirement: Dashboard 页面

门户 SHALL 提供 Web Dashboard 展示所有已注册工具。

#### Scenario: 桌面工作台展示

- **WHEN** 用户访问门户首页
- **THEN** 页面 SHALL 展示桌面式 widget 网格，而非工具卡片列表
- **THEN** 已配置的工具 SHALL 以可拖拽、可调整大小的 iframe 窗口形式嵌入展示

#### Scenario: 跳转到工具 UI

- **WHEN** 用户点击 widget 标题栏的最大化按钮
- **THEN** widget SHALL 全屏展开覆盖桌面区域
- **WHEN** 用户需要独立访问工具
- **THEN** 用户可通过 widget 标题栏的外链按钮在新标签页打开工具完整 UI

#### Scenario: 无工具注册时

- **WHEN** 注册表为空或桌面无已配置 widget
- **THEN** 页面 SHALL 展示空桌面状态，提供 "+ Add Widget" 按钮引导用户添加工具

#### Scenario: 定时轮询

- **WHEN** 桌面页面打开
- **THEN** 页面 SHALL 每 10 秒轮询 `/api/tools` 获取最新工具列表和状态
- **THEN** 每个 widget 标题栏的状态指示点 SHALL 无刷新更新
