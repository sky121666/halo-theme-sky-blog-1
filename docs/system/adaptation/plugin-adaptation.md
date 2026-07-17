# 插件适配状态

这份文档记录主题和 Halo 插件的适配边界、版本基线和本地验收方式。它不是安装教程，具体配置请看各功能文档。

## 适配原则

| 原则               | 说明                                                                |
| ------------------ | ------------------------------------------------------------------- |
| 优先使用插件路由   | 主题消费插件已经提供的页面模型、Finder、片段或公开 API              |
| 不重写插件后端     | 同步、抓取、管理、权限由插件负责                                    |
| 保持 PJAX 合约     | 参与主题 PJAX 的插件页必须有三个容器；完整独立 SPA 或维护页应硬跳转 |
| 页面脚本可重复进入 | PJAX 切换后要能重新初始化，离开时要能清理                           |
| 工具插件只做集成   | 搜索、评论、灯箱、代码高亮等不在主题里重造                          |
| 配置放插件后台     | 灯箱 selector、豆瓣图片代理、Steam API 等交给插件配置               |

## 当前适配矩阵

`contractVersion` 是主题实现所采用的插件契约；`testedVersion` 只在真实站点回归通过后填写。插件最新版和站点安装版本不写入本表。矩阵只覆盖主题主动消费或明确适配的插件，未列出的插件不能因为能通过 `halo:footer` 注入资源就自动视为兼容。

