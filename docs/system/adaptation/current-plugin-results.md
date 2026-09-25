# 2026-09-23 当前插件适配结果

主题 `2.2.40` 已升级前端/构建依赖，并将最低 Halo 要求提高到 `>=2.26.0`；本页以下仍是 **2.2.39 的历史快照**。调整后的代码已在 Halo Pro 2.26.1 上临时激活并完成 114 URL、14 路由真实浏览器及 33 项插件读取复测；结果和仍未覆盖的流程见 [依赖适配记录](../development/dependency-upgrade-2026-09-24.md#2026-09-25-发布前复核)。这些新结果不倒填到下方历史逐插件表，也不证明插件全部业务流程通过。

本表对应本地 `http://localhost:8090`、Halo Pro **2.26.1**、主题 **2.2.39 未提交工作区**。当前实装 **45 项**（44 STARTED、1 DISABLED）。前次全路由源码指纹为 `74d214a02ea557cf5ead5432ba642a9c9fbd53c2a4fc49e108ef1cfc7baa9caf`；该指纹完成构建、静态插件/SEO 契约以及恢复配置下的 **114 路由 HTTP 和真实浏览器导航**。33 项插件 HTTP/API 深度检查仍对应旧指纹 `3f6b2bafddea31f8927df278a00223eda67a766d8c12fa8f4507e2979050f6fc`，不倒填。中间指纹 `bd7460b...` 的 SEO 互斥配置先通过 15 URL 定向验收，扩展至 114 路由时发现两条独立插件页丢失 canonical，随后设置文案已收紧；该临时组合未用于当前站点。浏览器早一轮首次打开 `/bangumis` 时后端曾真实返回 500、重试成功；后续窗口未复现 500，不能据此宣称插件超时缺陷已修复。官方稳定版本以[当天市场复核](./evidence/2026-09-23/version-refresh.json)为准，逐项发布日期、最低 Halo、官方发布链接和技能基线见[详细版本表](./main-halo-runtime-audit.md#逐插件版本核对)；AI Assistant 当天升至 3.1.0，另见[3.1.0 补充核对](./main-halo-runtime-audit.md#2026-09-23-官方版本复核及补充验收)。Bangumi 以[官方 GitHub 1.4.1](https://github.com/Roozenlz/plugin-bilibili-bangumi/releases/tag/1.4.1)为准；Data Studio 只有预发布。实装版本、稳定目标、技能基线、项目目标、测试组合是不同字段，不相互代替。

2026-09-23 后续主题修复后的**此前源码指纹**为 `7521524cd039f3fbc8a2949a37b0805c00c5c175d029b594de32c689443f6bbd`。本轮修复侧栏天气无效值显示 `NaN`，并使插件烟测能识别旧匿名 HTML；Node 24.19.0 下构建与 27 项静态契约通过。[旧缓存负例](./evidence/2026-09-23/cache-guard-before-refresh.json)在前一中间指纹下拦下 `/links`、`/equipments`，[该指纹刷新后烟测](./evidence/2026-09-23/cache-guard-weather-after-refresh.json)为 12/12；[天气真实浏览器与后端记录](./evidence/2026-09-23/cache-weather-fix.json)覆盖正常与断网降级、原 URL 缓存时间、静态 JS 字节和日志。较早的[已登录浏览器 10 路由](./evidence/2026-09-23/cache-fresh-browser.json)与[隔离匿名主机 8 路由](./evidence/2026-09-23/cache-fresh-browser-anonymous.json)均为 `5990238...` 指纹，不冒充当前 114 路由复验。SEO、Passkey、追番超时和装备分页仍按下表保留问题状态。

「已验证」只指表中列出的本地读/显示/交互表面，不能推导插件全部后台业务已经验收。前次 `74d214a...` 指纹完成[114 路由 HTTP/SSR](./evidence/2026-09-23/route-http-post-warning.json)（113 个 200、预期 `/terms` 404）、[114 路由真实浏览器导航](./evidence/2026-09-23/browser-routes-post-warning.json)和[同窗口 Halo 日志计数](./evidence/2026-09-23/backend-log-post-warning.json)：无模板异常或 500，6 条警告均为已定位的装备分页值。中间指纹的[后端跟踪](./evidence/2026-09-23/backend-followup-latest-code.json)记录追番 500 与装备分页源码，[Passkey 专用账号验收](./evidence/2026-09-23/passkey-permission-latest-code.json)记录 403 及清理，[SEO 临时全路由结果](./evidence/2026-09-23/seo-full-http-temporary.json)记录两条独立插件页回归。更早指纹的[非法分页/热力图/首页瞬间定向复测](./evidence/2026-09-23/browser-followup-current.json)、[390px 移动宽度复测](./evidence/2026-09-23/browser-mobile-current.json)、[分类 6 篇/页的 17 次浏览器检查](./evidence/2026-09-23/issue40-six-browser.json)及[其他关键交互](./evidence/2026-09-23/browser-interactions-final.json)各保留原始指纹。专用表单、投票、摘要等写入和恢复见[此前精确组合记录](./evidence/2026-09-23/followup-runtime.json)，后续 AI/Passkey 浏览器与 SEO/缓存定位见[专项证据](./evidence/2026-09-23/seo-cache-ai-followup.json)，均不倒填为当前代码的完整交互验收。逐功能评分、缺陷原因、修复方法和真浏览器步骤见[功能/路由审查](./feature-route-audit-2026-09-23.md)。

`74d214a...` 指纹在 2026-09-23 继续做了[不修改插件的定向复测](./evidence/2026-09-23/no-plugin-source-verification.json)：分类/标签 canonical 错误和装备每次缓存未命中请求的 3 条分页警告再次出现；追番本轮 200，不能证明此前 TLS 超时已根治。Passkey 通过一次性、邮箱测试状态已验证的 `post-contributor` 账号在真实用户中心重现“加载失败”；早先“仅 guest 账号失败”的证据范围因此扩大。直接给该测试账号绑定插件角色并立即刷新仍失败，但当时尚未确认权限聚合生效时点，不能据该轮结果直接定为角色配置。账号与绑定均已清理；未改插件、正式角色或 SEO 站点设置。

本轮自动验收对应**当前主题源码指纹** `1bcb1efbf229e49c7a74d1f70934fd91dca0747640ad347fff00077fc9e834d0`、Halo Pro 2.26.1、SEO Tools 1.10.1、Passkey 1.0.4、Bangumi 1.4.1、Equipment 1.1.1、Page Cache 1.6.0。获授权刷新本地 Page Cache 后，以原 URL 的 `Accept: text/html` 和 `X-Halo-Cache-At` 守卫执行[只读自动回归](./evidence/2026-09-23/runtime-issues-automated.json)：13 通过、5 失败、2 未测；失败为分类/标签各两条 canonical 和装备新请求的 3 条页大小警告。另以站点现有 Altcha 流程完成[一次性普通账号认证探针](./evidence/2026-09-23/passkey-disposable-automated.json)：密码登录及当前用户接口成功，但凭据 GET 为 403；插件角色已声明聚合，显式绑定后等待约 31 秒并重新登录，有效权限仍不含凭据读取规则，GET 仍为 403。测试账号及两条绑定已删除，未修改正式角色、插件或认证策略。Bangumi 正常请求通过，不等于 TLS 故障降级通过；WebAuthn 注册/登录/删除未测。[真实浏览器定向记录](./evidence/2026-09-23/runtime-issues-browser.json)对应较早 QA 脚本指纹，显示相同页面问题；本轮没有重新执行完整浏览器交互。

## 已运行验证的主题表面（24 项，含已知缺陷）

| 插件 | 稳定目标 / 依据 | 实际修改或保留的契约 | 当前验证 | 剩余问题 |
| --- | --- | --- | --- | --- |
| `PluginLinks` | 2.3.0 / 市场 | 统一 `/links` 与 `?view=friends`，更新公开 API、申请入口及 Finder；修复旧字段作用域 | 列表、分组、RSS、移动视图、PJAX 与 API | 正式申请/审核写入未做；部分外部 RSS 源抓取失败 |
| `PluginPhotos` | 2.1.2 / 市场 | 保留照片 VO、详情与灯箱桥接 | 列表、详情、灯箱、PJAX | 未穷举 EXIF 与上传 |
| `PluginMoments` | 1.19.0 / 市场 | 对齐 releaseTime、媒体和作者降级；首页改用官方 `content.html` 并限制 Finder 为 3 条 | 列表、详情、RSS、PJAX、首页真实 HTML 样本 | 发布/上传/删除未做 |
| `seo-tools` | 1.10.1 / [官方发布](https://www.halo.run/store/apps/app-FNGbT/releases/app-release-zemd61lg) | 统一 Head；默认关闭的主题页面 canonical 实验开关已加明确适用范围提示 | 互斥配置下 15 URL 定向及 114 路由 HTTP/浏览器抽查；主题页单 canonical，恢复配置与清缓存已核对 | **不能全站启用该组合**：独立插件页 `/dishes`、`/schedule-calendar` 会从 1 条 canonical 变为 0；当前站点已恢复插件开关，分类/标签错误仍在，需插件侧修正参数处理 |
| `PluginFeed` | 1.5.0 / 市场 | 保留 RSS 自动发现 | `/feed.xml` 与 Head 读取 | 外部订阅器未测 |
| `plugin-docsme` | 1.10.0 / 市场 | 对齐目录、正文及 DocTree 评论主体 | 目录、详情、PJAX | 许可证/未授权模式未制造状态 |
| `plugin-bilibili-bangumi` | 1.4.1 / GitHub | 保留 Finder、分页和参数降级 | 列表、边界、PJAX；当前指纹 `/bangumis` 首次 500 后重试 200 | 插件向 Bilibili 发起请求时 TLS 握手超时；插件路由未降级而返回 500，主题模板无法拦截 |
| `steam` | 1.0.0 / 市场 | 保留 VO、空封面与下架分支 | 页面、公开 API、PJAX | 上游断网分支未模拟 |
| `equipment` | 1.1.1 / 市场 | 保留分组、封面、链接字段 | 页面、分组 SSR、PJAX；当前指纹页面 200 | 插件 `groupBy()` 以 `size=2147483647` 查询，单次 `/equipments` 触发 3 条 Halo 页大小警告；本地少量数据未见截断，后台编辑未做 |
| `plugin-douban` | 1.2.6 / 市场 | 新增扁平 DTO 归一化，兼容旧格式及筛选历史 | 8 条内容、类型/题材 API、移动端、PJAX | 同步/迁移未做 |
| `PluginSearchWidget` | 1.7.1 / 市场 | 保留官方搜索入口和主题配色 | 查询、空结果、键盘选择、关闭 | 索引完整性由插件负责 |
| `PluginCommentWidget` | 3.3.2 / 市场 | 按实装资源版本加载，保留 subject 与单实例宿主 | 资源、懒挂载、列表读取 | 发布、审核、上传、验证码未做 |
| `shiki` | 1.5.1 / 市场 | 修复原生 `pre code` 换行，保持高亮宿主 | 27 个原生代码块白空格规则、26 个高亮块、PJAX/明暗 | 所有语言未穷举 |
| `PluginLightGallery` | 1.2.1 / 市场 | 保留初始化、销毁及 `data-src` | 真实图片打开、PJAX | 其他媒体格式未穷举 |
| `online` | 1.0.5 / 市场 | 保留统计 API 与离页请求取消 | 页面、summary API | 多用户/WebSocket 故障未测 |
| `vote` | 1.1.3 / 市场 | 保留投票块布局与公开变量 | 专用单选、多选、PK 提交与后台记录 | 重复限制、结束态、移动弹窗未测 |
| `text-diagram` | 1.5.2 / 市场 | 补渲染队列与明暗重绘 | 专用文章 Mermaid SVG 与 PJAX 返回 | PlantUML 与暗色重绘未测 |
| `PluginContactForm` | 1.6.4 / 市场 | 修复 PJAX 离页悬浮 Loader 残留，保留 3 类宿主变量 | 必填校验、内嵌提交生成 1 条 Entry、离页/返回 | 上传、贴边、弹窗、移动端未测 |
| `editor-hyperlink-card` | 1.9.2 / 市场 | 保留行内/块级卡片布局和资源生命周期 | 真实正文 4 类卡片与安全外链属性 | 暗色、移动与点击交互未测 |
| `plugin-katex` | 3.0.0 / 市场 | 保留公式样式与 PJAX 补渲染 | 专用文章 2 处公式首次/返回渲染 | 编辑器 3.0 新预渲染样本未测 |
| `restricted-reading` | 1.9.1 / 市场 | 保留解锁组件、登录/评论主体 | 匿名正文不泄漏，专用账号登录后正文可读 | 答题、评论、支付未测 |
| `dishes` | 1.0.3 / 市场 | 独立 SPA 整页导航，不交主题 PJAX | 页面与导航；原配置下插件 canonical 1 条 | 临时关闭 SEO Tools 全局 canonical 后此独立页为 0 条；后台点餐/导入未做 |
| `schedule-calendar` | 3.5.0 / 市场 | 独立日历整页导航，读取 summary | 页面、摘要与导航；原配置下插件 canonical 1 条 | 临时关闭 SEO Tools 全局 canonical 后此独立页为 0 条；自定义路由及写入未做 |
| `maintenance` | 1.1.0 / 市场 | 保留独立模板及 title/description | 本地临时开关产生 302，独立页 200，配置已恢复 | 绝对站点域名跳转的浏览器端到端未测 |

## 代码适配完成，运行验证待完成（2 项）

| 插件 | 稳定目标 / 依据 | 实际修改或保留的契约 | 当前验证 | 剩余问题 |
| --- | --- | --- | --- | --- |
| `ai-assistant` | 3.1.0 / 市场 | 3.1 发行包摘要资源与 3.0 完全相同，主题保留摘要宿主/变量 | Halo + Foundation 1.1.0 + Assistant 3.1.0 启动、Flash 摘要读回；浏览器临时组件明暗/390px/PJAX 清理通过 | 自动摘要关闭；服务端自动注入与编辑器 Agent 未验；组件测试对应 SEO 改动前指纹 |
| `auth-passkey` | 1.0.4 / 市场 | 保留 `.halo-form`、认证片段及登录入口；本轮补自动认证/权限探针 | 登录方法页可见；一次性 `post-contributor` 账号通过 Altcha 和密码登录，当前用户 200，但凭据 GET 403；显式绑定插件角色、等待约 31 秒并重新登录后仍 403 | 有效权限不含插件声明的凭据读取规则，需定位 Halo/站点角色聚合或插件授权链；账号/绑定已清理，WebAuthn 注册、登录、删除待验 |

## 与主题无专属契约（17 项）

| 插件 | 稳定目标 / 依据 | 实际修改或保留的契约 | 当前验证 | 剩余问题 |
| --- | --- | --- | --- | --- |
| `mcp-server` | 1.2.0 / 市场 | 无主题代码 | 已安装并启动；后台 MCP 能力 | 未创建密钥或调用工具 |
| `ai-foundation` | 1.1.0 / 市场 | 无前台模板；作为 Assistant 依赖 | 已安装启动；Flash 模型由用户配置并手测，摘要记录已读回 | 模型/RAG 后台生命周期非主题范围 |
| `PluginLive2d` | 2.2.0 / 市场 | 无主题代码 | 本地 DISABLED | 浮层显示与移动端未测；不为覆盖列表启用 |
| `editor-emoji` | 1.1.0 / 市场 | 无主题代码 | 已安装启动 | 后台编辑器能力未测 |
| `PluginS3ObjectStorage` | 1.17.0 / 市场 | 无主题代码 | 已安装启动 | 附件写入/迁移未测 |
| `PluginBytemd` | 1.9.0 / 市场 | 正文沿 Halo 输出 | 已安装启动 | 编辑器粘贴/拖拽未测 |
| `hybrid-edit-block` | 1.7.0 / 市场 | 正文沿 Halo 输出 | 已安装启动 | 后台 ESM/编辑行为未测 |
| `chenhe-lsky-pro` | 1.1.2 / 市场 | 无主题代码 | 已安装启动 | 附件写入未测 |
| `page-cache` | 1.6.0 / [官方发布](https://www.halo.run/store/apps/app-BaamQ/releases/app-release-dgt4lgbd) | 主题资源采用版本化 URL；开发文档规定 Reload 后清页面缓存 | 已定位 `Accept: text/html` 与完整 URL 缓存键；最初 15 URL 验收共清三次，后续扩展测试和设置 Reload 也各自刷新并核对原 URL | 正式发布需再次刷新同 URL 及代理/CDN 缓存并以浏览器复验 |
| `content-tools` | 1.8.0 / 市场 | 保留正文容器 | 已安装启动 | 后台转换未测 |
| `backup-improved` | 1.5.1 / 市场 | 无主题代码 | 已安装启动 | 备份/通知任务未测 |
| `plugin-ldap-login` | 1.3.0 / 市场 | 保留 Halo 登录扩展宿主 | 已安装启动 | LDAP 同步未测 |
| `plugin-oauth2` | 1.7.1 / 市场 | 保留 Halo 登录扩展宿主 | 已安装启动 | SSO 授权流程未测 |
| `plugin-social-login` | 1.7.0 / 市场 | 保留 Halo 登录扩展宿主 | 已安装启动 | 第三方登录未测 |
| `PluginSitemap` | 1.3.0 / 市场 | 无主题专属代码 | `/sitemap.xml` 为 200 | 生成调度与全量 URL 未复核 |
| `app-store-integration` | 1.19.0 / 市场 | 无主题代码 | 已安装启动 | 授权与升级属于 Console 范围 |
| `alist-integration` | 1.2.0 / 市场 | 无主题专属代码；不作为主题瞬间发布后端 | 仅记录实装版本及曾观察到的附件同步日志 | 用户确认 AList 不属于本项目问题；不安排修复或验收 |

## 受阻（2 项）

| 插件 | 稳定目标 / 依据 | 实际修改或保留的契约 | 当前验证 | 剩余问题 |
| --- | --- | --- | --- | --- |
| `lottery` | 1.0.2 / 市场 | 保留正文卡片宿主 | 专用无奖品活动卡片可渲染；设置已恢复 | 当前 Redis `effectiveSource=NONE` 且未验证连接，参与/开奖无法完成 |
| `data-studio` | 无稳定版；实装 1.0.0-alpha.9 / 市场预发布 | 无主题前台契约 | 仅记录预发布，不冒称稳定适配 | 等官方稳定版；不为覆盖目标额外安装 |

`plugin-friends` 与 `link-submit` 已不在当前安装清单。用户确认 Friends 功能由 Links 2.3.0 的友链动态承接；旧 `/friends` 返回 404 是退役后的预期路由，不列为当前待适配插件。历史 47 项版本/测试表仅代表当时快照。
