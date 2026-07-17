# 主 Halo 插件运行态审计

> 快照日期：2026-07-17（含 `2.2.34` 本轮热加载复验）
> 目标实例：本地容器 `halo`，Halo Pro `2.25.4`，`http://localhost:8090`
> 当前渲染主题：`theme-sky-blog-1 2.2.34`（live mount + Theme Reload API）

本报告初始审计基于 `2.2.23`，当前结论已合并 `2.2.34` Build、Reload 和页面缓存刷新后的验证。它只记录该实例在快照时刻的安装状态和真实页面证据，不替代[插件适配矩阵](./plugin-adaptation.md)中的主题契约。`通过` 只表示列出的表面已通过，未执行提交、登录、上传、评论等会修改数据的操作。

## 结论

- 主容器 `halo` 正在运行，镜像为 Halo Pro `2.25.4`，主端口为 `8090`；本文所有运行态结论均来自该实例，不使用 `8091` 的备用 Halo。
- 主题 `2.2.34` 已完成 Build，Theme Reload API 返回 200，随后页面缓存刷新接口返回 200；热开发使用 live mount，同一版本内无需重新安装主题。
- 主实例共安装 45 个插件：27 个能匹配主题显式契约，另有 18 个处于矩阵外。矩阵外不等于不兼容，也绝不能自动标记为兼容。
- 核心插件页面、Dishes 与 Schedule Calendar 独立路由均通过；`/friends` 已随 PluginLinks 降级至 2.0.0 恢复。
- 基础页面检查通过 `12/12`，深度页面/API 检查通过 `36/36`；这仍只代表脚本覆盖的读取型页面、标记和 API，不等于全部插件业务流程兼容。
- 真实浏览器已覆盖首页、瞬间、Links 申请弹窗、图库灯箱、Docsme、Steam、朋友圈、文章、作者页及未配置菜单入口的 Bangumi、Equipment、Douban 路由；返回、前进、重复进入、明暗切换与移动端抽屉均通过。Dishes 与 Schedule Calendar 的独立应用路由会整页加载，不纳入 PJAX 容器替换。
- 快速连续点击实测产生 `visit:start=2`、`visit:abort=1`、`page:view=1`、`visit:end=1`，最终页面、资源实例与 body 状态均收敛；桌面二级菜单、移动端抽屉和子菜单离页状态已修复。
- PJAX 首次进入需要新 Head 资源的文章时，会重放尚未执行的外部脚本并按 URL/版本去重；这修复了 AI 摘要小部件只在硬刷新后生效的问题。
- 验证中发现首页条件类被格式化器破坏，导致 Thymeleaf 在已提交 200 后中断流式响应；现已恢复表达式、加入 `prettier-ignore` 与静态门禁，完整 HTTP 响应和首页 3 个深度检查均恢复。
- `plugin-bilibili-bangumi 1.4.1` 已完成深度边界检查：数值越界返回 404，无法解析的文本参数按插件降级规则回落；真页筛选、PJAX 进入及浏览器前进/后退均通过。
- 原有照片详情与真实内容/主题模板标记继续通过，Friends 不再是失败项；Vote、Text Diagram、Shiki、Hyperlink Card、Lottery 和 Maintenance 仍命中预期标记。
- `PluginLinks 2.0.0`、`plugin-friends 1.4.6`、`link-submit 1.0.7` 当前均为 `STARTED`。已复现的 `ObjectMapper` 类加载冲突只出现在 PluginLinks 2.1.0～2.2.1 与后两者的组合中，不能再归因为 Friends 或 Link Submit 单独不兼容 Halo 2.25.4。
- Links 申请入口会按需加载 link-submit 1.0.7 官方 JS/CSS，兼容资源未预注入、资源加载失败/未完成和 PJAX 重入；首次打开与 PJAX 二次打开均成功，资源和 Modal 无重复，离页自动关闭，控制台无错误。加载失败时按申请 URL、评论、邮箱顺序降级。
- `PluginMoments 1.16.1` 与 `online 1.0.5` 当前均为 `STARTED`；Moments 发布面板在不提交数据的前提下完成表情选择器快速开关、100ms 延迟监听清理及 PJAX 往返复验，资源和实例无重复。启动和读取型 smoke 通过仍不替代发布、上传或其它写入流程验证。
- Vote、Shiki、Text Diagram 和 Hyperlink Card 已在 `2.2.34` 真实浏览器中渲染；Shiki 1.4.1 的真实样本包含 26 个代码块，已通过两轮 PJAX 归一化、折叠及明暗切换，Text Diagram 与 Hyperlink Card 的既有回归继续通过。
- SearchWidget、CommentWidget、LightGallery 与 Passkey 均完成无写入浏览器交互：LightGallery 1.2.1 已覆盖文章、Moments 单图/多图及 PJAX 返回单实例，搜索、评论和 Passkey 的既有回归继续通过；没有提交评论或完成凭据认证。
- 主题页进入未知 404 时会在容器替换前退出 PJAX 并整页加载；浏览器返回一次后已验证能恢复真实主题文档、`#swup` 和 Swup 运行时，控制台无 `Container mismatch`。
- 主题 Reload 不会清除 `page-cache 1.5.0` 已生成的匿名 HTML；本次曾因此让浏览器短暂看到 Reload 前模板。调用插件官方“刷新页面缓存”接口返回 200 后，两页普通浏览器文档和 DOM 均收敛到新模板，后续热开发验收必须把 Reload 与页面缓存刷新分开处理。
- 18 个矩阵外插件中，1 个仍有启用前主题决策，2 个需要通用正文回归，15 个属于认证、编辑器、存储、备份、SEO 或运行平台能力。它们不要求全部建立专属主题契约，但仍不能据安装或启动状态宣称“全员兼容”。
- Contact Form 1.6.4 已覆盖 21 个主题变量、3 类宿主和官方 Loader 资源，但当前站点没有真实表单节点，UI、校验、上传和提交仍未验证。AI Assistant 2.2.4 已通过已有摘要小部件、首次 PJAX 脚本注入、明暗、390px 移动端及前进/后退回归；测试使用无可用模型凭据的临时配置并精确恢复，未调用模型，也不代表 RAG、编辑器 AI 或模型生成流程通过。
- 严格版本门禁 `pnpm verify:plugin-versions -- --strict` 已通过，27 个主题契约插件均处于 `STARTED` 且没有高于未测试版本的缺口；这仍不替代上文列出的业务流程验收。
- 开发者模式开启后，真实首页到瞬间的 PJAX 导航产生 23 条 `[SkyDebug:*]` 生命周期日志；精确恢复配置、清缓存并硬刷新后，同一路径为 0 条，证明关闭模式不会输出主题诊断日志。

