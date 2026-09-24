# 插件适配状态

这份文档记录主题和 Halo 插件的适配边界、版本基线和本地验收方式。它不是安装教程，具体配置请看各功能文档。

2026-09-24 待发布的主题 `2.2.40` 代码已通过本地依赖升级抽查；精确组合与待完成的供应链时龄门禁见 [依赖适配记录](../development/dependency-upgrade-2026-09-24.md)。下文提到的 `2.2.39` 是当时的历史运行快照。

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

`contractVersion` 是主题实现所采用的插件契约；`testedVersion` 只在真实站点回归通过后填写，并且只是关联记录的历史摘要。插件最新版和站点安装版本不写入本表。矩阵只覆盖主题主动消费或明确适配的插件，未列出的插件不能因为能通过 `halo:footer` 注入资源就自动视为兼容。Steam、Equipment、Shiki 的主键现使用 manifest ID；仓库别名保留在脚本 aliases 中。

2026-09-23 当时的运行组合为 Halo Pro 2.26.1 / 主题 2.2.39 未提交工作区 / **45 个安装插件**；当时的代码指纹、逐插件结果和剩余问题见[2026-09-23 结果](./current-plugin-results.md)，精确 HTTP/API 与页面验证见[当时收口审计](./main-halo-runtime-audit.md)。此前 47 项插件的安装构建、官方稳定目标、发布日期、最低 Halo、技能基线和逐项结果仍保留在[9 月 22 日快照](./evidence/2026-09-22/version-audit.json)。当时测试不能用 HEAD 或单个 `testedVersion` 替代；旧记录中缺少的环境信息保持未知，不倒填。

