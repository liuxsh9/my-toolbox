### Requirement: 工具注册 API

门户 SHALL 提供 REST API 供工具注册和注销。

#### Scenario: 工具注册

- **WHEN** 工具 POST `/api/tools/register` 携带有效 manifest JSON
- **THEN** 门户 SHALL 将工具信息存入 SQLite 注册表
- **THEN** 门户 SHALL 返回 201 状态码和注册确认

#### Scenario: 重复注册 (同名工具)

- **WHEN** 已注册的工具再次 POST `/api/tools/register`
- **THEN** 门户 SHALL 更新该工具的注册信息 (而非拒绝)
- **THEN** 门户 SHALL 返回 200 状态码

#### Scenario: 工具注销

- **WHEN** 工具 DELETE `/api/tools/:name`
- **THEN** 门户 SHALL 从注册表中移除该工具

### Requirement: 心跳检测

门户 SHALL 通过心跳机制检测工具存活状态。

#### Scenario: 工具发送心跳

- **WHEN** 工具 PUT `/api/tools/:name/heartbeat`
- **THEN** 门户 SHALL 更新该工具的 `lastHeartbeat` 时间戳

#### Scenario: 心跳超时

- **WHEN** 工具超过 90 秒未发送心跳
- **THEN** 门户 SHALL 将该工具状态标记为 `unreachable`

#### Scenario: 工具恢复心跳

- **WHEN** 之前 `unreachable` 的工具重新发送心跳
- **THEN** 门户 SHALL 将其状态恢复为 `running`

### Requirement: 工具列表查询

门户 SHALL 提供 API 查询所有已注册工具。

#### Scenario: 获取所有工具

- **WHEN** 客户端 GET `/api/tools`
- **THEN** 门户 SHALL 返回所有已注册工具的列表, 包含: name, displayName, description, version, url, status, lastHeartbeat

#### Scenario: 获取单个工具详情

- **WHEN** 客户端 GET `/api/tools/:name`
- **THEN** 门户 SHALL 返回该工具的完整信息, 包含 PM2 状态 (如果配置了 pm2Name)

### Requirement: Monorepo 内部工具发现

门户 SHALL 能自动发现 monorepo 内的工具。

#### Scenario: 扫描 packages 目录

- **WHEN** 门户启动时
- **THEN** 门户 SHALL 扫描 `packages/*/tool.yaml`
- **THEN** 对每个找到的 manifest, 自动注册到注册表 (标记来源为 `local`)

### Requirement: PM2 状态集成

门户 SHALL 能查询工具对应的 PM2 进程状态。

#### Scenario: 查询 PM2 进程状态

- **WHEN** 工具 manifest 中声明了 `pm2Name` 字段
- **THEN** 门户 SHALL 通过 PM2 API 查询该进程的 status, cpu, memory, uptime
- **THEN** 门户 SHALL 将 PM2 状态合并到工具信息中返回

#### Scenario: PM2 进程不存在

- **WHEN** manifest 中声明的 `pm2Name` 在 PM2 进程列表中不存在
- **THEN** 门户 SHALL 将工具的 pm2Status 标记为 `not_found`

### Requirement: 健康检查

门户 SHALL 定期检查已注册工具的健康状态。

#### Scenario: 主动健康检查

- **WHEN** 门户定时 (每 60 秒) 对已注册工具执行健康检查
- **THEN** 门户 SHALL GET 工具的 `url + health` 端点
- **THEN** 返回 200 状态码则标记为 `healthy`, 否则标记为 `unhealthy`
