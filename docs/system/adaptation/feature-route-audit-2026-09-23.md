# 2026-09-23 主题功能、路由与插件契约审查

本报告检查的是本地 `http://localhost:8090` 的 **Halo Pro 2.26.1、主题 2.2.39 未提交工作区**。目标插件版本、实装版本、技能基线、项目契约和已测试组合分别见[45 项逐插件结果](./current-plugin-results.md)及[官方版本/发布日期/最低 Halo 表](./main-halo-runtime-audit.md#逐插件版本核对)。AList 不属于本次主题修复；Friends 已退役，其动态入口由 Links `/links?view=friends` 承接。以下分数是本地**主题表面验收信心**（10 分制），不评价插件本身，也不代表未测后台业务通过：9 = 主要状态和真实交互已验；8 = 读写主路径可用，仍有明确边界；7 = 页面可用但重要分支未验；6 以下 = 存在已知错误或必要运行环境缺失。

**定级：基本可用（整体 8/10）**。路由和主内容已可运行，但集合页曾因非法页码直接发生模板异常，服务端一次性生成热力图存在数据截断与时间区偏差，部分插件写入/认证状态仍未完成验收。SEO 插件生成的集合分页 canonical 与实际页面不一致；临时主题接管虽能修正主题页面，却会让两个独立插件页失去 canonical，是当前最明确的未修复缺口。

## 共享功能：问题 → 修复 → 浏览器验收

| 功能/路由 | 分数 | 问题位置与原因 | 当前修复或方案（官方方法） | 真实界面验收 |
| --- | ---: | --- | --- | --- |
| 首页 `/`、头图瞬间 | 8 | `templates/modules/index/header/moments.html` 把含 HTML 的 `content.raw` 用 `th:text` 输出，用户看到 `<p style=...>`；`listAll()` 为只显示 3 条卡片全量取数 | 改为官方 Moments 的 `content.html` / `th:utext`，只有 HTML 缺失时安全回退 `raw`；Finder 使用 `list(1, 3).items`；改为块级容器承载正文。依据[Moments 主题 API](https://github.com/halo-sigs/plugin-moments/blob/main/dev/theme-api.md) | 打开首页，观察 3 条卡片正文没有字面 HTML；点详情、返回、切换主题再观察。当前浏览器已核对正文及 3 个卡片 |
| 首页文章/瞬间 Tab、侧栏 | 8 | 保存的旧 Friends Tab 值可重复/指向退役数据；显式空组件数组被默认组件覆盖 | `tabs_group.html` 过滤并去重为文章/瞬间；`sidebar.html` 仅在配置缺失时回退默认，空数组表示不显示 | 首页切 Tab、刷新、进入文章/瞬间；空数组需在专用配置样本下复验，目前为代码契约检查 |
| 侧栏天气卡片 | 8 | `welcome-card.html` 把无效温度占位符 `"--"` 送进 `Math.round()`，接口失败时出现 `NaN °C`；旧 `localStorage` 还可重复带入坏值 | `alpine-modules.js` 先校验有限数值，再显示整数或 `--`；无效响应不缓存，旧坏缓存被移除；请求失败显示“天气暂不可用” | 此前指纹 `7521524...` 下，真实浏览器正常接口显示 28°C；阻断天气域名后显示 `--°C` 与失败说明，没有 `NaN`，恢复了浏览器测试缓存；见[专项记录](./evidence/2026-09-23/cache-weather-fix.json) |
| 分类 `/categories`、归档及分页 | 8 | Issue #40 将无限追加与 URL 分页混用；非法 `p=abc` 被 `#numbers.formatInteger` 处理时抛 `TemplateProcessingException`；封面缺失时 URL 拼接不稳 | 取消自动追加；先用[Halo PostFinder](https://docs.halo.run/developer-guide/theme/finder-apis/post)得到总页数，再将 `p`/`page` 规范为有效 1 起页码；各卡片以[Thymeleaf URL 表达式](https://www.thymeleaf.org/doc/tutorials/3.1/usingthymeleaf)生成封面地址 | 浏览器看首屏计数、翻页 URL/列表一致；访问 `?p=abc`、`?page=2`、归档第 2 页，确认完整 200、标题与分页同步；已做六篇/页 17 次交互及本轮非法参数复测 |
| 标签 `/tags`、归档及分页 | 8 | 与分类共享非法页码异常；标签列表为空时，文章分支也被错误隐藏 | 同一规范化页码；文章是否渲染由文章结果决定，不依赖标签列表是否为空 | 浏览器访问 `?p=abc`、`?page=2`、真实标签详情；空标签/有文章的混合状态尚无本地样本 |
| 文章/单页 `/archives/{slug}`、`/privacy` | 8 | Issue #36 的全局断词规则压平原生代码块；部分特殊内容组件生命周期依赖页面切换 | `pre code` 继承 `pre` 的空白规则；正文插件由主题容器和 PJAX 生命周期承接 | 打开真实文章，检查代码换行、公式、图表、受限块及图片；27 个原生代码块和 26 个高亮块曾单独核对，完整交互矩阵见下表 |
| 关于页及首页年度文章热力图 | 8 | Finder `size=500` 在大站截断、服务端向 HTML 注入大量文章、UTC 日期与访客本地日历错位；原 Tooltip 字符串拼接可解释不受信任标题 | 改用 Halo 公共文章 API 每页 100 条递进读取、按本地日历绘制过去 365 天、进入视口才加载、离页中止请求，提示用 `textContent`；代码在 `article-heatmap-data.js`、关于页及小组件中 | 首页/关于页均滚到热力图，检查 365 格、总数、Tooltip、明暗、PJAX 返回；605 篇分页、两个时区、503/坏分页由专用测试覆盖；真实站只有 1 篇落在过去一年 |
| 导航、主题切换、PJAX | 8 | `x-data` 已定义 `init()` 时又写 `x-init="init()"`，会重复初始化；切换后观察者/请求可能残留 | 按[Alpine 生命周期](https://alpinejs.dev/globals/alpine-data)保留自动 `init()`，组件 `destroy()` 清理；菜单指向 Links 动态；Swup 保留页面资源生命周期 | 首页 → 关于 → 首页，确认热力图重建、模式跟随/浅色切换保留；点“朋友们 → 友链动态”应到 `/links?view=friends`，已实测 |
| 首页标题安全与通用容错 | 8 | `src/pages/index/index.js` 曾把标题原文写进 `innerHTML`；动态文本存在解释为标记的可能 | 改为 DOM 节点和 `textContent`；模板用空值保护与缺省文本 | 用含 `<img onerror>` 的测试标题观察只显示字面文本、没有新增元素；已在浏览器模拟核对 |
| 页脚及法律页 `/terms` | 8 | 配置默认与本地页脚指向不存在的 `/terms` | 用户已指定从默认及本地保存配置删除该链接，保留 `/privacy`、`/sitemap.xml` | 任一页面下拉页脚，确认无 `/terms` 链接、保留目标 200；直接访问 `/terms` 仍为预期 404 |

## 27 个主题插件表面

下表逐项给出主题的处理方法和剩余验证；各项稳定目标、最低 Halo、发布记录链接及安装状态不在此混写，直接使用[逐插件版本表](./main-halo-runtime-audit.md#逐插件版本核对)与[当前结果表](./current-plugin-results.md)。已安装但无主题专属契约的 17 项由后者列为“不适用”，不会为覆盖率而安装或启用插件。

| 插件/功能 | 分数 | 问题/契约检查与处理 | 浏览器与后端核验；剩余 |
| --- | ---: | --- | --- |
| PluginLinks 友链、动态、申请 | 8 | 旧分组作用域造成 Issue #38 500；统一 Links 2.3 的 Finder/API、`/links?view=friends`，退役独立 Friends | 两个视图、分组/来源、公开 API、移动端/PJAX 已验；申请审核写入未验，部分外部 RSS 源更新失败 |
| PluginPhotos 图库/详情 | 8 | 对齐 2.1.2 照片 VO 与 LightGallery，保持离页清理 | 列表、20 条详情路由、灯箱/PJAX；上传/EXIF 未验 |
| PluginMoments 列表/详情/首页卡片 | 8 | `raw` 含 HTML 导致首页标签字面显示；已按官方 `content.html` 修复并限制 Finder 3 条 | 列表、详情、RSS、首页当前代码显示；发布/上传/删除未做 |
| seo-tools Head/canonical | 5 | 插件 1.10.1 只保留查询参数 `p`，不校验其值；对非法 `?p=abc` 原样 canonical，对有效 `?page=2` 却 canonical 到首页 | 默认关闭的主题开关可修正主题页，但临时全路由复测发现 `/dishes`、`/schedule-calendar` 的原有 canonical 会消失；已在设置文案标为仅主题页实验选项，**不能全站启用，当前站点仍保留原插件错误** |
| PluginFeed RSS | 8 | 使用插件路由和 Head 自动发现，无重复主题 RSS | `/feed.xml` 200；外部订阅器未验 |
| plugin-docsme 文档 | 8 | 保留官方列表/详情模板与 DocTree 评论主体 | `/docs`、详情、目录/PJAX；许可证/无权限态未制造 |
| plugin-bilibili-bangumi 追番 | 7 | 保留 Finder、分页和参数降级；当前指纹 `/bangumis` 首次导航时插件访问 Bilibili 的 TLS 握手超时，Halo 返回 500，重试 200 | 列表/分页/PJAX；插件路由应为上游失败提供空态或缓存降级，尚未修复与隔离复测 |
| steam 页面/卡片 | 8 | 保留可用性门控、空封面/下架分支，热力图 Tooltip 仅由日期数字组成 | `/steam`、公开 API/PJAX；上游断网状态未验 |
| equipment 装备 | 7 | 主题保留组、图片、链接字段；实装插件 1.1.1 的 `groupBy()` 以 `2147483647` 为页大小，每次页面请求触发 3 条 Halo 限额警告 | `/equipments` 当前页面 200、PJAX 已验；大于 1000 的组或组内项可能截断，须由插件改成限额内分页并用大样本复测；后台编辑未验 |
| plugin-douban 豆瓣 | 8 | 将 1.2.6 扁平 DTO 归一化并兼容旧 DTO，防止字段丢失 | 8 条内容、筛选、移动/PJAX；同步/迁移未做 |
| PluginSearchWidget 搜索 | 8 | 使用官方搜索入口，主题只提供导航与配色 | 查询、空结果、键盘/关闭已验；索引完整性属插件 |
| PluginCommentWidget 评论 | 7 | `halo:comment` 仅一处宿主，按实装资源版本加载，主体与懒挂载一致 | 读取/加载已验；发布、审核、上传、验证码未验 |
| shiki 高亮 | 8 | 修复原生 `pre code` 空白规则，保留插件处理高亮 | 27 原生/26 高亮块、PJAX、明暗；其他语言未穷举 |
| PluginLightGallery 灯箱 | 8 | 图片仍提供 `data-src`，离页销毁重建 | 真图点击、PJAX 已验；其他媒体格式未穷举 |
| auth-passkey 登录 | 5 | 保留 `.halo-form` 和 Halo 认证扩展宿主；普通用户凭据 GET 403，主题模板不能授予插件 API 权限 | 登录方法页正常；旧 guest 账号绑定插件角色后曾可见空列表，但本轮 `post-contributor` 账号按 Altcha 正常登录，绑定后等待约 31 秒并重新登录仍 403，有效权限未出现凭据读取规则。账号/绑定已清理；WebAuthn 全流程待验 |
| plugin-online 统计 | 8 | 使用 summary API，PJAX 离页取消请求 | 页面/API 已验；多用户/WebSocket 故障未验 |
| vote 投票 | 8 | 保留官方投票块及配色 | 专用单选、多选、PK 提交与后台记录已验；重复限制/结束态/移动弹窗未验 |
| text-diagram 绘图 | 7 | 队列重绘和明暗/PJAX 生命周期 | 专用 Mermaid SVG 和返回已验；PlantUML/暗色重绘未验 |
| PluginContactForm 表单 | 8 | 修复 PJAX 离页 Loader，保留内嵌/贴边/弹窗宿主 | 必填与内嵌提交/后台记录、返回已验；上传/贴边/弹窗/移动未验 |
| ai-assistant 摘要 | 7 | 3.1.0 源码资源差异已核对，保留摘要宿主和颜色变量；Foundation 是后台依赖 | Assistant 3.1/Foundation 1.1 启动与 Flash 摘要记录读取；浏览器临时挂载组件在明暗/390px 和 PJAX 离页清理通过；自动注入关闭，自动展示仍待验 |
| editor-hyperlink-card 链接卡片 | 7 | 保留块级/行内宿主布局与插件资源 | 真实正文四类卡片和安全外链属性；暗色/移动点击未验 |
| plugin-katex 公式 | 8 | 保留官方公式 DOM 与 PJAX 补渲染 | 专用文章两处公式首次/返回；3.0 新预渲染样本未验 |
| lottery 抽奖 | 4 | 主题卡片能渲染，参与/开奖需后端 Redis；本地 effectiveSource=NONE | 卡片展示已验；参与/开奖**受阻**，不能宣称兼容 |
| restricted-reading 受限阅读 | 7 | 保留解锁组件、登录与评论主体，匿名不泄漏正文 | 专用账号登录后正文可读；答题/评论/支付未验 |
| dishes 独立 SPA | 7 | `/dishes` 绕过主题 PJAX，尊重插件完整页面生命周期 | 页面与整页导航；原插件 canonical 1 条，临时关闭 SEO Tools 后为 0，主题 Head 无法接管；后台点餐/导入不属主题 |
| schedule-calendar 独立日历 | 7 | `/schedule-calendar` 绕过 PJAX，读取 summary | 页面/摘要；原插件 canonical 1 条，临时关闭 SEO Tools 后为 0，主题 Head 无法接管；自定义路由与写入未验 |
| maintenance 维护模式 | 8 | 独立维护模板与 title/description，主题不劫持插件重定向 | 本地短时启用产生 302、维护页 200、设置已恢复；绝对域名端到端跳转未验 |

## 关键修复的前后差异

分页在旧模板中直接把查询字符串当数字格式化，非法值会中断 Thymeleaf 渲染；现在先校验数字和总页数，再把规范化的页码传给正文、标题和分页器：

```diff
- currentPage=${#numbers.formatInteger(pageParam, 0)}
+ requestedPage=${rawPage.matches('^[0-9]{1,6}$') ? T(java.lang.Integer).parseInt(rawPage) : 1}
+ collectionPageNumber=${category == null and requestedPage > 0 and requestedPage <= firstCollectionPage.totalPages ? requestedPage : 1}
```

`rawPage` 先从 `p` 或 `page` 提取，`firstCollectionPage` 由 Finder 提供总页数；标签页同理。完整表达式在 `templates/modules/categories/layout.html` 和 `templates/modules/tags/layout.html`。Moment 修复保留官方 HTML 与纯文本后备：

```diff
- th:each="moment : ${momentFinder.listAll()}" ... th:text="${content.raw}"
+ th:each="moment : ${momentFinder.list(1, 3).items}" ... th:utext="${content.html}"
```

热力图的服务端 Finder `size: 500` 改为浏览器分页公共 API，首页/关于页复用同一数据函数；`Date#getFullYear()/getMonth()/getDate()`产生访客本地日期，Tooltip 用 `textContent`，避免将文章标题解释为 HTML。Alpine 的 `init()` 由框架自动调用，移除了重复 `x-init`；`destroy()` 清理观察者、定时器及离页请求。这些改动的可运行版本以本地源码和构建产物为准，不以技能说明证明已适配。

### SEO、缓存与认证的后续定位

SEO Tools [1.10.1 官方发布](https://www.halo.run/store/apps/app-FNGbT/releases/app-release-zemd61lg)要求 Halo `>=2.23.0`。对本地实装 JAR 的 `CanonicalLinkProcessor` 检查确认：`CANONICAL_QUERY_PARAMETERS` 只有 `p`，`buildCanonicalLink` 直接取第一个非空参数，未校验数字和正文实际页码。主题分类/标签正文已把 `p=abc` 规范到第 1 页、`page=2` 解析为第 2 页，所以插件的 Head 与正文矛盾。主题无法在插件开启时再加一条 canonical；现在改成互斥配置：

```diff
- <th:block th:unless="${seoPluginAvailable}"><link rel="canonical" th:href="${absoluteCanonical}" /></th:block>
+ <link rel="canonical" th:if="${!#strings.isEmpty(absoluteCanonical) and (!seoPluginAvailable or themeCanonicalOverride)}" th:href="${absoluteCanonical}" />
```

`themeCanonicalOverride` 对应默认关闭的主题设置。这遵循[Halo 官方主题 SEO 文档](https://docs.halo.run/developer-guide/theme/seo)对单一准确 canonical、最终响应检查及避免插件重复标签的要求。本地临时**先关闭 SEO Tools 的“开启规范链接”，再开启主题“仅由主题页面生成规范链接”**，执行主题 Reload 与页面缓存刷新。在设置提示文案调整前的代码指纹 `bd7460b...` 下，15 个代表 URL 均为 200 且只有一条主题 canonical：分类/标签的 `?p=abc`、`?p=0`、过大页码归根路径，`?page=2` 和 `?p=2` 均归 `?p=2`；首页、分类/标签详情、文章和隐私页也通过。真实浏览器直接打开分类/标签及文章，文章 → 分类 → 分类第 2 页的 PJAX 切换在标题/H1 更新后 canonical 同步；文章仍保留 4 条 OG 元数据，浏览器控制台和本地 Halo **06:29–06:32 UTC 测试窗口**错误/警告日志均为零。[最初的 15 URL 记录](./evidence/2026-09-23/seo-cache-ai-followup.json)保留当时的测试与恢复值；随后在同一渲染代码下扩展到[114 路由 HTTP 与浏览器抽查](./evidence/2026-09-23/seo-full-http-temporary.json)，113 个有效路由为 200、108 个具备主题 canonical。`/dishes` 与 `/schedule-calendar` 由独立插件输出完整页面，在原插件设置下各有 1 条 canonical；临时关闭插件后变为 0 条。`/login`、`/login?method=passkey`、`/signup` 原本就是 0，不属于新增回归。临时配置已精确恢复，Reload 与页面缓存清理后原 URL 再次输出插件 canonical。**主题开关不是全站 SEO 修复**；更合适的完整修复是 SEO Tools 插件校验集合页参数，继续负责独立页面的全局 canonical，或由独立插件自行输出 canonical。主题设置文案已明确仅供主题页面实验，当前站点仍保留原插件错误。初次扩展扫测误将开关写入顶层配置，[无效结果](./evidence/2026-09-23/seo-full-http-invalid-config.json)单独保留，不计入结论。

Page Cache [1.6.0 官方发布](https://www.halo.run/store/apps/app-BaamQ/releases/app-release-dgt4lgbd)新增最小权限清理角色。本地实装 `PageCacheWebFilter` 要求 `Accept: text/html` 才缓存，缓存键是完整请求 URL；命中后响应为 `Cache-Control: max-age=3, s-maxage=120, must-revalidate` 并带 `X-Halo-Cache-At`。同一首页 URL 的浏览器型请求反复命中 `2026-09-23 05:25:42 GMT` 的旧 HTML，而默认 `curl` 的 `Accept: */*` 得到 `no-cache, no-store` 新渲染；这解释了“改了模板但浏览器仍旧”的现象。最初 15 URL 验收按[官方缓存刷新 API](../development/dev.md#资源缓存)在切换后、恢复后以及清理 Reload 自动写回的默认字段后共清理三次：相同 `/categories?p=abc` URL 的缓存时间依次为测试配置 `06:30:11 GMT`、首次恢复 `06:31:53 GMT`、最终恢复 `06:37:36 GMT`；后续扩展验收和最终设置 Reload 也各自清理缓存，普通浏览器新导航仍回到插件 canonical。仅加随机查询字符串会产生另一条缓存键，不证明旧 URL 已刷新；未来正式发布仍需再次清理并检查代理/CDN 缓存。本次未升级或部署站点。

当前指纹 `7521524...` 的烟测脚本已按浏览器请求 HTML，支持 `--cache-fresh-since` 拒绝刷新前缓存。先用旧缓存实测拦下 `/links`、`/equipments`，再于本地主题 Reload（配置数据哈希未变）和 Page Cache 刷新后，让[12 个原 URL 全部通过](./evidence/2026-09-23/cache-guard-weather-after-refresh.json)。浏览器禁用本机缓存，已登录 `localhost` 与无登录 Cookie 的 `127.0.0.1` 分开观察；匿名主机命中 Page Cache，原 `localhost` URL 另由请求头烟测证实新缓存。侧栏天气还用同一真实浏览器模拟服务不可达，确认不会显示 `NaN`；没有据此宣称 SEO 等插件问题已消失。[详情](./evidence/2026-09-23/cache-weather-fix.json)。

AI Assistant 3.1.0 的既有 Flash 摘要以浏览器临时挂载官方 `ai-summary-widget` 的方式复核：API 200，组件 Shadow DOM 包含同一摘要；390px 视口组件宽 358px、页面无横向溢出，[浅色](./evidence/2026-09-23/ai-widget-mobile-current.png)与[深色](./evidence/2026-09-23/ai-widget-mobile-dark-current.png)截图均正常。由文章点击上一篇进行 PJAX 切页，等标题和 H1 真正更新后，临时 widget 与头部 JS/CSS 都为 0，说明离页清理生效。该浏览器测试对应改动 SEO 开关前的代码指纹；全站自动摘要开关保持关闭，**不把临时挂载算作自动注入通过**。[原专项记录](./evidence/2026-09-23/seo-cache-ai-followup.json)保留这一时间线。Passkey 1.0.4 [方法页 390px 截图](./evidence/2026-09-23/passkey-login-mobile-current.png)在 `localhost` secure context 下按钮可见且无“不支持”警告；当前代码下重新创建专用 guest 账号，用户中心凭据列表仍返回 403。显式绑定插件附带的 `plugin-passkey-role-template-authenticated` 后，空列表和“添加 Passkey”正常显示，说明该测试账号的失败位于权限层；账号与角色绑定均已清理。浏览器无法创建虚拟认证器，因此没有测试 WebAuthn 注册、登录或删除，也未接触个人凭据。[新权限与清理证据](./evidence/2026-09-23/passkey-permission-latest-code.json)。

同一最终代码指纹 `74d214a...` 的[后续不改插件复测](./evidence/2026-09-23/no-plugin-source-verification.json)扩大了 Passkey 失败范围：一次性 `post-contributor` 账号通过密码登录，当前用户接口为 200，真实 `/uc/profile?tab=passkey` 却显示“加载失败”。给该账号显式绑定插件角色并立即刷新仍失败；**当时没有完成角色生效后的独立会话验证**，因此该轮只能确定普通低权限界面确实失败，不能把根因定为角色聚合。自动填充把测试名附加到旧用户名、以及保存的 `/logout` 返回目标，曾使早期探针无效；后续测试已在提交前核对输入并确认会话身份，无效探针不计入结论。全部一次性用户/绑定已删除，未触碰个人 Passkey。分类/标签 canonical 错误、装备三条分页警告在同一指纹下重现；追番本轮 200。SEO Tools 的内置重定向只按请求路径匹配，不能按 `p`/`page` 查询参数做条件规范化。

当前源码指纹 `1bcb1efbf229e49c7a74d1f70934fd91dca0747640ad347fff00077fc9e834d0` 下，先刷新本地 Page Cache，再用 `Accept: text/html` 核查原 URL 的缓存时间：[自动化 20 项检查](./evidence/2026-09-23/runtime-issues-automated.json)为 13 通过、5 失败、2 未测，失败是分类/标签各两条 canonical 与装备每次新 HTML 请求的 3 条页大小警告；Bangumi 正常路由通过，上游失败注入未做。[Passkey 一次性账号独立探针](./evidence/2026-09-23/passkey-disposable-automated.json)以当前 Altcha 正常解题登录，当前用户 200，凭据 GET 403。显式绑定插件角色、等待约 31 秒、重新登录后，有效权限接口仍没有凭据读取规则，GET 仍 403。全部测试账号与绑定清理完成，未改正式权限策略。较早的[真实浏览器定向记录](./evidence/2026-09-23/runtime-issues-browser.json)确认分类/标签页面与 Passkey 登录按钮的可见状态；它的源码指纹不同，仅 QA 脚本后来变化，不能倒填为当前指纹的全路由浏览器验收。

## 真浏览器与后端复验顺序

1. 在同一真实浏览器任务空间中禁用浏览器缓存，记录当前主题代码指纹；打开首页、分类、标签、归档、文章、关于、作者、照片、瞬间、友链、文档、豆瓣、追番、Steam、装备、登录及独立插件路由。每页检查标题、主区、页面溢出、模板异常与可见空态；后台日志同时查 `TemplateProcessingException` 和插件错误。最终指纹 `74d214a...` 已复测 114 路由：113 个可用页面及预期 404 的 `/terms`，本窗口无可见 500；较早指纹的 `/bangumis` 曾首次返回 500、重试成功，仍需失败降级修复。
2. 分类/标签分别输入合法 `p=2`、别名 `page=2`、非法 `p=abc`、过大页码；核对 URL、标题、页码、文章列表、SSR 完整性。首页瞬间检查含 `<p>` 的真实样本不显示字面标签，点击详情后返回。关于/首页热力图滚入视口后应出现 365 格和当前一年内 1 篇；分别做 PJAX 返回、明暗、Tooltip、失败/重试。
3. 在 Links 动态视图切分组/来源，在照片页开灯箱，文章页开评论/公式/图表/受限块，查看移动 390px 和桌面 1440px。对于需要写入的表单、投票或认证，只沿用[已授权本地专用样本的恢复方案](./plugin-runtime-followup.md)，并把结果与清理记录绑定。没有执行的写入分支维持“待运行验证”。
4. 运行 Node 24.18.0 的类型检查、lint、format、27 项主题插件契约、升级回归、SEO/热力图测试、Vite 构建、资源检查及深度 HTTP/API 烟测。记录 Halo/插件/主题/代码指纹；浏览器可见成功不替代后端写入结果，HTTP 200 不替代脚本和交互检查。正式发布后需递增资源版本并验证页面缓存刷新，本次不部署。

### 新定位问题的修复后验收方案

| 问题位置与修复责任 | 推荐修改（依据） | 真实浏览器与后端通过条件 |
| --- | --- | --- |
| SEO Tools 1.10.1 `CanonicalLinkProcessor`；当前集合页参数处理错误，主题开关只覆盖主题 Head | 插件侧校验 `p` 的数值/页数并接受 `page` 别名，把实际正文页码规范到唯一 URL；保留对独立页面的全局 canonical。主题开关维持默认关闭；[Halo 主题 SEO 要求](https://docs.halo.run/developer-guide/theme/seo)以最终 HTML 为准 | 在插件修复版和明确的 Halo/主题指纹下，打开分类/标签 `p=abc`、`page=2`、`p=2`，核对标题、列表、分页和唯一 canonical；再打开 `/dishes`、`/schedule-calendar`，两页应各有一条 canonical。执行 114 路由 HTTP 与代表页真实浏览器/PJAX，检查同 URL 缓存刷新和 Halo 模板/SEO 日志。当前**未有插件修复版**，不得把主题实验开关作为通过 |
| 追番插件 1.4.1 路由在 Bilibili TLS 超时后抛 500，发生在主题模板前 | 在[官方 `/bangumis` 路由/Finder 契约](https://github.com/Roozenlz/plugin-bilibili-bangumi#%E4%B8%BB%E9%A2%98%E9%80%82%E9%85%8D)的插件实现中对超时/断网返回可见错误态或缓存数据，保留原筛选/分页参数；这是建议，当前主题仓库未改插件 | 正常网络打开列表、筛选、第 2 页并用前进/后退；隔离 Bilibili 连接失败后重新打开相同 URL，应为受控 200/明确错误页而非未处理的 500，浏览器有重试入口，Halo 日志记录受控原因；恢复网络后重试为 200。当前仅见一次 500 和后续成功，降级未验 |
| 装备插件 1.1.1 `EquipmentFInderImpl.groupBy()`、`listAll()`、`listBy()` 使用 `Integer.MAX_VALUE` 请求页大小 | [官方 1.1.1 源码](https://github.com/chengzhongxue/plugin-equipment/blob/1.1.1/src/main/java/com/kunkunyu/equipment/finders/impl/EquipmentFInderImpl.java#L54-L82)中改用每页不超过 Halo 限额的循环分页，并保证稳定排序及全部组/项聚合；当前主题只消费插件提供的结果 | 在隔离环境准备超过 1000 项的专用数据，不向本地正式内容批量写入。真实浏览器打开 `/equipments`、切分组/PJAX，数量、封面和链接与 API 总数一致；同一请求的 Halo 日志不再出现页大小警告；测试 1000、1001 和空组边界，再清理测试数据。当前本地仅 2 组 3 项，不能证明大数据完整 |
| Passkey 1.0.4 用户中心凭据列表：已登录 `post-contributor` 凭据 GET 403，组件显示“加载失败”；测试账号有效权限不含插件凭据读取规则 | 按[Halo 聚合角色官方说明](https://docs.halo.run/developer-guide/plugin/security/rbac)排查 `aggregate-to-authenticated` 的实际聚合、缓存和插件角色规则；站点/Halo 或插件维护者需在其责任代码中修复。主题不能扩大接口权限；直接绑定隐藏角色模板在本轮等候 31 秒后仍未生效，不应当作修复方案 | 修复后以一次性普通账号按现有 Altcha 流程登录：当前用户接口 200、有效权限出现凭据 GET、真实 `/uc/profile?tab=passkey` 空列表/本人凭据正常，继而在支持虚拟认证器的浏览器验注册、登录、删除；清理专用账号/绑定/凭据。当前前半段失败、WebAuthn 未验 |

现有证据：[此前 Issue #40 六篇/页交互](./evidence/2026-09-23/issue40-six-browser.json)、[较早指纹 33 项插件 HTTP/API](./evidence/2026-09-23/plugin-http-current-final.json)、[最终指纹 114 路由浏览器导航](./evidence/2026-09-23/browser-routes-post-warning.json)、[最终指纹 HTTP/SSR](./evidence/2026-09-23/route-http-post-warning.json)、[同窗口后端日志](./evidence/2026-09-23/backend-log-post-warning.json)及[较早指纹 390px 样本](./evidence/2026-09-23/browser-mobile-current.json)。代表性真实界面截图：[首页瞬间](./evidence/2026-09-23/visual-home-current.png)、[友链动态](./evidence/2026-09-23/visual-links-friends-current.png)、[关于页热力图](./evidence/2026-09-23/visual-about-heatmap-current.png)。这些记录各有自己的代码指纹；后续编辑源文件后须重跑受影响的验证，不能把旧结果改写为新组合。

## 未修复与边界

- SEO Tools 1.10.1 当前站点的集合页 canonical 仍不正确。主题互斥接管在临时配置中能修正主题页，但会令独立插件页 `/dishes`、`/schedule-calendar` 失去原有 canonical；已恢复原配置，**现有双开关方案不是全站修复**。插件应校验页码并理解 `page` 别名，继续为独立页面提供全局 canonical，或由独立插件承担自己的 Head。
- Passkey 1.0.4 的用户中心“通行密钥”页对已登录的普通 `post-contributor` 临时账号显示“加载失败”；这不再只是 guest 账号的测试限制。插件角色声明了向 `authenticated` 聚合，但当前已取得有效权限缺少凭据规则与认证后 GET 403 的证据；无法仅凭此判定是 Halo 聚合控制器、站点角色配置还是插件规则接入所致，也未完成 WebAuthn 组件完整请求链。主题不能替代用户中心插件鉴权。
- AI Assistant **组件**浏览器展示与 PJAX 清理已验；自动注入仍关闭，编辑器 Agent 未验。Passkey 登录界面已验，WebAuthn 注册/登录/删除未验；抽奖 Redis、Data Studio 稳定版仍缺运行条件。后台类、停用类及不相关插件按逐插件表注明范围，不以“已安装”推导“已适配”。
- 外部 RSS 抓取失败、Bilibili 偶发连接中断和 AList 附件错误均在后端日志出现，但没有证据表明它们由主题模板造成。当前指纹的 `/bangumis` 曾真实返回 500，主题无法替插件拦截上游超时。Halo `Page size must not be greater than 1000` 已定位到装备插件 1.1.1 的 `groupBy()` 超大分页值；当前小数据量页面 200，大数据截断风险需插件侧修复与复测。[隔离和字节码证据](./evidence/2026-09-23/backend-followup-latest-code.json)。
- 首页浏览器曾在同一主题版本 `2.2.39` 下读取到旧 HTML；已定位到 Page Cache 按 `Accept` 和完整 URL 缓存。最初临时验收的三次清理、后续扩展与最终 Reload 后的刷新，以及同 URL 浏览器复验均已记录；正式发布时仍需要主题版本化资源、再次刷新页面缓存及代理/CDN 层核查。本轮未发布。