| Plugin | Surface | Contract version | Tested version | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| `PluginLinks` | `/links` 友链、`?view=friends` 友链动态、RSS、访客验证码申请与留言降级、评论与首页 Finder | `2.3.0` | `2.3.0` | `compatible-tested` | `templates/links.html`、`templates/modules/links`、`src/apps/links/runtime.js`、`templates/modules/widgets/links.html`、`settings.yaml`、`scripts/verify-plugin-pages.mjs`、`scripts/verify-links-runtime.mjs`、`docs/system/adaptation/main-halo-runtime-audit.md`、`src/apps/links/application.js`、`scripts/verify-plugin-upgrades.mjs` |
| `PluginPhotos` | 图库列表、无限滚动、照片详情和 LightGallery 生命周期 | `2.1.1` | `2.1.2` | `compatible-tested` | `templates/photos.html`、`templates/photo.html`、`templates/modules/photos/content.html`、`src/pages/photos/photos.js` |
| `PluginMoments` | 瞬间列表、详情、releaseTime、媒体和作者降级；发布接口仅核对契约 | `1.16.1` | `1.19.0` | `compatible-tested` | `templates/moments.html`、`templates/moment.html`、`templates/modules/moments`、`docs/system/adaptation/main-halo-runtime-audit.md` |
| `seo-tools` | 默认 Head 所有权、社交元数据与主题 SSR 降级已验；主题页临时接管已验，但关闭插件后 `/dishes`、`/schedule-calendar` 失去 canonical。当前站点已恢复插件所有权；全站 canonical 未修复 | `1.9.5` | `1.10.1` | `compatible-tested` | `templates/modules/seo-head.html`、`settings.yaml`、`scripts/verify-seo-contracts.mjs`、`docs/system/adaptation/evidence/2026-09-23/seo-full-http-temporary.json` |
| `PluginFeed` | Head 中的 RSS 自动发现链接与 /feed.xml 路由 | `1.5.0` | `1.5.0` | `compatible-tested` | `templates/modules/seo-head.html`、`scripts/verify-plugin-pages.mjs`、`docs/system/adaptation/main-halo-runtime-audit.md` |
| `plugin-docsme` | 文档中心、目录、正文、DocTree 评论 subject | `1.7.0` | `1.10.0` | `compatible-tested` | `templates/docs.html`、`templates/doc.html`、`templates/modules/doc-content.html`、`docs/system/adaptation/main-halo-runtime-audit.md` |
| `plugin-bilibili-bangumi` | 追番页面和侧边栏卡片 | `1.4.0` | `1.4.1` | `compatible-tested` | `templates/bangumis.html`、`templates/modules/widgets/bangumi-card.html` |
| `steam` | Steam 页面、侧边栏可用性门控、空封面和下架状态 | `1.0.0` | - | `inferred` | `templates/steam.html`、`templates/modules/steam/content.html`、`templates/modules/widgets/sidebar.html`、`src/pages/steam/steam.js` |
| `equipment` | 装备页面 | `1.1.1` | - | `confirmed` | `templates/equipments.html`、`templates/modules/equipments` |
| `plugin-douban` | 豆瓣扁平 DTO 与旧格式兼容、海报网格、类型/题材筛选及历史恢复 | `1.2.6` | `1.2.6` | `compatible-tested` | `templates/douban.html`、`src/pages/douban/douban.js`、`docs/system/adaptation/main-halo-runtime-audit.md`、`src/apps/douban/model.js`、`scripts/verify-plugin-upgrades.mjs` |
| `PluginSearchWidget` | 导航搜索入口 | `1.7.1` | - | `confirmed` | `templates/modules/nav.html` |
| `PluginCommentWidget` | halo:comment 注入、懒挂载、资源版本一致性与评论主体 | `3.3.2` | `3.3.2` | `compatible-tested` | `templates/modules/post/article-footer.html`、`templates/modules/moments`、`templates/modules/doc-content.html`、`docs/system/adaptation/main-halo-runtime-audit.md` |
| `shiki` | 文章与文档高亮、原生代码换行、明暗及 PJAX 归一化 | `1.3.1` | `1.5.1` | `compatible-tested` | `src/static/css/article-content.css`、`docs/system/adaptation/plugin-adaptation.md`、`docs/system/adaptation/main-halo-runtime-audit.md` |
| `PluginLightGallery` | 文章、图库、瞬间和文档图片灯箱 | `1.2.1` | `1.2.1` | `compatible-tested` | `src/common/main.js`、`src/pages/photos/photos.js`、`templates/modules/photos/content.html`、`docs/system/adaptation/plugin-adaptation.md` |
| `auth-passkey` | 登录页认证入口；专用 guest 的用户中心凭据列表 403 属权限边界，显式绑定插件角色后可读取，完整 WebAuthn 未验 | `1.0.4` | - | `confirmed` | `templates/login.html`、`templates/gateway_fragments/login.html`、`docs/system/adaptation/evidence/2026-09-23/passkey-permission-latest-code.json` |
| `plugin-online` | 在线统计侧边栏小工具和 PJAX 请求取消 | `1.0.5` | - | `confirmed` | `templates/modules/widgets/online-stats.html`、`src/common/js/alpine-modules.js` |
| `vote` | 文章和页面内投票块的主题配色 | `1.1.3` | - | `confirmed` | `src/static/css/article-content.css` |
| `text-diagram` | 文章和文档内 Mermaid/PlantUML 文本绘图及暗色模式 | `1.5.2` | - | `confirmed` | `templates/modules/theme-script.html`、`src/static/css/article-content.css`、`src/static/js/article-content.js` |
| `PluginContactForm` | 正文内嵌表单和全局贴边/弹窗表单的主题配色 | `1.6.4` | - | `confirmed` | `src/common/css/base.css`、`templates/modules/theme-script.html` |
| `ai-assistant` | 3.0/3.1 共用摘要宿主与四个颜色变量；3.1 启动和后端生成/读取已验，自动注入待验 | `3.0.0` | - | `confirmed` | `src/pages/post/post.css`、`src/common/main.js`、`docs/system/adaptation/evidence/2026-09-23/ai-assistant-3.1.0-source-diff.json` |
| `editor-hyperlink-card` | 正文块级与行内超链接卡片的宿主布局、暗色和 PJAX 资源生命周期 | `1.9.2` | - | `confirmed` | `src/static/css/article-content.css`、`src/common/main.js` |
| `plugin-katex` | 正文行内/块级数学公式与 PJAX 重执行 | `3.0.0` | - | `confirmed` | `src/static/css/article-content.css`、`src/common/main.js` |
| `lottery` | 正文抽奖卡片宿主布局 | `1.0.2` | - | `confirmed` | `src/static/css/article-content.css` |
| `restricted-reading` | 文章/单页受限阅读组件宿主布局、登录和评论解锁依赖 | `1.8.1` | - | `confirmed` | `src/static/css/article-content.css`、`templates/modules/post/article-footer.html`、`templates/modules/page/content.html` |
| `dishes` | 独立 /dishes SPA 路由的 PJAX 绕过 | `1.0.3` | - | `confirmed` | `src/common/main.js`、`scripts/verify-plugin-pages.mjs` |
| `schedule-calendar` | 独立 /schedule-calendar 路由的 PJAX 绕过 | `3.3.0` | - | `confirmed` | `src/common/main.js`、`scripts/verify-plugin-pages.mjs` |
| `maintenance` | 独立维护页的主题模板、标题、富文本说明和返回入口 | `1.1.0` | - | `confirmed` | `templates/maintenance.html` |