| Plugin                    | Surface                                                | Contract version | Tested version | Status              | Evidence                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------ | ---------------- | -------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PluginLinks`             | `/links`、首页友链、Friends 可选分组、友链申请         | `2.0.0`          | `2.0.0`        | `compatible-tested` | `templates/links.html`、`templates/modules/index/content.html`、`templates/modules/widgets/links.html`、`templates/modules/widgets/tabs_group.html`、`src/pages/links/links.js`                         |
| `PluginPhotos`            | `/photos`、无限滚动、照片详情和灯箱生命周期            | `2.1.1`          | `2.1.2`        | `compatible-tested` | `templates/photos.html`、`templates/photo.html`、`templates/modules/photos/content.html`、`src/pages/photos/photos.js`                                                                                   |
| `PluginMoments`           | 列表、详情、作者缺失降级、作者 Finder 门控、前端发布   | `1.16.1`         | -              | `inferred`          | `templates/moments.html`、`templates/moment.html`、`templates/modules/moments/`、`templates/modules/author/content.html`                                                                                 |
| `plugin-friends`          | `/friends`、首页动态和 PluginLinks 可选增强            | `1.4.6`          | -              | `confirmed`         | `templates/friends.html`、`templates/modules/friends/`、`templates/modules/widgets/tabs_group.html`                                                                                                      |
| `plugin-docsme`           | 项目、目录、正文、DocTree 评论                         | `1.7.0`          | -              | `inferred`          | `templates/docs.html`、`templates/doc.html`、`templates/modules/doc-content.html`                                                                                                                        |
| `plugin-bilibili-bangumi` | `/bangumis`、侧边栏卡片和 PJAX 背景                    | `1.4.0`          | `1.4.1`        | `compatible-tested` | `templates/bangumis.html`、`templates/modules/bangumi/content.html`、`templates/modules/widgets/bangumi-card.html`、`templates/modules/bangumi/layout.html`、`scripts/verify-plugin-pages.mjs`          |
| `halo-plugin-steam`       | `/steam`、侧边栏门控、空封面、下架状态和 PJAX 页面状态 | `1.0.0`          | -              | `inferred`          | `templates/steam.html`、`templates/modules/steam/content.html`、`templates/modules/steam/layout.html`、`templates/modules/widgets/sidebar.html`、`src/pages/steam/steam.js`、`src/pages/steam/steam.css` |
| `plugin-equipment`        | `/equipments`                                          | `1.1.1`          | -              | `confirmed`         | `templates/equipments.html`、`templates/modules/equipments/`                                                                                                                                             |
| `plugin-douban`           | `/douban`、URL/历史状态、类型和题材 API、PJAX 背景     | `1.2.5`          | -              | `confirmed`         | `templates/douban.html`、`templates/modules/douban/layout.html`、`src/pages/douban/douban.js`                                                                                                            |
| `PluginSearchWidget`      | 导航搜索入口                                           | `1.7.1`          | -              | `confirmed`         | `templates/modules/nav.html`                                                                                                                                                                             |
| `PluginCommentWidget`     | 文章、页面和插件页评论                                 | `3.1.2`          | -              | `confirmed`         | `templates/modules/post/article-footer.html`、`templates/modules/moments/`                                                                                                                               |
| `plugin-shiki`            | 文章和文档代码高亮；Halo 2.23/2.24 兼容线              | `1.3.1`          | `1.4.1`        | `compatible-tested` | `src/static/css/article-content.css`、`docs/system/adaptation/main-halo-runtime-audit.md`；1.4.x 要求 Halo 2.25+                                                                                         |
| `PluginLightGallery`      | 文章、图库、瞬间和文档灯箱及动态列表刷新               | `1.2.1`          | `1.2.1`        | `compatible-tested` | `src/common/main.js`、`src/pages/photos/photos.js`、`src/pages/moments/moments.js`、`templates/modules/photos/content.html`、本页 selector 配置                                                         |
| `auth-passkey`            | `/login` 认证入口                                      | `1.0.4`          | -              | `confirmed`         | `templates/login.html`、`templates/gateway_fragments/login.html`                                                                                                                                         |
| `link-submit`             | `/links` 官方申请组件、主题变量和不可用降级            | `1.0.7`          | -              | `confirmed`         | `templates/modules/links/content.html`、`src/common/css/base.css`                                                                                                                                        |
| `plugin-online`           | 在线统计侧边栏小工具和 PJAX 请求取消                   | `1.0.5`          | -              | `confirmed`         | `templates/modules/widgets/online-stats.html`、`src/common/js/alpine-modules.js`                                                                                                                         |
| `vote`                    | 正文投票块的 25 个主题变量                             | `1.1.3`          | -              | `confirmed`         | `src/static/css/article-content.css`                                                                                                                                                                     |
| `text-diagram`            | 默认 `<text-diagram>`、暗色和 PJAX 补渲染              | `1.5.2`          | -              | `confirmed`         | `templates/modules/theme-script.html`、`src/static/css/article-content.css`、`src/static/js/article-content.js`                                                                                          |
| `PluginContactForm`       | 内嵌、单页、贴边和弹窗联系表单的 21 个主题变量         | `1.6.4`          | -              | `confirmed`         | `src/common/css/base.css`、`templates/modules/theme-script.html`                                                                                                                                         |
| `ai-assistant`            | 文章顶部 AI 总结小部件                                 | `1.5.1`          | `2.2.4`        | `confirmed`         | `src/pages/post/post.css`、`src/common/main.js`                                                                                                                                                          |
| `editor-hyperlink-card`   | 正文块级/行内链接卡片宿主布局与 PJAX                   | `1.9.2`          | -              | `confirmed`         | `src/static/css/article-content.css`、`src/common/main.js`                                                                                                                                               |
| `plugin-katex`            | 行内/块级公式、横向溢出与 PJAX 重执行                  | `3.0.0`          | -              | `confirmed`         | `src/static/css/article-content.css`、`src/common/main.js`                                                                                                                                               |
| `lottery`                 | 正文抽奖卡片宿主布局                                   | `1.0.2`          | -              | `confirmed`         | `src/static/css/article-content.css`                                                                                                                                                                     |
| `restricted-reading`      | 受限阅读宿主、登录及文章/单页评论解锁依赖              | `1.8.1`          | -              | `confirmed`         | `src/static/css/article-content.css`、`templates/modules/post/article-footer.html`、`templates/modules/page/content.html`                                                                                |
| `dishes`                  | 独立 `/dishes` SPA 路由的 PJAX 绕过                    | `1.0.3`          | -              | `confirmed`         | `src/common/main.js`、`scripts/verify-plugin-pages.mjs`                                                                                                                                                  |
| `schedule-calendar`       | 独立 `/schedule-calendar` 的 PJAX 绕过                 | `3.3.0`          | -              | `confirmed`         | `src/common/main.js`、`scripts/verify-plugin-pages.mjs`                                                                                                                                                  |
| `maintenance`             | 独立维护页主题模板和返回入口                           | `1.1.0`          | -              | `confirmed`         | `templates/maintenance.html`                                                                                                                                                                             |

状态含义：`confirmed` 表示仓库实现契约已核对；`compatible-tested` 表示 `testedVersion` 已有真实站点测试记录，它可以等于或高于 `contractVersion`；`inferred` 表示源码已经采用新契约，但仍需在真实 Halo 站点补充运行态证据后才能填写 `testedVersion`。三种状态都不能替代当前目标站点的安装版本检查；只有非空 `testedVersion` 才代表该版本存在运行态测试记录。

`halo:footer`、`halo:captcha` 和通用 `pluginFinder.available(...)` 是 Halo 平台扩展点，不对应单一插件版本，因此不单列版本契约；实际提供这些扩展点的插件仍需独立回归。

主实例的 45 个安装插件、启动状态、页面结果、矩阵外分类和上游阻塞项记录在[主 Halo 插件运行态审计](./main-halo-runtime-audit.md)。当前 27 个插件有显式主题契约，18 个处于矩阵外。该报告是带日期的站点快照，不会自动抬升本矩阵的 `testedVersion`。版本脚本会同时打印矩阵外插件清单；矩阵外插件可能无需主题契约，也可能是尚未完成适配的缺口，必须按运行审计分类判断。

`2.2.33` 热加载后的页面、DOM、PJAX 与深度边界结果只记入运行态审计；当前深度 smoke 为 `36/36`。未覆盖完整契约或业务流程的插件仍不填写 `testedVersion`，因此 Contact Form 1.6.4 与 AI Assistant 2.2.4 仍不能据安装状态宣称兼容。

## 上游版本差距

上游源码或应用市场基线核对日期：2026-07-13。以下差距只用于安排回归，不会自动改写 `contractVersion` 或 `testedVersion`。

| 插件                      | 当前契约 | 当前上游/市场基线 | 当前处理                                                                 |
| ------------------------- | -------- | ----------------- | ------------------------------------------------------------------------ |
| `PluginLinks`             | `2.0.0`  | `2.2.1`           | 2.0.0 已完成分组、申请弹窗和 PJAX 回归并冻结；2.1.0～2.2.1 与 Friends/Link Submit 组合触发类加载冲突 |
| `PluginPhotos`            | `2.1.1`  | `2.1.2`           | 列表、详情、PJAX、20→40→46 张无限滚动灯箱和 46 个唯一详情路由均通过      |
| `plugin-bilibili-bangumi` | `1.4.0`  | `1.4.1`           | 稳定版 1.4.1 已通过 36/36 深度边界与真页 PJAX；实现契约继续保持 1.4.0     |
| `plugin-shiki`            | `1.3.1`  | `1.4.1`           | 1.4.1 已通过 26 个真实代码块、折叠、明暗及两轮 PJAX 归一化；最低 Halo 契约仍保持 1.3.1 |
| `ai-assistant`            | `1.5.1`  | `2.2.4`           | 2.2.4 已通过已有摘要、明暗、移动端、PJAX 首次脚本注入和返回去重回归；不含模型生成、RAG 或编辑器 AI |
| `PluginContactForm`       | `1.6.4`  | `1.6.4`           | 已按 21 个变量和 3 类宿主更新契约；UI、校验、上传和提交仍待完整回归      |
| `plugin-friends`          | `1.4.6`  | `1.4.6`           | 上游已归档；与 Links 2.0.0 可启动，Links 2.1.0～2.2.1 组合触发类加载冲突 |
| `link-submit`             | `1.0.7`  | `1.0.7`           | 与 Links 2.0.0 可启动；主题按需加载官方资源并保留申请 URL/评论/邮箱降级  |

## 重点兼容点

| 功能            | 注意事项                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Links + Friends | 当前组合为 Links 2.0.0 + Friends 1.4.6 + Link Submit 1.0.7；三者均已启动。申请弹窗支持按需加载与 PJAX，Links 2.1.0～2.2.1 暂不可升级            |
| Photos          | 列表页和无限滚动新增项都要补齐 LightGallery `data-src` 契约并刷新单实例；详情页使用 `.photo-detail-viewer`                                      |
| Moments         | 1.16.1 的已删除作者可能为空；模板必须降级，作者页调用 `momentFinder` 前必须确认 `PluginMoments >=1.16.1` 可用；单图/多图统一按稳定锚点重绑灯箱 |
| Docsme          | 评论 subject 使用 `doc.halo.run/DocTree/{docTree.name}`，不是 Doc 资源                                                                          |
| Bangumi         | 侧边栏 Finder 必须门控；轮播销毁时清理计时器且尊重 reduced-motion；页面背景位于 `#swup-page-extras`                                             |
| Douban          | `dataType/genre/page/size/type/status` 与 URL 同步；历史返回恢复状态；条目和题材请求分别取消；背景位于 extras                                   |
| Steam           | 空封面和 `delisted` 状态按 1.0.0；游戏背景与 Alpine 状态位于 extras；侧栏异步请求在组件销毁时取消，浅色模式使用专属背景选择器                   |
| Passkey         | 登录表单必须保留 `.halo-form` 和插件认证片段                                                                                                    |
| Vote            | 主题覆盖 1.1.3 的 25 个公开变量；投票提交、重复限制和用户弹窗仍需实站验证                                                                       |
| Text Diagram    | 主实例 `mermaid_selector` 为默认 `<text-diagram>`；主题按需加载插件自带资源、串行补渲染，并在明暗切换后重绘 SVG。自定义 selector 不在当前契约内 |
| Shiki           | 1.4.1 在 Halo 2.25.4 已通过 26 个代码块、折叠、长行、明暗与两轮 PJAX；主题实现契约仍保留兼容 Halo 2.23/2.24 的 1.3.1                         |
| LightGallery    | 文章、Moments 单图/多图及 PJAX 返回均保持单实例；后台 selector 覆盖 moments、photos、docs、archives、about、privacy 路由                     |
| Contact Form    | 主题契约已覆盖 1.6.4 的 21 个变量和 3 类宿主；Loader 可用，但提交、上传、贴边和弹窗流程尚未完成实站验证                                        |
| AI Assistant    | 2.2.4 的文章 `ai-summary-widget` 已通过无模型回归；不代表 RAG、编辑器 AI 或模型生成流程已验证                                                     |
| Hyperlink Card  | 块级卡片保持块布局，行内卡片保持 `inline-block`；颜色继续由插件后台控制                                                                         |
| KaTeX           | `.katex-display` 限制正文宽度并允许横向滚动；公式脚本依赖 `data-pjax` 重执行                                                                    |
| Lottery         | 只约束 `<lottery-card>` 宿主宽度；参与、验证码、开奖和存储状态需要有效活动写操作验收                                                            |
| Restricted      | 只约束 `<content-restrict-widget>` 宿主；文章和允许评论的单页 subject 已对齐，其他解锁模式需逐项验收                                            |
| Dishes          | 插件返回完整独立 SPA，默认 `/dishes` 必须硬跳转，不能交给主题 Swup 替换；自定义路由的菜单链接必须添加 `data-no-swup` 并单独回归                 |
| Schedule        | 插件返回完整独立页面，默认 `/schedule-calendar` 必须硬跳转；自定义路由同样需要 `data-no-swup`；3.3.0 契约来自主实例 JAR                         |
| Maintenance     | 保留插件 `title` 与富文本 `description` 模型；使用独立轻量模板和返回首页入口，不加载主题 PJAX 应用                                              |
| Alist 存储      | 不作为瞬间前端发布后端，避免上传成功但发布链路失败                                                                                              |