## 27 个主题契约插件快照

| 插件                      | 安装版本与状态   | 运行态证据                                                                            | 本次结论                                                                                                |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `PluginLinks`             | `2.0.0`，已启动  | `/links` 全部分组与指定分组、前进/后退、申请弹窗及首页友链均通过                      | 矩阵记录 `contractVersion=testedVersion=2.0.0`；2.1.0～2.2.1 与 Friends/Link Submit 存在类加载冲突      |
| `PluginPhotos`            | `2.1.2`，已启动  | 列表、详情、返回、PJAX 与 20→40→46 张无限滚动灯箱通过；46 个详情路由唯一              | 图库主题表面已完成回归，矩阵记录 `testedVersion=2.1.2`；未执行内容写入                                  |
| `PluginMoments`           | `1.16.1`，已启动 | 媒体灯箱、发布面板、200 个表情快速开关与 PJAX 清理通过；作者 Finder 已按版本门控      | 当前安装版本满足契约；未实际发布或上传内容                                                              |
| `plugin-friends`          | `1.4.6`，已启动  | `/friends` 路由与预期页面标记通过                                                     | 与 PluginLinks 2.0.0 组合可用；升级 Links 前必须重测类加载兼容性                                        |
| `plugin-docsme`           | `1.7.0`，已启动  | `/docs`、目录和正文样本通过                                                           | 核心页面通过；评论提交未执行                                                                            |
| `plugin-bilibili-bangumi` | `1.4.1`，已启动  | 36/36 深度检查覆盖数值越界与文本降级；真页筛选、PJAX 及前进/后退通过                  | 1.4.1 兼容测试通过；实现契约继续保持 1.4.0                                                              |
| `halo-plugin-steam`       | `1.0.0`，已启动  | PJAX 进入后 Alpine 状态和背景在 extras 内初始化，浅色透明度生效，离开后无残留         | 页面通过；隐私、下架和外链组合未操作                                                                    |
| `plugin-equipment`        | `1.1.1`，已启动  | `/equipments` 为 200                                                                  | 页面通过                                                                                                |
| `plugin-douban`           | `1.2.5`，已启动  | URL 查询、筛选历史和后退恢复通过；条目/题材 API 均为 200，背景位于 extras             | 列表、公开 API 和查询状态契约通过                                                                       |
| `PluginSearchWidget`      | `1.7.1`，已启动  | 首页和 PJAX 返回后均可打开、Escape 关闭，搜索输入可访问                               | 无写入交互与 PJAX 重入通过                                                                              |
| `PluginCommentWidget`     | `3.1.2`，已启动  | 文章评论 Shadow DOM 懒加载，配置/列表/验证码接口均 200，PJAX 进入后仍可加载           | 展示与表单装配通过；未填写或提交评论                                                                    |
| `plugin-shiki`            | `1.4.1`，已启动  | 真实样本 26 个代码块，两轮 PJAX 均归一化为单个运行态；折叠、长行和明暗切换通过        | 矩阵记录 `testedVersion=1.4.1`；主题仍保留兼容 Halo 2.23/2.24 的 1.3.1 契约线                           |
| `PluginLightGallery`      | `1.2.1`，已启动  | 文章、Moments 单图/多图均可开关；PJAX 返回后保持单实例，Photos 动态列表既有回归通过   | 矩阵记录 `contractVersion=testedVersion=1.2.1`；后台规则覆盖 moments/photos/docs/archives/about/privacy |
| `auth-passkey`            | `1.0.4`，已启动  | 普通登录与 passkey 方法页入口可见；点击后认证 options 请求 200                        | 入口和挑战请求通过；未选择凭据或完成认证                                                                |
| `link-submit`             | `1.0.7`，已启动  | 官方 JS/CSS 按需加载；首次与 PJAX 二次打开 Modal 通过，无重复资源或控制台错误         | 官方组件和 PJAX 生命周期通过；失败降级有静态门禁，未做资源故障注入或真实提交                            |
| `online`                  | `1.0.5`，已启动  | Summary API 与启用态读取型 smoke 通过                                                 | 启用态读取表面通过；不代表插件全部统计场景均已验证                                                      |
| `vote`                    | `1.1.3`，已启动  | 样本页有 2 个 Shadow DOM 投票块，结束态和主题变量生效                                 | 展示通过；无可提交的进行中投票样本                                                                      |
| `text-diagram`            | `1.5.2`，已启动  | 真实节点已标记 processed 并生成 SVG；暗色切亮色可重绘；PJAX 进入后正常且无重复运行时  | 默认 `<text-diagram>` 契约通过；自定义 selector、PlantUML 和更多复杂图仍需单独样本                      |
| `PluginContactForm`       | `1.6.4`，已启动  | Loader 引用与资源 HTTP 200 已确认，没有表单节点或贴边入口                             | 1.6.4 的 21 个变量和 3 类宿主已适配；UI、校验、上传和提交仍未验证                                       |
| `ai-assistant`            | `2.2.4`，已启动  | 既有摘要小部件在首次 PJAX、明暗、390px、前进/后退中渲染；资源唯一且配置已精确恢复     | `testedVersion=2.2.4` 只覆盖摘要展示；未验证生成、RAG 或编辑器 AI                                       |
| `editor-hyperlink-card`   | `1.9.2`，已启动  | 真实样本含 3 个块级和 1 个行内卡片，均有 Shadow DOM，宿主 display 正确；PJAX 返回正常 | 1280/390 宽度、明暗模式、块级/行内布局及 PJAX 回归均通过                                                |
| `plugin-katex`            | `3.0.0`，已启动  | 资源和 `script[data-pjax]` 注入存在，没有真实公式节点                                 | PJAX 与溢出契约已落仓库；真实行内/块级公式仍未验证                                                      |
| `lottery`                 | `1.0.2`，已启动  | `/archives/ijhJxHtw` 有真实 `<lottery-card>`，客户端返回“活动不存在”                  | 组件运行时已执行；无有效活动，参与/验证码/开奖流程未验证                                                |
| `restricted-reading`      | `1.8.1`，已启动  | 全局资源注入，公开文章未发现真实 `<content-restrict-widget>`                          | 宿主及文章/单页评论依赖已落契约；各限制模式无内容样本                                                   |
| `dishes`                  | `1.0.3`，已启动  | `/dishes` 独立 SPA 可直达和返回；插件自身 `logo.png` 为 404                           | 路由/PJAX 边界通过；当前菜单无入口，插件静态资源缺口不由主题伪修复                                      |
| `schedule-calendar`       | `3.3.0`，已启动  | `/schedule-calendar` 独立页可直达和返回；插件页 `favicon.ico` 为 404                  | 路由/PJAX 边界通过；当前菜单无入口，是否展示由站点菜单配置决定                                          |
| `maintenance`             | `1.1.0`，已启动  | `/maintenance` 命中独立品牌模板、`title`/`description` 与返回首页入口                 | 无 PJAX 模板契约通过；未切换真实全站维护模式                                                            |

