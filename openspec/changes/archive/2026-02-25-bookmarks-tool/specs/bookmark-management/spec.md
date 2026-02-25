## ADDED Requirements

### Requirement: Create bookmark
用户 SHALL 能够创建书签，书签包含标题（必填）、URL（必填）、分组（可选）、缩略图（可选）字段。系统 SHALL 为每个书签生成唯一 UUID 作为 id，并记录创建时间和更新时间。

#### Scenario: 成功创建书签
- **WHEN** 用户提交包含有效标题和 URL 的创建请求
- **THEN** 系统返回新创建的书签对象（含 id、createdAt）

#### Scenario: 标题或 URL 为空时拒绝创建
- **WHEN** 用户提交缺少 title 或 url 的请求
- **THEN** 系统返回 400 错误，说明必填字段缺失

### Requirement: List bookmarks
系统 SHALL 提供获取所有书签的接口，按 sortOrder 升序、createdAt 升序排列。

#### Scenario: 获取书签列表
- **WHEN** 客户端请求书签列表
- **THEN** 系统返回书签数组，按排序字段升序排列

#### Scenario: 按分组筛选
- **WHEN** 客户端请求时传入 category 参数
- **THEN** 系统仅返回该分组下的书签

### Requirement: Update bookmark
用户 SHALL 能够修改已有书签的标题、URL、分组、缩略图、排序权重，部分更新（PATCH 语义）。

#### Scenario: 成功更新标题
- **WHEN** 用户提交有效的 PATCH 请求（只含 title 字段）
- **THEN** 系统更新 title 和 updatedAt，其余字段保持不变，返回更新后对象

#### Scenario: 更新不存在的书签
- **WHEN** 用户提交针对不存在 id 的更新请求
- **THEN** 系统返回 404 错误

### Requirement: Delete bookmark
用户 SHALL 能够删除书签，系统 SHALL 在删除数据库记录的同时删除对应的截图文件（若存在）。

#### Scenario: 成功删除书签
- **WHEN** 用户请求删除一个存在的书签
- **THEN** 系统删除数据库记录并返回 204，同时删除本地截图文件

#### Scenario: 删除不存在的书签
- **WHEN** 用户请求删除不存在的书签 id
- **THEN** 系统返回 404 错误

### Requirement: Batch reorder bookmarks
系统 SHALL 提供批量更新排序权重的接口，用于前端拖拽排序后同步。

#### Scenario: 成功重排
- **WHEN** 客户端提交包含 [{id, sortOrder}] 数组的重排请求
- **THEN** 系统批量更新对应书签的 sortOrder，返回 200

### Requirement: List categories
系统 SHALL 提供获取所有已使用分组值的接口（去重后的字符串数组）。

#### Scenario: 获取分组列表
- **WHEN** 客户端请求分组列表
- **THEN** 系统返回所有书签中 category 不为空的去重值数组
