## ADDED Requirements

### Requirement: Upload screenshot via file
用户 SHALL 能够通过文件上传（multipart/form-data）为书签上传缩略图，系统保存文件并返回可访问的本地路径，同时更新书签记录的 screenshot 字段。

#### Scenario: 成功上传图片文件
- **WHEN** 用户通过文件选择器选择图片并提交上传
- **THEN** 系统保存文件为 `data/screenshots/{uuid}.{ext}`，返回 `{ screenshotUrl: "/screenshots/{uuid}.{ext}" }`，并更新书签 screenshot 字段

#### Scenario: 上传非图片文件
- **WHEN** 用户上传非图片类型文件（非 image/\*）
- **THEN** 系统返回 400 错误，拒绝保存

### Requirement: Upload screenshot via clipboard paste
前端 SHALL 监听 `paste` 事件，当用户粘贴包含图片的剪贴板内容时，自动触发图片上传流程，效果与文件上传相同。

#### Scenario: 粘贴剪贴板图片
- **WHEN** 用户在书签编辑界面按下 Ctrl+V / Cmd+V 粘贴图片
- **THEN** 前端捕获 paste 事件中的 image/* blob，调用上传接口，成功后更新缩略图预览

#### Scenario: 粘贴非图片内容
- **WHEN** 用户粘贴文本或无图片的剪贴板内容
- **THEN** 前端忽略该事件，不触发上传

### Requirement: Replace existing screenshot
用户 SHALL 能够通过重新上传（文件或粘贴板）替换书签已有的缩略图，系统 SHALL 删除旧截图文件后保存新文件。

#### Scenario: 替换旧截图
- **WHEN** 书签已有 screenshot 字段，用户上传新图片
- **THEN** 系统删除旧截图文件，保存新文件，更新书签 screenshot 字段