## 推荐灯箱配置

在 lightgallery.js 插件后台配置 selector；主题只负责保留 DOM 合约，并在 PJAX 切换后重新触发插件脚本：

| 路径匹配      | 匹配区域               |
| ------------- | ---------------------- |
| `/photos`     | `#photo-grid`          |
| `/photos/**`  | `.photo-detail-viewer` |
| `/moments`    | `.moment-media`        |
| `/moments/**` | `.moment-media`        |
| `/docs/**`    | `#article-content`     |
| `/archives/**` | `#article-content`     |
| `/about`       | `#article-content`     |
| `/privacy`     | `#article-content`     |

以上是主 Halo 当前已验证的完整规则；新增正文路由时继续使用 `#article-content`，并执行首次进入、PJAX 返回和重复进入的单实例检查。

## 本地验证

基础检查：

```bash
pnpm verify:plugin-versions
pnpm verify:plugin-contracts
pnpm lint
pnpm build-only
pnpm verify:plugins
```

深度检查：

```bash
pnpm verify:plugin-versions -- --strict
pnpm verify:plugins:deep
```

校验 Bangumi 1.4.1 的非法分页/筛选边界（数值越界返回 404，无法解析的文本参数按插件降级规则回落）：

```bash
BANGUMI_VALIDATE_INVALID=1 pnpm verify:plugins:deep
```