状态含义：`confirmed` 表示仓库实现契约已核对；`compatible-tested` 表示 `testedVersion` 已有真实站点测试记录，它可以等于或高于 `contractVersion`；`inferred` 表示源码已经采用新契约，但仍需在真实 Halo 站点补充运行态证据后才能填写 `testedVersion`。三种状态都不能替代当前目标站点的安装版本检查；只有非空 `testedVersion` 才代表该版本存在运行态测试记录。

`halo:footer`、`halo:captcha` 和通用 `pluginFinder.available(...)` 是 Halo 平台扩展点，不对应单一插件版本，因此不单列版本契约；实际提供这些扩展点的插件仍需独立回归。

9 月 22 日的主实例 47 项是历史快照；最新 Console 清单为 45 项，其中 27 项有显式主题契约、18 项在矩阵外。`plugin-friends` 与 `link-submit` 现已不在安装清单，本轮未卸载它们；此前禁用安装及 Friends 启动失败只作为历史记录。版本脚本会同时打印矩阵外插件清单；矩阵外插件可能无需主题契约，也可能是尚未完成适配的缺口，必须按运行审计分类判断。

`2.2.39` 原有的 37 项读取型页面/API 检查及 Friends 跳过记录属于停用前快照；更新后的脚本检查 `/links?view=friends`。九条真实页面的原 PJAX 记录不能自动证明这次模板变更。无样本或未执行的写入流程不填写新的 `testedVersion`。旧 `2.2.37` 的 11/31 项检查、AI Assistant 2.2.4 摘要回归仍保存在运行审计的历史节；3.0 本次恢复启动及临时挂载证据单独记录。

## 最新版核对（2026-09-23）

原 47 项安装快照的版本、正式发布来源、影响分析和验证边界见[全量运行态审计](./main-halo-runtime-audit.md)及[当天 47 项市场版本复核](./evidence/2026-09-23/version-refresh.json)；当前本地安装仅 45 项。Bangumi 市场版本落后于 GitHub 正式 Release；Data Studio 只有预发布，二者均已单列。9 月 23 日复核发现 AI Assistant 的稳定目标已升至 **3.1.0**；版本复核时安装 3.0.0，之后本地已安装并启动 **3.1.0**。旧版浏览器结果不能记作新版通过。

