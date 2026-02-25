## ADDED Requirements

### Requirement: Fetch og:image for URL
系统 SHALL 提供对给定 URL 抓取 og:image 的能力。后端服务端发起 HTTP GET 请求，解析响应 HTML 中的 `<meta property="og:image">` 标签获取图片 URL，然后将图片下载并保存为本地文件，返回本地可访问路径。

#### Scenario: 成功抓取 og:image
- **WHEN** 用户对含有效 og:image 的 URL 触发截图抓取
- **THEN** 系统下载 og:image 并保存到 `data/screenshots/{uuid}.{ext}`，返回 `/screenshots/{uuid}.{ext}` 路径

#### Scenario: 页面无 og:image
- **WHEN** 目标页面不存在 og:image meta 标签
- **THEN** 系统返回 `{ screenshotUrl: null, reason: "no_og_image" }`，前端展示上传引导

#### Scenario: 请求目标 URL 失败
- **WHEN** 服务端 fetch 目标 URL 超时或返回非 2xx
- **THEN** 系统返回 `{ screenshotUrl: null, reason: "fetch_failed" }`，前端展示上传引导

#### Scenario: og:image 下载失败
- **WHEN** og:image URL 本身无法下载
- **THEN** 系统返回 `{ screenshotUrl: null, reason: "image_download_failed" }`，前端展示上传引导

### Requirement: Serve screenshot files
系统 SHALL 将 `data/screenshots/` 目录通过 Fastify 静态文件中间件托管在 `/screenshots/*` 路径下。

#### Scenario: 访问已保存截图
- **WHEN** 客户端请求 `/screenshots/{filename}`
- **THEN** 服务器返回对应的图片文件，Content-Type 正确

#### Scenario: 访问不存在的截图
- **WHEN** 客户端请求不存在的截图路径
- **THEN** 服务器返回 404