指定详情页：

```bash
PHOTO_DETAIL_URL=/photos/{photoName} \
MOMENT_DETAIL_URL=/moments/{momentName} \
DOC_DETAIL_URL=/docs/{project}/{doc} \
pnpm verify:plugins
```

正文中存在对应内容时，可指定包含插件元素的页面，确认服务端输出了真实 Web Component 开始标签，而不是只命中资源脚本：

```bash
VOTE_PAGE_URL=/archives/{post} \
TEXT_DIAGRAM_PAGE_URL=/archives/{post} \
CONTACT_FORM_PAGE_URL=/archives/{post} \
AI_SUMMARY_PAGE_URL=/archives/{post} \
SHIKI_PAGE_URL=/archives/{post} \
HYPERLINK_CARD_PAGE_URL=/archives/{post} \
LOTTERY_PAGE_URL=/archives/{post} \
RESTRICTED_READING_PAGE_URL=/archives/{post} \
pnpm verify:plugins
```

## 人工验收清单

| 场景           | 要看什么                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------- |
| 桌面端         | 页面布局、侧边栏、卡片、分页、空态                                                       |
| 移动端         | 是否横向溢出，按钮和卡片是否拥挤                                                         |
| PJAX           | 首页进入插件页，再返回和重复进入                                                         |
| 暗色模式       | 搜索、评论、代码块、灯箱颜色是否正常                                                     |
| 灯箱           | 点击图库、瞬间、文档图片是否打开插件灯箱                                                 |
| 评论           | 评论组件是否只初始化一次                                                                 |
| 投票           | 单选、多选、PK、重复投票、结束状态和弹窗                                                 |
| 文本绘图       | Mermaid/PlantUML、暗色模式、横向溢出和 PJAX 重复进入；必须看到生成 SVG，不只检查原始标签 |
| 联系表单       | 内嵌、贴边、弹窗、提交、错误和文件上传                                                   |
| AI 总结        | 加载态、成功、失败、暗色和重复进入                                                       |
| 发布/上传/登录 | 只有改到对应模板时再做真实操作                                                           |

## 已知风险

| 风险               | 处理方式                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| 搜索结果指向旧文章 | 属于本地搜索索引数据问题，需要重建索引                                           |
| 天气接口偶发失败   | 属于外部数据源问题，不阻塞插件页适配                                             |
| 豆瓣封面被远端拦截 | 在 `plugin-douban` 配置图片代理                                                  |
| Steam API 不稳定   | 检查服务器网络、API Key 和 Steam 隐私设置                                        |
| 朋友圈为空         | 检查 RSS 抓取、友链数据和插件任务                                                |
| Friends 路由异常   | 确认 Links 保持 2.0.0；2.1.0～2.2.1 与 Friends/Link Submit 组合会触发类加载冲突  |
| Link Submit 不可用 | 检查官方 JS/CSS 按需加载；失败时主题应降级到申请 URL、评论或邮箱，不采用测试 JAR |