## 18 个矩阵外插件

版本检查脚本会列出全部“已安装但不在主题契约矩阵”的插件，避免把“27 个契约均匹配”误读成“所有已安装插件均兼容”。这些插件按真实前台表面分为三组。

### 需要前台主题决策或契约

| 插件                 | 安装状态 | 当前证据                                                         | 当前结论                                                             |
| -------------------- | -------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `PluginLive2d 2.1.0` | 已禁用   | 未注入运行时，主题仅有防止 fixed 元素被 transform 破坏的通用保护 | 禁用状态不能标记兼容；启用前需验收层级、移动端、PJAX、提示和 AI 聊天 |

### 只需通用正文回归

| 插件                      | 安装状态 | 当前证据                                                        | 当前结论                                                      |
| ------------------------- | -------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| `hybrid-edit-block 1.6.1` | 已启动   | 仅在编辑器输出 Markdown/HTML，无固定前台元素或路由              | 不建立专属版本契约；用标准正文元素、溢出和暗色回归覆盖        |
| `PluginBytemd 1.9.0`      | 已启动   | 页面注入 ByteMD Mermaid 主题样式；输出可包含 Mermaid 和数学公式 | 不建立独立主题页契约；需与 Text Diagram、KaTeX 做组合内容回归 |

### 运行平台或无需专属主题契约