当前 45 项的最终分类为：24 项已验证表中限定的主题表面、2 项代码适配完成但关键运行流程待验、17 项与主题无专属契约、2 项受环境或上游阻塞；[逐项结果](./current-plugin-results.md)列明缺口。AList 由用户明确排除本项目修复范围，归入无主题专属契约。Friends 的旧启动失败保留为历史诊断，不再是主题交付的待验项。未执行的写入、缺样本与禁用组合逐项保留，不把“启动成功”标作主题测试通过。主题基础最低 Halo 仍为 2.23；这套最新插件要求 Halo 至少 2.26，当前 2.26.1 满足，未执行站点升级。

版本比较脚本现在输出 `version-match` / `versionMatches`，仅表示安装号匹配历史记录，不能作为当前组合通过的结论。页面脚本可用 `--report=/tmp/halo-plugin-http-tests.json` 保存环境、插件和代码指纹；写入报告自身不会改变指纹，源码或未跟踪实现文件变更会改变指纹。

主题采用 Links 2.3 访客申请与豆瓣 1.2.6 数据结构，评论资源按实际安装版本校验，提供 Halo 2.26 公共布局。其余字段未变化的插件保留有效契约基线，只在真实回归后提高 testedVersion，不能把“版本号相同”当作通过。

AI Assistant 3.0 在 AI Foundation 1.1.0 可用后经授权重启恢复；官方组件临时挂载、读取既有摘要及明暗/移动端展示通过。官方 3.1.0 的摘要 JS/CSS 和摘要后端类与 3.0.0 相同，故矩阵保留实际使用的 `contractVersion=3.0.0`，项目支持目标为 3.1.0；3.1.0 的授权/编辑器变化不属于主题摘要宿主。现有 3.1.0 实装制品与官方 SHA256 一致，启动、摘要资源 HTTP 读取和当前代码的 32/32 深度烟测通过。先前使用旧 `deepseek-chat` 凭据的单次生成返回 401，测试专用 Foundation 配置已回滚；随后用户设置 `deepseek-flash` 并报告手测通过。本轮只读核对到新生成的 Flash 摘要内容、token 统计及匿名/管理员摘要接口 200，没有重复调用模型。自动摘要仍关闭，3.1.0 的前台自动展示与浏览器生命周期待验证；不把后端生成读回抬升为完整的 `testedVersion`。禁用插件、缺少完整运行证据或未执行的写入流程均不抬升 testedVersion。

## 重点兼容点