| 插件                           | 分类                   | 当前证据                                                                                                     | 结论 / 门禁                                                                                                                                                             |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alist-integration 1.2.0`      | AList 附件存储         | 已启动；无可追溯上传与展示样本                                                                               | 不纳入主题契约；需验证 MIME、Range、CORS、中文文件名和大文件反代，不能据此认定 Moments 发布链兼容                                                                       |
| `app-store-integration 1.17.0` | Console 应用市场       | 已启动；无主题前台表面                                                                                       | 市场升级不得自动抬升主题 `contractVersion` 或 `testedVersion`                                                                                                           |
| `backup-improved 1.5.1`        | 备份与远端同步         | 已启动；未执行备份任务和恢复演练                                                                             | 门禁为任务成功、远端同步及独立环境恢复，不属于主题 HTML 验收                                                                                                            |
| `chenhe-lsky-pro 1.1.2`        | Lsky Pro 附件存储      | 已启动；无可追溯上传与展示样本                                                                               | 需验证转换后的 MIME、大小、公开 URL、CORS 和删除语义                                                                                                                    |
| `content-tools 1.7.0`          | 内容导入导出与转换     | 已启动；未执行写操作                                                                                         | 用典型 Markdown、Word、HTML 转换后的正文回归覆盖，不建立插件 DOM 契约                                                                                                   |
| `data-studio 1.0.0-alpha.9`    | Console 数据维护       | 已启动；未执行模型写入                                                                                       | 仍为 alpha 且可修改任意模型；只应在备份后的维护窗口操作                                                                                                                 |
| `editor-emoji 1.0.0`           | Console 编辑器扩展     | 已启动；最终输出普通文本/表情                                                                                | 无专属前台契约；保留通用字体 fallback 即可                                                                                                                              |
| `plugin-ldap-login 1.3.0`      | Halo AuthProvider      | 已启动；主题动态渲染 `formAuthProviders`，当前未配置 LDAP                                                    | 结构兼容；凭据、回调和真实登录必须单独验收                                                                                                                              |
| `plugin-oauth2 1.7.1`          | Halo AuthProvider      | 已启动；主题动态渲染 `socialAuthProviders`，当前未配置提供商                                                 | 结构兼容；真实 OAuth 回调未验收                                                                                                                                         |
| `plugin-social-login 1.7.0`    | Halo AuthProvider      | 已启动；复用通用社交登录片段，当前未配置提供商                                                               | 结构兼容；真实社交登录回调未验收                                                                                                                                        |
| `page-cache 1.5.0`             | 页面响应缓存           | 已启动；`alwaysCache=false`；匿名响应有 `X-Halo-Cache-At`；主题 Reload 后曾继续返回旧 Links/Maintenance HTML | 主题 Reload 不负责失效该插件缓存；官方 `DELETE /apis/console.api.cache.halo.run/v1alpha1/caches/page` 返回 200 后新模板生效，热开发验收应显式刷新页面缓存               |
| `PluginFeed 1.5.0`             | RSS 路由               | 已启动；`/feed.xml` 是有效 RSS 2.0，共 20 个 item；默认、`text/xml`、`application/rss+xml` 请求为 200        | `/atom.xml` 和显式 `Accept: application/xml` 为 404；无主题 DOM 契约，但存在内容协商缺口                                                                                |
| `PluginS3ObjectStorage 1.17.0` | S3 附件存储            | 已启动；无上传与展示样本                                                                                     | 需验证公开/私有桶 URL、MIME、Range、CORS、缓存头和解除关联语义                                                                                                          |
| `PluginSitemap 1.3.0`          | SEO 平台路由           | 已启动；默认请求的 `/sitemap.xml` 为有效 XML，共 90 个 `loc`；`robots.txt` 指向公开 Sitemap                  | 显式 `Accept: application/xml` 为 404；Sitemap 未收录 Links、Photos、Moments、Docs、Bangumi、Steam、Equipment、Douban、Dishes、Schedule 等插件页，属于明确 SEO 覆盖缺口 |
| `seo-tools 1.9.5`              | HeadProcessor SEO 输出 | 已启动；首页可见 OpenGraph、canonical、JSON-LD 等标签，未发现主题重复输出                                    | 无专属 DOM 契约；需对首页、文章、分类及插件页做重复与 canonical 回归                                                                                                    |

## 组合冲突与版本边界

### Friends

`plugin-friends 1.4.6` 的 Halo Store 页面已标记归档，当前没有 1.4.6 之后的正式版本。但主实例已确认它与 PluginLinks 2.0.0 可以同时启动并恢复 `/friends`；PluginLinks 2.1.0～2.2.1 才会在该组合中触发 `ObjectMapper` 类加载冲突。

- [Halo Store](https://www.halo.run/store/apps/app-yISsV)
- [官方 Issue #11](https://github.com/chengzhongxue/plugin-friends/issues/11)
- [官方 Issue #12](https://github.com/chengzhongxue/plugin-friends/issues/12)

### Link Submit

`link-submit 1.0.7` 与 PluginLinks 2.0.0 可以同时启动。PluginLinks 2.1.0～2.2.1 会在该组合中触发同类 `ObjectMapper` 类加载冲突；官方仓库已有相关修复 PR，但尚未合并或正式发布，附带测试 JAR 不能作为主题正式兼容基线。主题 2.2.34 已通过按需加载官方资源和运行时降级闭环前台申请入口。

- [Halo Store](https://www.halo.run/store/apps/app-glejqzwk)
- [官方 Issue #14](https://github.com/chengzhongxue/link-submit/issues/14)
- [官方 Issue #15](https://github.com/chengzhongxue/link-submit/issues/15)
- [修复 PR #16](https://github.com/chengzhongxue/link-submit/pull/16)

## 后续动作边界

以下写入型或缺样本动作仍未执行：

1. Moments 1.16.1 已启动；如需确认前端发布能力，仍要单独执行上传和发布写入链。
2. Online 1.0.5 已启动并通过读取型 smoke；异常统计、断线和 PJAX 重入仍按实际需求补测。
3. 当前组合固定使用 PluginLinks 2.0.0；在上游类加载冲突解决前，不将 2.1.0～2.2.1 标记为可安全升级。
4. 为 Contact Form 建立真实表单页面或贴边入口，再执行 UI、校验、上传与提交验收；当前不填写 `testedVersion`。
5. AI Assistant 2.2.4 仅将摘要小部件表面记为 `testedVersion`；模型生成、RAG 与编辑器 AI 仍需在具备安全测试配置时单独验收。