| 功能           | 注意事项                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Links 2.3 | 基础列表/RSS 保留 >=2.2.1 门控；访客申请还需 >=2.3 且 linkApplicationEnabled=true。使用官方无 Cookie API，验证码每次尝试后刷新；关闭时保留留言降级。 |
| Photos         | 列表页和无限滚动新增项都要补齐 LightGallery `data-src` 契约并刷新单实例；详情页使用 `.photo-detail-viewer`                                      |
| Moments        | 1.16.1 的已删除作者可能为空；模板必须降级，作者页调用 `momentFinder` 前必须确认 `PluginMoments >=1.16.1` 可用；单图/多图统一按稳定锚点重绑灯箱  |
| Docsme         | 评论 subject 使用 `doc.halo.run/DocTree/{docTree.name}`，不是 Doc 资源                                                                          |
| Bangumi        | 侧边栏 Finder 必须门控；轮播销毁时清理计时器且尊重 reduced-motion；页面背景位于 `#swup-page-extras`                                             |
| Douban | 1.2.6 扁平 DTO 与旧 spec/faves 统一归一化；URL 筛选、历史恢复、独立请求取消及背景 extras 保持有效。 |
| Steam          | 空封面和 `delisted` 状态按 1.0.0；游戏背景与 Alpine 状态位于 extras；侧栏异步请求在组件销毁时取消，浅色模式使用专属背景选择器                   |
| Passkey        | 登录表单必须保留 `.halo-form` 和插件认证片段                                                                                                    |
| Vote           | 主题覆盖 1.1.3 的 25 个公开变量；专用单选、多选、PK 真实提交已验，重复限制、结束态和用户弹窗待验。 |
| Text Diagram   | 主实例 `mermaid_selector` 为默认 `<text-diagram>`；专用文章 Mermaid SVG 及 PJAX 返回已验，暗色重绘和 PlantUML 待验。自定义 selector 不在当前契约内。 |
| Shiki | 1.5.1 的 26 个真实高亮块及 PJAX 归一化已检查；原生 pre code 继承 pre 空白规则。1.5.1 本身要求 Halo >=2.26，不能把旧契约当作最新版的 Halo 最低要求。 |
| LightGallery   | 文章、Moments 单图/多图及 PJAX 返回均保持单实例；后台 selector 覆盖 moments、photos、docs、archives、about、privacy 路由                        |
| Contact Form   | 主题契约覆盖 1.6.4 的 21 个变量和 3 类宿主；专用内嵌表单真实提交成功，PJAX 离页 Loader 已修复；上传、贴边和弹窗待验。 |
| AI Assistant | 3.1.0 + Foundation 1.1.0 已启动，Flash 摘要生成和读取通过；`ai-summary-widget` 与四个 `--halo-asw-*` 变量共用 3.0 契约；自动注入及浏览器生命周期待验。 |
| Hyperlink Card | 块级卡片保持块布局，行内卡片保持 `inline-block`；颜色继续由插件后台控制                                                                         |
| KaTeX          | `.katex-display` 限制正文宽度并允许横向滚动；专用文章公式首次和 PJAX 返回渲染已验，编辑器 3.0 新预渲染样本待验。 |
| Lottery        | 只约束 `<lottery-card>` 宿主宽度；卡片已验，Redis 未验证连接使参与/开奖受阻。 |
| Restricted     | 只约束 `<content-restrict-widget>` 宿主；匿名不泄漏及专用账号登录解锁已验，答题/评论/支付待验。 |
| Dishes         | 插件返回完整独立 SPA，默认 `/dishes` 必须硬跳转，不能交给主题 Swup 替换；自定义路由的菜单链接必须添加 `data-no-swup` 并单独回归                 |
| Schedule       | 插件返回完整独立页面，默认 `/schedule-calendar` 必须硬跳转；自定义路由同样需要 `data-no-swup`；3.3.0 契约来自主实例 JAR                         |
| Maintenance    | 保留插件 `title` 与富文本 `description` 模型；使用独立轻量模板和返回首页入口，不加载主题 PJAX 应用                                              |
| Alist 存储     | 不作为主题瞬间前端发布后端；用户已明确排除本项目的 AList 修复及验收。 |

## 推荐灯箱配置

在 lightgallery.js 插件后台配置 selector；主题只负责保留 DOM 合约，并在 PJAX 切换后重新触发插件脚本：

| 路径匹配       | 匹配区域               |
| -------------- | ---------------------- |
| `/photos`      | `#photo-grid`          |
| `/photos/**`   | `.photo-detail-viewer` |
| `/moments`     | `.moment-media`        |
| `/moments/**`  | `.moment-media`        |
| `/docs/**`     | `#article-content`     |
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

| 风险               | 处理方式                                                                                |
| ------------------ | --------------------------------------------------------------------------------------- |
| 搜索结果指向旧文章 | 属于本地搜索索引数据问题，需要重建索引                                                  |
| 天气接口偶发失败   | 属于外部数据源问题，不阻塞插件页适配                                                    |
| 豆瓣封面被远端拦截 | 在 `plugin-douban` 配置图片代理                                                         |
| Steam API 不稳定   | 检查服务器网络、API Key 和 Steam 隐私设置                                               |
| 友链动态为空       | 检查 PluginLinks 的 RSS 来源、公开动态权限及读取 API                                    |
| 旧 `/friends` 404  | 该插件已退出主题适配；入口改用 `/links?view=friends`，旧组合结论见运行态历史快照          |
| 友链申请入口不可用 | 检查主题申请 URL、评论和邮箱设置；页面不再加载 Link Submit 资源                         |
