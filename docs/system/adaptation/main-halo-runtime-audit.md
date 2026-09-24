# 主 Halo 插件运行态审计

## 2026-09-23 SEO、页面缓存、AI 与 Passkey 后续核验

本节是下方历史复验之后的增量，不能把旧结果倒填到新代码。**最终源码指纹**为 `74d214a02ea557cf5ead5432ba642a9c9fbd53c2a4fc49e108ef1cfc7baa9caf`；Node 24.18.0 / pnpm 10.34.5 下 `build`（含工作树和压缩包 SEO 契约、27 项插件契约、热力图与升级回归）、`lint`、`format:check` 均通过，压缩包 SHA256 为 `25e7961761275b95d679c56933f2d55fa053ad8ba01ca989ea2b0da2231a8882`。在原站点配置下，[114 路由 HTTP/SSR](./evidence/2026-09-23/route-http-post-warning.json)为 113 个 200 与预期 `/terms` 404；[同指纹的 114 路由真实浏览器导航](./evidence/2026-09-23/browser-routes-post-warning.json)无导航失败、可见 500 或横向溢出；[同窗口 Halo 日志](./evidence/2026-09-23/backend-log-post-warning.json)为 0 错误、6 条装备插件页大小警告。33 项插件 HTTP/API 深度检查仍对应较早指纹 `3f6b2bafddea31f8927df278a00223eda67a766d8c12fa8f4507e2979050f6fc`。中间指纹 `bd7460b...` 完成 SEO 15 URL 与临时 114 路由对照、Passkey 权限定位和追番一次 500 的后端诊断；最终代码相对它只收紧了主题设置文案，但旧结果不倒填为最终指纹的完整交互验收。

SEO Tools [1.10.1 正式版](https://www.halo.run/store/apps/app-FNGbT/releases/app-release-zemd61lg)的本地 JAR `CanonicalLinkProcessor` 只保留 `p` 查询参数且不校验数字。当前插件打开规范链接时，`/categories?p=abc` 输出错误的 `?p=abc` canonical，`/categories?page=2` 的正文为第 2 页却输出分类根 canonical；标签页相同。主题已增加默认关闭的 `theme.config.general.seo_settings.theme_canonical`。临时关闭插件 `canonical_link.enabled` 并打开主题开关，15 个代表 URL 的 HTTP、浏览器直接导航/PJAX 与后端日志曾通过。随后在相同渲染代码上扩展到[114 路由 HTTP 与浏览器抽查](./evidence/2026-09-23/seo-full-http-temporary.json)：113 个有效路由均为 200，但 `/dishes`、`/schedule-calendar` 是独立插件页面，不使用主题 Head；两页从原配置的 1 条 canonical 变为 0。登录/注册页原本就没有 canonical，不是本次回归。[第一次扫描的错误测试配置](./evidence/2026-09-23/seo-full-http-invalid-config.json)单独保留且不计入结论。**该互斥组合仅能修正主题页面，不能作为全站修复启用**；应由 SEO Tools 插件修正集合页参数并保留全局覆盖，或由两个独立插件自行输出 canonical。临时设置已精确恢复、Reload 并清缓存；当前站点分类/标签错误仍在。主题设置的提示文案已明确此边界。具体路径、前后 canonical 与恢复值另见[功能/路由审查](./feature-route-audit-2026-09-23.md#seo缓存与认证的后续定位)及[原 15 URL 证据](./evidence/2026-09-23/seo-cache-ai-followup.json)。

Page Cache [1.6.0 正式版](https://www.halo.run/store/apps/app-BaamQ/releases/app-release-dgt4lgbd)本地 JAR 证实只拦截接受 `text/html` 的 GET，按完整 URI 缓存；相同首页 URL 的浏览器型请求两次返回同一 `X-Halo-Cache-At: Wed, 23 Sep 2026 05:25:42 GMT`，默认 `curl` 的 `Accept: */*` 则绕过缓存。先前“浏览器旧模板、curl 新模板”的直接原因由此得到解释。最初 15 URL 验收的临时配置、首次恢复及清理 Reload 写回的默认字段后共执行三次 Page Cache 清理，同一 `/categories?p=abc` URL 的新缓存时间依次为 `06:30:11`、`06:31:53`、`06:37:36 GMT`，普通浏览器新导航也显示对应 Head；后续扩展验收及最终设置 Reload 又分别刷新了缓存。主题 Reload 与插件缓存失效仍是不同操作。早先四个未缓存 URL 未复现 `Page size must not be greater than 1000`；之后对路由分组和逐个重放，确认只有 `/equipments` 每次触发 3 条警告。实装 `equipment 1.1.1` 的 `EquipmentFInderImpl.groupBy()` 对分组及每组装备调用 `PageRequestImpl.of(1, 2147483647)`，Halo 将其限制为 1000。当前只有 2 组、3 项，页面 200；大量数据时可能截断，尚无大样本证明。应由装备插件改成每页不超过 1000 的递进查询，主题接收 Finder 结果时已晚。[日志、路由隔离与 JAR 字节码依据](./evidence/2026-09-23/backend-followup-latest-code.json)。

AI Assistant **3.1.0** + Foundation **1.1.0** 的已有 Flash 摘要在真实 Ego Lite 浏览器临时挂载官方组件后显示，API 200，组件 Shadow DOM 与摘要一致；390px 视口、明暗模式通过，[浅色截图](./evidence/2026-09-23/ai-widget-mobile-current.png)和[深色截图](./evidence/2026-09-23/ai-widget-mobile-dark-current.png)留存。PJAX 导航到下一篇、等标题与 H1 更新后，临时 widget、JS、CSS 均清理为 0。该浏览器测试发生在 SEO 代码改动前的 `3f6b2...` 指纹下；自动摘要继续关闭，**自动注入与编辑器 Agent 未验**。[结构化专项证据](./evidence/2026-09-23/seo-cache-ai-followup.json)区分这些结果的版本、代码指纹和测试范围。Passkey **1.0.4** 的登录方法页确认 localhost 是 secure context、WebAuthn API 可用、按钮显示正常。中间代码指纹 `bd7460b...` 下的新专用 guest 账号完成密码登录后，用户中心凭据列表确实 403；只给该账号显式增加 `plugin-passkey-role-template-authenticated`，页面便显示空列表和“添加 Passkey”。测试账号及角色已清理，没有绑定凭据或发送验证邮件。该结果只证明测试 guest 的角色绑定缺口，不能推断所有普通账号都失败；本浏览器不支持创建虚拟 WebAuthn 认证器，注册/认证/删除仍待真实环境验收。[精确权限及清理记录](./evidence/2026-09-23/passkey-permission-latest-code.json)。

中间指纹 `bd7460b...` 的 114 路由浏览器扫测中，`/bangumis` 首次导航超时，对应 Halo `2026-09-23T14:46:53.412+08:00` 的真实 500：插件向 Bilibili 发起请求时 TLS 握手超过 10 秒；聚焦重试后页面为 200，标题、正文及 canonical 可见。这是插件路由渲染主题前抛出的上游请求异常，主题模板不能直接修复。插件应在上游超时/断网时给出可见空态或缓存降级，并在同样失败条件下复测；最终指纹的窗口未复现 500，不等于缺陷已修复。[后端证据](./evidence/2026-09-23/backend-followup-latest-code.json)。

## 2026-09-23 此前代码复验（历史快照）

本节当时的主题代码指纹为 `3f6b2bafddea31f8927df278a00223eda67a766d8c12fa8f4507e2979050f6fc`，本地 Halo Pro **2.26.1**、主题 **2.2.39**，插件为 **45 项（44 STARTED、1 DISABLED）**。下方原“当前收口”段落记录更早的 `6e74adb...` 快照；二者都不代表本文件开头的最终指纹。执行日稳定目标和技能基线仍见本文件[逐插件版本核对](#逐插件版本核对)；最新逐插件结论见[当前结果](./current-plugin-results.md)。

补修集中在非法分类/标签页码的 Thymeleaf 渲染异常、文章热力图的 500 篇截断与本地日期、重复组件初始化、首页瞬间把 HTML `raw` 字段转义成字面标签，以及空配置/重复 Tab/封面缺失等状态。Moment 首页现按[官方主题 API](https://github.com/halo-sigs/plugin-moments/blob/main/dev/theme-api.md)使用 `content.html`，Finder 限制为 3 条；分类/标签按[Halo PostFinder](https://docs.halo.run/developer-guide/theme/finder-apis/post)先读取总页数后规范化 `p`/`page`。

Node 24.18.0 的 `lint`、`format:check`、完整 `pnpm build`（含 27 项插件契约、升级回归、SEO、两时区热力图测试、Vite、打包和归档检查）通过，`pnpm audit` 为 0 已知漏洞。打包文件 `dist/theme-sky-blog-1-2.2.39.zip` 的 SHA256 为 `17c9593b8f3fcd87b6e50bb1a1f8e046ff31b7a57f74f6ff3850c27ff465e7ce`。[最终 33/33 插件 HTTP/API](./evidence/2026-09-23/plugin-http-current-final.json)、[114 路由 HTTP](./evidence/2026-09-23/route-http-current-final.json)为 113 个 200 与预期 `/terms` 404，[同一代码指纹下的 114 路由真实浏览器导航](./evidence/2026-09-23/browser-routes-current-final.json)无导航错误、横向溢出或可见服务端错误；[定向浏览器复测](./evidence/2026-09-23/browser-followup-current.json)确认非法页码、首页 3 条 Moment 卡片、友链动态及两个 365 格热力图；[390px 四页复测](./evidence/2026-09-23/browser-mobile-current.json)无横向溢出。此前 6 篇/页写入配置及业务提交测试仍属各自旧指纹记录，不倒填为最终代码。

[最终浏览器/HTTP 时段的后端日志](./evidence/2026-09-23/backend-log-current-final.json)没有 `TemplateProcessingException`；记录了 9 次模板中断（快速导航期间的请求终止，未出现页面 500）、4 次附件 Reconciler 错误（AList 相关，用户排除）和 15 次 `Page size must not be greater than 1000` 警告。单独探测 Douban 三个公共 API、Douban 页面和 Links 动态页面未复现页大小警告，不能据此将其归因于主题或宣称已修复。

**仍未修复：** SEO Tools 1.10.1 在当前已恢复配置下，对 `/categories?p=abc`、`/tags?p=abc` 输出含非法查询的 canonical，对集合 `?page=2` 输出首页 canonical，和已规范化的正文/标题不一致。主题的临时互斥接管只修正主题页面，独立插件页会失去 canonical，因此未永久启用；插件本身仍需校验页码并处理 `page` 别名。AI Assistant 3.1 自动摘要注入、Passkey WebAuthn、Lottery Redis 和 Data Studio 稳定版仍保持逐插件表中的待运行验证/受阻状态。正式站点未升级或部署，Git 未暂存、提交或推送。

## 2026-09-23 当前收口：GitHub 问题、全路由与后端日志

执行日官方目标、当前实装、技能基线和项目契约仍按下方的不同列解释；[当前 45 项逐插件结果](./current-plugin-results.md)是最新状态，后续历史快照中的旧计数不再代表当前结论。本地环境为 Halo Pro 2.26.1 / 主题 2.2.39 未提交代码 / 45 项插件（44 STARTED、1 DISABLED），本次收口 `codeHash=6e74adb22faa05a12e1a8f01d3da6f5d771b8f0ffd8971a7287897f4f788e6ba`。

| GitHub 项 | 缺陷位置与原因 | 本地处理与证据 | 尚未完成 |
| --- | --- | --- | --- |
| [Issue #40 分类数量异常](https://github.com/sky121666/halo-theme-sky-blog-1/issues/40) | `src/pages/categories/categories.js` 的 IntersectionObserver 将下一页追加到当前服务端列表，URL 和分页器仍留在上一页；用户设每页 6 时同样可触发 | 删除自动追加及无效切换逻辑，分类导航和翻页统一交给真实链接与 Swup；六种分类内容片段删除哨兵。临时设 Halo 分类每页 6 篇，浏览器在 modern / media_text / magazine / minimal 四种风格下均为首屏 6、滚动后 6、翻页后另 6 且分页器 `2 / 9`；分类归档也为 6，390px 视口无横向溢出。补修极简风格 `h2` 的 `category-items` 标题及链接读取，17 次检查中事件均与页面文章一致；设置已恢复 | [精确浏览器证据](./evidence/2026-09-23/issue40-six-browser.json)仅对应当前本地代码及内容；公开版本/其他站点未部署 |
| [Issue #38 Links 500 / 缺布局](https://github.com/sky121666/halo-theme-sky-blog-1/issues/38) | 旧分组字段和 Thymeleaf 表达式作用域不符；旧发行包缺 `templates/layout.html` | 当前工作区使用主题级 `linksSettings` 且在集合筛选中用 `#root.linksSettings`；标准布局存在。`/links`、友链动态、分组、公开 API、移动浏览器及 33 项烟测均通过 | 历史字体 CDN 证书故障本次探测未复现；当前站点修复不等于已发布发行版 |
| [Issue #36 代码块挤一行](https://github.com/sky121666/halo-theme-sky-blog-1/issues/36) | 正文通用 `word-break`/空白规则压过 `<pre><code>` 原格式 | `src/static/css/article-content.css` 令 `pre code` 继承 `pre` 的空白与断词规则；真实文章 27 个代码块计算值为 `white-space: pre` | 提报者原帖内容未取得，按同类真实文章复现和验收 |
| [PR #37 checkout](https://github.com/sky121666/halo-theme-sky-blog-1/pull/37) | 远端 PR 仍指向旧 CI | 本地 CI pin 到[官方 v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) 完整 SHA | 未提交/推送，远端 PR 仍开放；GitHub Actions 未执行本地改动 |
| [PR #39 pnpm setup](https://github.com/sky121666/halo-theme-sky-blog-1/pull/39) | PR 提议 6.0.10，执行日官方已有 6.1.0；[远端失败任务](https://github.com/sky121666/halo-theme-sky-blog-1/actions/runs/33500169603/job/99831424370)的 `pnpm audit` 报 5 项漏洞（当前本地锁文件修复前另报 10 项） | 本地 pin 到[官方 v6.1.0](https://github.com/pnpm/action-setup/releases/tag/v6.1.0)，修复锁文件中受影响依赖；`pnpm audit` 现为 0 | 未提交/推送，远端 PR 和 CI 状态不随本地改动自动更新 |

当前代码以 Node 24.18.0 执行的 `format:check`、`lint`、`build`、27 项插件契约和归档 SEO 检查通过；此前同一锁文件的 `pnpm install --frozen-lockfile` 与 `pnpm audit` 通过。最终指纹对应[深度插件 HTTP/API **33/33**](./evidence/2026-09-23/full-route-after-issue40.json)、[114 个公开 GET 路由](./evidence/2026-09-23/route-sweep-after-issue40.json)（113 个 200，只有已从页脚移除的 `/terms` 为 404）及[6 篇/页浏览器交互](./evidence/2026-09-23/issue40-six-browser.json)。此前[29 类浏览器界面](./evidence/2026-09-23/browser-routes-final.json)和[代码块、移动友链交互](./evidence/2026-09-23/browser-interactions-final.json)对应改动前的指纹，相关页面代码未随本次补修改变，不倒填为新指纹。这些分别是 HTTP/SSR、浏览器导航、局部交互证据，不能替代所有后台写入或真机验收。页面缓存曾返回旧 2.2.39 资产，最终浏览器记录禁用缓存并使用 `qa` 参数；正式发布后仍需检查资源版本与缓存刷新。

后端日志中曾观察到 `alist-integration 1.2.0` 的附件 Reconciler 因 `/api/me` `role` 类型不符重复报错；用户确认 AList 不是本项目问题，故仅保留日志事实，不列主题缺陷、受阻项或后续修复。追番 `/bangumis/page/2?typeNum=1&status=0` 曾因 Bilibili 上游连接中断返回一次 500，稍后重试为 200。Links 的若干外部 RSS 源刷新为 500，当前 `/links?view=friends` 自身仍为 200，需由来源可达性/插件同步诊断。Halo 另记录 `Page size must not be greater than 1000` 警告；主题源码未发现显式请求超过 1000，触发方尚未定位，不将其归因于主题。测试资源创建/清理时的乐观锁警告没有形成残留，[清理记录](./evidence/2026-09-23/followup-runtime.json)已核对。

用户明确选择移除不存在的 `/terms` 链接：已从 `settings.yaml` 默认值和本地已保存页脚配置中删除这一项，保留 `/privacy` 与 `/sitemap.xml`；[保存配置、公开页脚及重载后 Console Setting 检查](./evidence/2026-09-23/terms-footer-removal.json)均确认链接消失，两个保留目标分别返回 200。主题 Reload 返回 200、状态仍为 READY，分类每页数量和列表风格保持恢复值。`/terms` 路由本身仍为 404，但已不从页脚指向它；未代写法律条款。GitHub 截图中的 main 分支保护提示属于仓库设置建议，不是主题运行错误；本轮未修改远端仓库设置、合并 PR、提交推送或部署。

## 2026-09-23 Friends 退役与 Links 统一入口

用户确认独立 Friends 功能与 PluginLinks 2.3.0 的友链动态重复，主题不再适配 `plugin-friends`。本轮最新 Console 清单为 **45 项，44 STARTED / 1 DISABLED**；`plugin-friends` 与 `link-submit` 均已不在安装清单，我们没有执行卸载。原 `plugin-friends 1.4.6 / DISABLED`、[1.4.6 官方版本](https://www.halo.run/store/apps/app-yISsV/releases/app-release-nc8mxddx)及旧启动失败保留为历史证据，不再列为主题待运行验证。本站以 `/links?view=friends` 承载 RSS 动态，计划支持和运行目标均为 PluginLinks 2.3.0 / Halo Pro 2.26.1。

本次未修改站点插件、菜单或主题配置数据。主题移除 Friends 首页 Tab、Finder、独立模板和设置组；将菜单中指向 `/friends` 的旧项在桌面、移动端和页脚渲染为“友链动态”并指向 `/links?view=friends`。本地保存的首页 Tab 顺序仍含 `friends`；模板会过滤该值，设置表单现在提供删除按钮，用户可在后台移除旧行。合同矩阵由 28 项改为 27 项；当前 45 项安装中 18 项处于矩阵外。旧 9 月 22 日表格、测试计数和 Friends 失败记录是当时快照，不表示当前支持。当前 45 项分类为已验证 17、待运行验证 10、不适用 17、受阻 1。

使用 Node 24.18.0 对当前 2.2.39 未提交代码执行完整 `build`、`lint`、主题契约、Links 运行单元验证及 SEO 检查，均通过；打包产物不含 Friends 模板或设置组。Halo 主题 Reload API 返回 200，状态保持 `READY`，公开布局仍为 `SUPPORTED`；重新读取主题 Setting 只含 18 个当前分组，已无 `friends_page_settings`，`tabs_order` 只提供 posts / moments 两项且 `removeControl=true`。本地首页与 `/links?view=friends` 均为 200，桌面、移动端和页脚旧菜单项输出 `/links?view=friends`，首页 Friends Tab 为零；Links 视图面板可见，`/friends` 返回 404。当前代码的深度 HTTP/API 烟测 **33/33**，其中友链动态页和公开 feed API 均通过；[精确环境、45 项插件状态与代码指纹](./evidence/2026-09-23/friends-retirement-http.json)见记录。该记录覆盖 SSR / HTTP / API，**未执行本次改动后的浏览器 PJAX、移动交互或菜单点击测试**，不把此前浏览器记录挪用为本次验证。

## 2026-09-23 官方版本复核及补充验收

当天重新读取全部 47 个已安装插件的官方应用市场版本列表，正式版只有 AI Assistant 发生变化：**官方稳定目标改为 [3.1.0](https://www.halo.run/store/apps/app-riNgb/releases/app-release-6orwsoce)**（2026-09-22 12:17 北京时间发布，要求 Halo `>=2.26.0`）。版本复核时本地安装 3.0.0；之后用户在本地升级到 3.1.0。所有市场预发布版本列表与 9 月 22 日记录一致；Data Studio 仍无正式版。逐项刷新结果见[2026-09-23 官方列表记录](./evidence/2026-09-23/version-refresh.json)，其中安装版本是复核时的快照；此前 47 项发布日期、最低 Halo 和技能基线仍见 9 月 22 日的详细清单。

| 插件 | 实际安装 | 官方最新稳定 / 发布 | 技能基线 | 项目计划支持 | 实现契约 | 实际测试组合 |
| --- | --- | --- | --- | --- | --- | --- |
| AI Assistant | **3.1.0**（当天先前为 3.0.0） | [3.1.0](https://www.halo.run/store/apps/app-riNgb/releases/app-release-6orwsoce) / 2026-09-22 12:17；Halo >=2.26.0 | 无独立技能 | **3.1.0** | 摘要宿主 3.0.0，已证实 3.1.0 界面资源不变 | Halo 2.26.1 + AI Assistant 3.1.0 + Foundation 1.1.0：启动、发行包与资源读取、Flash 摘要生成记录及接口读回通过；前台自动展示未验 |

从官方 3.1.0 发布制品读取 `plugin.yaml`、设置和前台资源：摘要 `index.js` / `index.css` 与 3.0.0 **逐字节相同**，16 个摘要类亦相同，因此主题 `ai-summary-widget` 宿主和颜色变量的 3.0 契约没有新增接口修改；3.1.0 的变化集中在免费功能授权、编辑器 Agent 与 Markdown 高亮加载。免费摘要要求应用市场插件 `>=1.19.0`，本地实际安装为 1.19.0；[源码制品对照](./evidence/2026-09-23/ai-assistant-3.1.0-source-diff.json)记录官方 JAR SHA256。本地升级后，实装 JAR 与该官方 SHA256 一致，插件处于 `STARTED`，摘要 JS/CSS 与 RAG UI 资源返回 200，当前代码的读取型深度烟测为 32/32。用户报告 AI 手动测试通过；随后只读核对发现一条新生成的 `deepseek-flash` 摘要记录，内容非空且带输入/输出 token 统计，匿名和管理员摘要读取接口均返回 200。此证据支持 **3.1.0 的后端生成与读取链路**，没有由本轮代理重复发起模型调用。自动摘要仍关闭，公开文章的服务端 HTML 没有注入摘要组件；前台自动展示及浏览器生命周期未验。[后续运行证据](./evidence/2026-09-23/followup-runtime.json)保留精确组合与代码指纹。本轮没有执行站点升级。

在 Halo Pro 2.26.1 / 主题 2.2.39 的后续未提交代码上，联系表单 1.6.4 暴露 PJAX 离页后悬浮 Loader 残留，主题已在离页清理阶段移除该节点；真实页面来回导航后观察到离页 0 个、返回 1 个。KaTeX 3.0.0 公式与 Text Diagram 1.5.2 Mermaid 在返回页重新显示。用户另行批准的本地临时测试、恢复和 AI 单模型调用的准确结果见[补充验收](./plugin-runtime-followup.md)；测试证据沿用各自采集时的代码指纹，不能倒填 9 月 22 日旧指纹。

## 2026-09-22 官方稳定目标与精确组合验收（主题 2.2.39）

本节取代前序同日的概括性清单。范围为 47 个已安装插件、28 个项目声明契约和 16 个活动插件技能的并集；没有声明但未安装的插件。`plugin-forum` 未使用、未安装且不在活动技能中，排除并不安装。

实际环境：`http://localhost:8090`，Halo Pro **2.26.1**（由 `/v3/api-docs` 的 `info.version` 与 Docker 镜像交叉核对），44 个 `STARTED`、3 个 `DISABLED`。46 项存在正式稳定目标；Data Studio 仅有预发布。33 个可取得官方 JAR 摘要的插件与本地 SHA256 一致，其余安装 JAR 摘要同样保存在清单中，不凭版本号推断二进制一致。

本轮授权仅覆盖项目代码、文档和必要测试。保留此前未提交实现及用户 QA 文件；没有执行站点升级、插件启停、模型迁移、生产部署、业务写入、Git 暂存/提交/推送。下方 AI 重启属于前序已获授权操作，本轮未重复执行。

### 版本与证据口径

- **实际安装**取自当前 Halo API；**官方稳定目标**取自执行当天官方市场/GitHub 发布记录；发布日期按北京时间展示，原始时间在 JSON 中保留。市场落后的 Bangumi 采用官方 GitHub 1.4.1。
- **技能基线**来自本轮读取的 `SOURCE.md`，仅作解释依据；**计划支持**是本项目本轮目标；**实现契约**来自唯一的 `scripts/plugin-contracts.mjs`，保留仍有效的旧接口基线。
- **历史 Tested**仅是既有矩阵摘要，不证明当前 Halo/配置/代码组合；本次结果以带内容指纹的 HTTP、浏览器、边界记录为准。每项“已验证”只覆盖所列读取/显示表面，未执行写入不被计入通过。
- 主题基础 `requires` 保持 `>=2.23.0`，未放弃旧接口兼容。完整最新插件集合要求 Halo 至少 2.26.0；实际 2.26.1 满足。不能在 Halo 2.23 环境安装这套最新插件后沿用本报告。

本次代码：基于 `dc76df4349a1a91516db52f035cad4c29283bf0d` 的未提交工作区，`codeHash=03349c4f38360b2593296f8e07e8c1892d08b2a6c07cc8c4993cceabb24a5c6f`，覆盖 360 个实现/构建文件；包括未跟踪的新代码，不把 HEAD 当作已测试代码。报告目录排除在指纹外，避免自引用。

证据：[版本/构建清单](./evidence/2026-09-22/version-audit.json)、[HTTP/API 记录](./evidence/2026-09-22/http-tests.json)、[浏览器记录](./evidence/2026-09-22/browser-tests.json)、[边界记录](./evidence/2026-09-22/boundary-tests.json)。

### 逐插件版本核对

| 插件 ID | 实装 / 状态 | 官方最新稳定版 / 发布日期 | 目标最低 Halo | 技能基线 | 计划支持 | 实现契约 | 历史 Tested |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `mcp-server` | 1.2.0 / STARTED | [1.2.0](https://www.halo.run/store/apps/app-ybv96zol/releases/app-release-on4pkzby) / 2026-09-05 | >=2.26.0 | 无独立技能 | 不适用/无目标 | — | — |
| `ai-foundation` | 1.1.0 / STARTED | [1.1.0](https://www.halo.run/store/apps/app-acslk9nu/releases/app-release-zqvdpyu1) / 2026-09-03 | >=2.26.0 | 无独立技能 | 不适用/无目标 | — | — |
| `plugin-katex` | 3.0.0 / STARTED | [3.0.0](https://www.halo.run/store/apps/app-ISCsX/releases/app-release-l4qbvcue) / 2026-01-16 | >=2.22.2 | 无独立技能 | 3.0.0 | 3.0.0 | — |
| `plugin-douban` | 1.2.6 / STARTED | [1.2.6](https://www.halo.run/store/apps/app-srBOL/releases/app-release-bcudqrjs) / 2026-08-22 | >=2.22.1 | 1.2.6 | 1.2.6 | 1.2.6 | 1.2.6 |
| `maintenance` | 1.1.0 / STARTED | [1.1.0](https://www.halo.run/store/apps/app-umgvtji6/releases/app-release-ecm0eqla) / 2026-04-18 | >=2.22.10 | 无独立技能 | 1.1.0 | 1.1.0 | — |
| `online` | 1.0.5 / STARTED | [1.0.5](https://www.halo.run/store/apps/app-ion2qhko/releases/app-release-jvggype9) / 2026-05-04 | >=2.23.0 | 1.0.5 | 1.0.5 | 1.0.5 | — |
| `dishes` | 1.0.3 / STARTED | [1.0.3](https://www.halo.run/store/apps/app-espsmupa/releases/app-release-smxrkwj0) / 2026-05-02 | >=2.23.0 | 无独立技能 | 1.0.3 | 1.0.3 | — |
| `schedule-calendar` | 3.5.0 / STARTED | [3.5.0](https://www.halo.run/store/apps/app-1ubowut0/releases/app-release-mdsorinh) / 2026-08-08 | >=2.25.0 | 无独立技能 | 3.5.0 | 3.3.0 | — |
| `lottery` | 1.0.2 / STARTED | [1.0.2](https://www.halo.run/store/apps/app-8wtcwm5t/releases/app-release-6dooiafp) / 2026-04-23 | >=2.22.0 | 无独立技能 | 1.0.2 | 1.0.2 | — |
| `PluginLive2d` | 2.2.0 / DISABLED | [2.2.0](https://www.halo.run/store/apps/app-oPNFQ/releases/app-release-wyldvl72) / 2026-07-28 | >=2.25.0 | 无独立技能 | 不适用/无目标 | — | — |
| `editor-emoji` | 1.1.0 / STARTED | [1.1.0](https://www.halo.run/store/apps/app-pwojlwgu/releases/app-release-j3solsy2) / 2026-08-26 | >=2.26.0 | 无独立技能 | 不适用/无目标 | — | — |
| `auth-passkey` | 1.0.4 / STARTED | [1.0.4](https://www.halo.run/store/apps/app-g7tggrco/releases/app-release-gqo1e59a) / 2026-01-27 | >=2.22.5 | 1.0.4 | 1.0.4 | 1.0.4 | — |
| `equipment` | 1.1.1 / STARTED | [1.1.1](https://www.halo.run/store/apps/app-ytygyqml/releases/app-release-xty8o5xa) / 2026-05-09 | >=2.22.0 | 1.1.1 | 1.1.1 | 1.1.1 | — |
| `plugin-bilibili-bangumi` | 1.4.1 / STARTED | [1.4.1](https://github.com/Roozenlz/plugin-bilibili-bangumi/releases/tag/1.4.1) / 2026-07-08 | >=2.21.0 | 1.4.1 | 1.4.1 | 1.4.0 | 1.4.1 |
| `steam` | 1.0.0 / STARTED | [1.0.0](https://www.halo.run/store/apps/app-0ojqyzfh/releases/app-release-ck4zbqkk) / 2026-06-28 | >=2.22.1 | 1.0.0 | 1.0.0 | 1.0.0 | — |
| `link-submit` | 1.0.7 / DISABLED | [1.0.7](https://www.halo.run/store/apps/app-glejqzwk/releases/app-release-okiwoznl) / 2026-05-23 | >=2.22.1 | 1.0.7 | 不适用/无目标 | — | — |
| `vote` | 1.1.3 / STARTED | [1.1.3](https://www.halo.run/store/apps/app-veyvzyhv/releases/app-release-np8tb8nv) / 2025-12-16 | >=2.22.0 | 无独立技能 | 1.1.3 | 1.1.3 | — |
| `shiki` | 1.5.1 / STARTED | [1.5.1](https://www.halo.run/store/apps/app-kzloktzn/releases/app-release-mzrz7aqk) / 2026-08-20 | >=2.26.0 | 1.5.1 | 1.5.1 | 1.3.1 | 1.5.1 |
| `data-studio` | 1.0.0-alpha.9 / STARTED | 无；见预发布节 | — | 无独立技能 | 不适用/无目标 | — | — |
| `text-diagram` | 1.5.2 / STARTED | [1.5.2](https://www.halo.run/store/apps/app-ahBRi/releases/app-release-rqudxdgh) / 2026-01-23 | >=2.11.0 | 无独立技能 | 1.5.2 | 1.5.2 | — |
| `PluginS3ObjectStorage` | 1.17.0 / STARTED | [1.17.0](https://www.halo.run/store/apps/app-Qxhpp/releases/app-release-hdy1v1xf) / 2026-06-29 | >=2.24.0 | 无独立技能 | 不适用/无目标 | — | — |
| `plugin-friends` | 1.4.6 / DISABLED | [1.4.6](https://www.halo.run/store/apps/app-yISsV/releases/app-release-nc8mxddx) / 2026-05-22 | >=2.22.0 | 1.4.6 | 1.4.6 | 1.4.6 | — |
| `PluginBytemd` | 1.9.0 / STARTED | [1.9.0](https://www.halo.run/store/apps/app-HTyhC/releases/app-release-fvqxsvlk) / 2026-06-26 | >=2.25.0 | 无独立技能 | 不适用/无目标 | — | — |
| `hybrid-edit-block` | 1.7.0 / STARTED | [1.7.0](https://www.halo.run/store/apps/app-NgHnY/releases/app-release-lgexvgkn) / 2026-08-17 | >=2.26.0 | 无独立技能 | 不适用/无目标 | — | — |
| `chenhe-lsky-pro` | 1.1.2 / STARTED | [1.1.2](https://www.halo.run/store/apps/app-jZHhX/releases/app-release-soqqub9p) / 2026-04-10 | >=2.22.0 | 无独立技能 | 不适用/无目标 | — | — |
| `PluginLightGallery` | 1.2.1 / STARTED | [1.2.1](https://www.halo.run/store/apps/app-OoggD/releases/app-release-LPQbl) / 2024-07-03 | >=2.10.0 | 1.2.1 | 1.2.1 | 1.2.1 | 1.2.1 |
| `PluginPhotos` | 2.1.2 / STARTED | [2.1.2](https://www.halo.run/store/apps/app-BmQJW/releases/app-release-hxm5qfoy) / 2026-06-23 | >=2.22.0 | 2.1.2 | 2.1.2 | 2.1.1 | 2.1.2 |
| `seo-tools` | 1.10.1 / STARTED | [1.10.1](https://www.halo.run/store/apps/app-FNGbT/releases/app-release-zemd61lg) / 2026-08-08 | >=2.23.0 | 无独立技能 | 1.10.1 | 1.9.5 | 1.10.1 |
| `PluginLinks` | 2.3.0 / STARTED | [2.3.0](https://www.halo.run/store/apps/app-hfbQg/releases/app-release-rpaiuvqj) / 2026-08-12 | >=2.25.0 | 2.3.0 | 2.3.0 | 2.3.0 | 2.3.0 |
| `PluginMoments` | 1.19.0 / STARTED | [1.19.0](https://www.halo.run/store/apps/app-SnwWD/releases/app-release-uip7zlta) / 2026-09-10 | >=2.26.0 | 1.19.0 | 1.19.0 | 1.16.1 | 1.19.0 |
| `page-cache` | 1.6.0 / STARTED | [1.6.0](https://www.halo.run/store/apps/app-BaamQ/releases/app-release-dgt4lgbd) / 2026-08-13 | >=2.23.0 | 无独立技能 | 不适用/无目标 | — | — |
| `content-tools` | 1.8.0 / STARTED | [1.8.0](https://www.halo.run/store/apps/app-SUvBR/releases/app-release-58jwitjo) / 2026-08-14 | >=2.26.0 | 无独立技能 | 不适用/无目标 | — | — |
| `PluginContactForm` | 1.6.4 / STARTED | [1.6.4](https://www.halo.run/store/apps/app-gSebd/releases/app-release-mnsixhfk) / 2026-07-15 | >=2.22.2 | 无独立技能 | 1.6.4 | 1.6.4 | — |
| `ai-assistant` | 3.0.0 / STARTED | [3.0.0](https://www.halo.run/store/apps/app-riNgb/releases/app-release-lsh7g0yx) / 2026-08-17 | >=2.26.0 | 无独立技能 | 3.0.0 | 3.0.0 | — |
| `alist-integration` | 1.2.0 / STARTED | [1.2.0](https://www.halo.run/store/apps/app-wEGMV/releases/app-release-d2ydr0xa) / 2026-06-18 | >=2.20.0 | 无独立技能 | 不适用/无目标 | — | — |
| `backup-improved` | 1.5.1 / STARTED | [1.5.1](https://www.halo.run/store/apps/app-dHakX/releases/app-release-3qec25tx) / 2026-01-02 | >=2.22.0 | 无独立技能 | 不适用/无目标 | — | — |
| `plugin-ldap-login` | 1.3.0 / STARTED | [1.3.0](https://www.halo.run/store/apps/app-vrSqF/releases/app-release-wf3uzfck) / 2025-06-15 | >=2.21.0 | 无独立技能 | 不适用/无目标 | — | — |
| `plugin-docsme` | 1.10.0 / STARTED | [1.10.0](https://www.halo.run/store/apps/app-yffxw/releases/app-release-vuhmiwq1) / 2026-09-18 | >=2.26.0 | 1.10.0 | 1.10.0 | 1.7.0 | 1.10.0 |
| `editor-hyperlink-card` | 1.9.2 / STARTED | [1.9.2](https://www.halo.run/store/apps/app-UpUJA/releases/app-release-epm4pje4) / 2026-06-10 | >=2.22.0 | 无独立技能 | 1.9.2 | 1.9.2 | — |
| `plugin-oauth2` | 1.7.1 / STARTED | [1.7.1](https://www.halo.run/store/apps/app-ESVDK/releases/app-release-jsoz5qnd) / 2026-01-20 | >=2.20.0 | 无独立技能 | 不适用/无目标 | — | — |
| `plugin-social-login` | 1.7.0 / STARTED | [1.7.0](https://www.halo.run/store/apps/app-IXZkJ/releases/app-release-dbseugob) / 2026-03-13 | >=2.23.0 | 无独立技能 | 不适用/无目标 | — | — |
| `restricted-reading` | 1.9.1 / STARTED | [1.9.1](https://www.halo.run/store/apps/app-TzRqd/releases/app-release-1avdqral) / 2026-09-20 | >=2.26.0 | 无独立技能 | 1.9.1 | 1.8.1 | — |
| `PluginCommentWidget` | 3.3.2 / STARTED | [3.3.2](https://www.halo.run/store/apps/app-YXyaD/releases/app-release-e6j0ni2s) / 2026-09-20 | >=2.26.0 | 3.3.2 | 3.3.2 | 3.3.2 | 3.3.2 |
| `PluginSitemap` | 1.3.0 / STARTED | [1.3.0](https://www.halo.run/store/apps/app-QDFMI/releases/app-release-lytd42sz) / 2026-04-27 | >=2.22.7 | 无独立技能 | 不适用/无目标 | — | — |
| `PluginSearchWidget` | 1.7.1 / STARTED | [1.7.1](https://www.halo.run/store/apps/app-DlacW/releases/app-release-oouqymo1) / 2025-09-09 | >=2.17.0 | 1.7.1 | 1.7.1 | 1.7.1 | — |
| `PluginFeed` | 1.5.0 / STARTED | [1.5.0](https://www.halo.run/store/apps/app-KhIVw/releases/app-release-x64igayx) / 2025-06-15 | >=2.21.0 | 无独立技能 | 1.5.0 | 1.5.0 | 1.5.0 |
| `app-store-integration` | 1.19.0 / STARTED | [1.19.0](https://www.halo.run/store/apps/app-VYJbF/releases/app-release-dtqssqka) / 2026-09-20 | >=2.26.0 | 无独立技能 | 不适用/无目标 | — | — |

技能适用性均为 `exact-baseline-only`；具体技能版本、知识修订、源文件摘要和官方文档地址见 JSON。16 个活动技能均已纳入，无遗漏。技能说明的三处边界经一手证据补齐：

- Douban：技能仍称公开仓库止于 1.2.0；执行日官方已有 [1.2.6 源码](https://github.com/chengzhongxue/plugin-douban/tree/33100c8d594e0b1bf7990befc1f426b68bbe54b5)。本轮读取该版本 manifest、维护者字段文档及真实 API，采用扁平字段契约。
- Docsme：技能正文的 9 月 5 日核对日期早于 1.10.0 的 9 月 18 日发布，本表重新使用官方发布页和当前发行包取证，不继承该日期。
- Bangumi：技能对非法参数的 404 描述过宽。1.4.1 [路由源码](https://github.com/Roozenlz/plugin-bilibili-bangumi/blob/87bcd652b6947b5bfd33035191ae5777e113ed01/src/main/java/top/roozen/bangumi/config/BangumiPluginConfig.java#L61)先把非数字页码回退至 1，再由 Finder 拒绝数值越界；实测相符。未修改共享技能文件。

### 预发布单列

Data Studio 的 GitHub Latest 标记不改变 `1.0.0-alpha.9` 的预发布性质；无正式版时不静默降低或伪造稳定目标。下表列官方市场当前页中最近一条预发布（其余多数早于已选正式版，均不作为目标）。

| 插件 | 预发布 / 日期 | 该预发布最低 Halo | 本轮处理 |
| --- | --- | --- | --- |
| `mcp-server` | [1.0.0-beta.1](https://www.halo.run/store/apps/app-ybv96zol/releases/app-release-4r3flh8m) / 2026-08-25 | >=2.26.0 | 排除；选择上表正式版 |
| `ai-foundation` | [1.0.0-beta.6](https://www.halo.run/store/apps/app-acslk9nu/releases/app-release-nwvytuqz) / 2026-07-29 | >=2.25.0 | 排除；选择上表正式版 |
| `plugin-bilibili-bangumi` | [1.4.1-beta.1](https://www.halo.run/store/apps/app-OTFPN/releases/app-release-zeazygej) / 2026-03-10 | >=2.21.0 | 排除；选择上表正式版 |
| `steam` | [0.2.0-beta.2](https://www.halo.run/store/apps/app-0ojqyzfh/releases/app-release-wsbxvnx6) / 2026-01-25 | >=2.22.1 | 排除；选择上表正式版 |
| `link-submit` | [1.0.0-beta.1](https://www.halo.run/store/apps/app-glejqzwk/releases/app-release-5bzud2bn) / 2025-06-13 | >=2.20.0 | 排除；选择上表正式版 |
| `data-studio` | [1.0.0-alpha.9](https://www.halo.run/store/apps/app-MrbzY/releases/app-release-jdujqc92) / 2026-04-08 | >=2.22.0 | 仅现有后台安装，等待稳定发布 |
| `PluginS3ObjectStorage` | [1.14.0-beta.1](https://www.halo.run/store/apps/app-Qxhpp/releases/app-release-0idwwuqx) / 2025-12-23 | >=2.22.0 | 排除；选择上表正式版 |
| `PluginPhotos` | [2.0.0-beta.2](https://www.halo.run/store/apps/app-BmQJW/releases/app-release-wtncoivo) / 2026-05-06 | >=2.22.0 | 排除；选择上表正式版 |
| `seo-tools` | [1.3.0-rc.3](https://www.halo.run/store/apps/app-FNGbT/releases/app-release-hsbzhsib) / 2025-06-13 | >=2.21.0 | 排除；选择上表正式版 |
| `PluginLinks` | [2.3.0-beta.4](https://www.halo.run/store/apps/app-hfbQg/releases/app-release-bg32rsaa) / 2026-08-04 | >=2.25.0 | 排除；选择上表正式版 |
| `PluginContactForm` | [1.2.0-rc.2](https://www.halo.run/store/apps/app-gSebd/releases/app-release-xcmy5i1j) / 2025-06-09 | >=2.21.0 | 排除；选择上表正式版 |
| `ai-assistant` | [3.0.0-beta.4](https://www.halo.run/store/apps/app-riNgb/releases/app-release-1fiszyal) / 2026-07-30 | >=2.25.0 | 排除；选择上表正式版 |
| `backup-improved` | [1.4.0-rc.2](https://www.halo.run/store/apps/app-dHakX/releases/app-release-pj2kwqj6) / 2025-06-12 | >=2.21.0 | 排除；选择上表正式版 |
| `plugin-ldap-login` | [1.3.0-rc.4](https://www.halo.run/store/apps/app-vrSqF/releases/app-release-kdnzesk0) / 2025-06-05 | >=2.21.0 | 排除；选择上表正式版 |
| `plugin-docsme` | [1.5.0-beta.1](https://www.halo.run/store/apps/app-yffxw/releases/app-release-xazkctqz) / 2026-03-10 | >=2.23.0 | 排除；选择上表正式版 |
| `plugin-oauth2` | [1.5.0-rc.1](https://www.halo.run/store/apps/app-ESVDK/releases/app-release-XLjfV) / 2024-10-30 | >=2.20.0 | 排除；选择上表正式版 |
| `plugin-social-login` | [1.7.0-beta.1](https://www.halo.run/store/apps/app-IXZkJ/releases/app-release-wnumu3tw) / 2026-03-10 | >=2.23.0 | 排除；选择上表正式版 |
| `restricted-reading` | [1.7.0-beta.1](https://www.halo.run/store/apps/app-TzRqd/releases/app-release-te3fqv25) / 2026-03-10 | >=2.21.0 | 排除；选择上表正式版 |
| `PluginCommentWidget` | [2.2.0-beta.1](https://www.halo.run/store/apps/app-YXyaD/releases/app-release-ersbz) / 2024-04-26 | >=2.15.0 | 排除；选择上表正式版 |
| `PluginFeed` | [1.1.0-beta.1](https://www.halo.run/store/apps/app-KhIVw/releases/app-release-zuBrT) / 2023-04-15 | >=2.0.0 | 排除；选择上表正式版 |
| `app-store-integration` | [1.10.0-beta.1](https://www.halo.run/store/apps/app-VYJbF/releases/app-release-oh0m7vl9) / 2025-05-14 | >=2.17.0 | 排除；选择上表正式版 |

### 逐插件结果

已验证 17 项、待运行验证 11 项、不适用 18 项、受阻 1 项。“代码适配完成，运行验证待完成”表示代码/静态契约已处理，不能写成已经兼容。已验证项的额外未测业务同样在剩余列列明。

#### 已验证

| 插件 | 目标及版本依据 | 实际修改 | 验证结果 | 剩余问题 / 适用范围 |
| --- | --- | --- | --- | --- |
| `plugin-douban` | [1.2.6](https://www.halo.run/store/apps/app-srBOL/releases/app-release-bcudqrjs) | 按 1.2.6 扁平 DTO 归一化，保留旧 spec/faves 兼容 | 真实 8 条标题/图片/外链，移动端、API 与 PJAX | 未触发同步或数据库迁移 |
| `online` | [1.0.5](https://www.halo.run/store/apps/app-ion2qhko/releases/app-release-jvggype9) | 保留统计读取与离页取消；WebSocket 仍由插件负责 | stats/summary API 与页面读取 | 未模拟 WebSocket 服务故障或多用户进度 |
| `dishes` | [1.0.3](https://www.halo.run/store/apps/app-espsmupa/releases/app-release-smxrkwj0) | 保留独立页面整页导航，无须复制 SPA | 公开页读取；本轮真实整页导航通过 | 未点餐或导入备份 |
| `schedule-calendar` | [3.5.0](https://www.halo.run/store/apps/app-1ubowut0/releases/app-release-mdsorinh) | 3.5 模板委托保留官方页面及整页导航 | 公开日历页/摘要读取；本轮整页导航通过 | 自定义路由与日程写入未执行 |
| `equipment` | [1.1.1](https://www.halo.run/store/apps/app-ytygyqml/releases/app-release-xty8o5xa) | 保留 equipmentFinder 与分组/cover/url 结构 | 实际页面、分组 SSR、PJAX | 未修改装备或分组 |
| `plugin-bilibili-bangumi` | [1.4.1](https://github.com/Roozenlz/plugin-bilibili-bangumi/releases/tag/1.4.1) | 保留 1.4 路由/Finder，目标采用 GitHub 1.4.1 | 列表、参数默认值/越界路径、PJAX | page=bad 回退 1 页返回 200；page=0 与非法状态为 404；不扩大技能对非法参数的概述。 |
| `steam` | [1.0.0](https://www.halo.run/store/apps/app-0ojqyzfh/releases/app-release-ck4zbqkk) | 保留 camelCase VO、空封面和 delisted 分支 | 实际页面、公开 API、PJAX | 外部 Steam 断网/空配置状态未改造现场 |
| `shiki` | [1.5.1](https://www.halo.run/store/apps/app-kzloktzn/releases/app-release-mzrz7aqk) | 修复原生 pre code 空白继承；保留宿主去嵌套 | 26 个高亮内容、PJAX、明暗、390px 无溢出 | 未穷举所有语言及自定义渲染规则 |
| `PluginLightGallery` | [1.2.1](https://www.halo.run/store/apps/app-OoggD/releases/app-release-LPQbl) | 保留单实例初始化/销毁与 data-src 桥接 | HTTP/页面契约；本轮真实图片灯箱打开通过 | 未穷举全部媒体格式 |
| `PluginPhotos` | [2.1.2](https://www.halo.run/store/apps/app-BmQJW/releases/app-release-hxm5qfoy) | 保留 photoUrl、空邻居、分组与灯箱桥接，无新增接口差异 | 列表/详情 HTTP、PJAX；本轮真实图片灯箱操作通过 | 未修改照片数据；未穷举全部 EXIF 类型 |
| `seo-tools` | [1.10.1](https://www.halo.run/store/apps/app-FNGbT/releases/app-release-zemd61lg) | 保留统一 Head；无前台接口变更 | 读取检查与八条 PJAX 路由的单一 canonical/description | 未调用搜索引擎推送 |
| `PluginLinks` | [2.3.0](https://www.halo.run/store/apps/app-hfbQg/releases/app-release-rpaiuvqj) | 新增官方 REST 申请适配；修复首页分组选取；保留 RSS 隐私门控 | 真实列表/RSS/评论宿主、PJAX；申请仅替身回归 | 正式申请开关关闭，未执行申请与审核写入 |
| `PluginMoments` | [1.19.0](https://www.halo.run/store/apps/app-SnwWD/releases/app-release-uip7zlta) | 保留 releaseTime、作者为空降级和媒体生命周期 | 列表/详情/RSS API、PJAX | 发布/上传/删除未执行；缺失作者实站样本待验 |
| `plugin-docsme` | [1.10.0](https://www.halo.run/store/apps/app-yffxw/releases/app-release-vuhmiwq1) | 保留官方片段、权限分支和 DocTree 评论主体 | 项目/目录/正文读取、PJAX | 许可证切换及三种未授权模式未制造状态测试 |
| `PluginCommentWidget` | [3.3.2](https://www.halo.run/store/apps/app-YXyaD/releases/app-release-e6j0ni2s) | 动态核对实际资源版本，保留 CSS 变量与 subject | 3.3.2 资源 GET、懒挂载单实例、配置/列表读取 | 图片上传、发布、审核、ALTCHA/Turnstile 未执行 |
| `PluginFeed` | [1.5.0](https://www.halo.run/store/apps/app-KhIVw/releases/app-release-x64igayx) | RSS 自动发现契约保留，无需新增改动 | feed.xml 与 Head 链接读取 | 未触发订阅外部业务 |
| `PluginSearchWidget` | [1.7.1](https://www.halo.run/store/apps/app-DlacW/releases/app-release-oouqymo1) | 保留 SearchWidget.open、主题配色标记和官方资源，无需改接口 | 真实查询、空结果、输入焦点、键盘选中并进入文档、Escape 关闭 | 未改变索引配置；排序和索引完整性属于插件后台范围 |

#### 待运行验证

| 插件 | 目标及版本依据 | 实际修改 | 验证结果 | 剩余问题 / 适用范围 |
| --- | --- | --- | --- | --- |
| `plugin-katex` | [3.0.0](https://www.halo.run/store/apps/app-ISCsX/releases/app-release-l4qbvcue) | 保留预渲染公式样式和 data-pjax 客户端兼容路径 | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 3.0 旧文章需要插件客户端开关；本轮未重存文章或调整设置 |
| `maintenance` | [1.1.0](https://www.halo.run/store/apps/app-umgvtji6/releases/app-release-ecm0eqla) | 保留独立维护模板、title/description 和返回入口 | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 未切换全站维护状态，实际拦截与恢复待验 |
| `lottery` | [1.0.2](https://www.halo.run/store/apps/app-8wtcwm5t/releases/app-release-6dooiafp) | 保留 lottery-card 宿主及实际版本资源检查 | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 文章有宿主但活动不存在；参与/开奖不可验证 |
| `auth-passkey` | [1.0.4](https://www.halo.run/store/apps/app-g7tggrco/releases/app-release-gqo1e59a) | 保留 halo-form、认证片段和 remember-me | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 未使用真实 Passkey 绑定/登录/删除，不能仅凭模板断言兼容 |
| `vote` | [1.1.3](https://www.halo.run/store/apps/app-veyvzyhv/releases/app-release-np8tb8nv) | 保留 25 个变量与投票宿主布局 | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 宿主显示先前核对；实际投票、重复限制和错误态未验收 |
| `text-diagram` | [1.5.2](https://www.halo.run/store/apps/app-ahBRi/releases/app-release-rqudxdgh) | 保留补渲染队列、明暗重绘和插件资源 | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 缺真实绘图内容样本；不将静态检查当运行通过 |
| `plugin-friends` | [1.4.6](https://www.halo.run/store/apps/app-yISsV/releases/app-release-nc8mxddx) | 保留 Finder 门控和现有朋友圈模板 | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 插件禁用；未启用或测试与 Links 2.3 的组合启动 |
| `PluginContactForm` | [1.6.4](https://www.halo.run/store/apps/app-gSebd/releases/app-release-mnsixhfk) | 保留 21 个变量、3 类宿主与官方 Loader | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 缺表单样本；上传/提交/弹窗待运行验证 |
| `ai-assistant` | [3.0.0](https://www.halo.run/store/apps/app-riNgb/releases/app-release-lsh7g0yx) | 保留 ai-summary-widget 与 4 个公开变量 | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 依赖已启动；前序临时挂载显示通过；自动摘要关闭、无模型，自动注入/生成待验 |
| `editor-hyperlink-card` | [1.9.2](https://www.halo.run/store/apps/app-UpUJA/releases/app-release-epm4pje4) | 保留块级/行内宿主和资源加载 | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 资源/宿主 HTTP 已通过；外部抓取失败与全部交互待验 |
| `restricted-reading` | [1.9.1](https://www.halo.run/store/apps/app-TzRqd/releases/app-release-1avdqral) | 保留 content-restrict-widget 与登录/评论主体 | 代码适配完成，运行验证待完成（部分读取证据不替代完整流程） | 缺受限内容样本；各解锁模式待运行验证 |

#### 不适用

| 插件 | 目标及版本依据 | 实际修改 | 验证结果 | 剩余问题 / 适用范围 |
| --- | --- | --- | --- | --- |
| `mcp-server` | [1.2.0](https://www.halo.run/store/apps/app-ybv96zol/releases/app-release-on4pkzby) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 后台 MCP 工具/密钥能力；无前台宿主；未创建密钥或授权工具 |
| `ai-foundation` | [1.1.0](https://www.halo.run/store/apps/app-acslk9nu/releases/app-release-zqvdpyu1) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | AI 供应商/模型和 SDK 依赖；无主题模板；已启动，未配置模型或测试调用 |
| `PluginLive2d` | [2.2.0](https://www.halo.run/store/apps/app-oPNFQ/releases/app-release-wyldvl72) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 已禁用且主题无专用集成；2.2 移动端/Markdown 浮层由插件负责 |
| `editor-emoji` | [1.1.0](https://www.halo.run/store/apps/app-pwojlwgu/releases/app-release-j3solsy2) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 后台 Emoji 扩展；1.1 优化 Halo 2.26 加载，无主题 API 差异 |
| `link-submit` | [1.0.7](https://www.halo.run/store/apps/app-glejqzwk/releases/app-release-okiwoznl) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 已禁用且主题已退出该集成；由 Links 2.3 官方申请接口承接 |
| `PluginS3ObjectStorage` | [1.17.0](https://www.halo.run/store/apps/app-Qxhpp/releases/app-release-hdy1v1xf) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 附件存储；1.17 缩略图格式修复由插件处理，不迁移附件 |
| `PluginBytemd` | [1.9.0](https://www.halo.run/store/apps/app-HTyhC/releases/app-release-fvqxsvlk) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 后台 Markdown 编辑器；1.9 粘贴/拖拽上传不改变主题正文契约 |
| `hybrid-edit-block` | [1.7.0](https://www.halo.run/store/apps/app-NgHnY/releases/app-release-lgexvgkn) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 后台混合编辑块；1.7 ESM/CodeMirror 变更，无需重写主题 |
| `chenhe-lsky-pro` | [1.1.2](https://www.halo.run/store/apps/app-jZHhX/releases/app-release-soqqub9p) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 附件存储；1.1.2 文件名/MIME 改动由存储侧处理 |
| `page-cache` | [1.6.0](https://www.halo.run/store/apps/app-BaamQ/releases/app-release-dgt4lgbd) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 运行缓存；1.6 清理角色变更，主题继续用版本化静态资源；未清缓存 |
| `content-tools` | [1.8.0](https://www.halo.run/store/apps/app-SUvBR/releases/app-release-58jwitjo) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 后台格式转换；1.8 适配 Halo 2.26，保持正文容器即可 |
| `alist-integration` | [1.2.0](https://www.halo.run/store/apps/app-wEGMV/releases/app-release-d2ydr0xa) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 附件存储；1.2 访问前缀由存储侧负责，不改变主题展示接口 |
| `backup-improved` | [1.5.1](https://www.halo.run/store/apps/app-dHakX/releases/app-release-3qec25tx) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 备份/通知后台任务；1.5.1 修复重复通知，无主题接口 |
| `plugin-ldap-login` | [1.3.0](https://www.halo.run/store/apps/app-vrSqF/releases/app-release-wf3uzfck) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | LDAP 用户与权限；1.3 后台同步改动，无新增主题代码 |
| `plugin-oauth2` | [1.7.1](https://www.halo.run/store/apps/app-ESVDK/releases/app-release-jsoz5qnd) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | SSO 配置/认证提供者；1.7.1 配置扩展，保留 Halo 认证片段 |
| `plugin-social-login` | [1.7.0](https://www.halo.run/store/apps/app-IXZkJ/releases/app-release-dbseugob) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 第三方认证提供者；1.7 Halo 2.23 适配，无主题专用接口变更 |
| `PluginSitemap` | [1.3.0](https://www.halo.run/store/apps/app-QDFMI/releases/app-release-lytd42sz) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | XML 输出服务；1.3 移除非必要字段并修复 URL 转义；未发现插件路由覆盖 |
| `app-store-integration` | [1.19.0](https://www.halo.run/store/apps/app-VYJbF/releases/app-release-dtqssqka) | 无需主题代码改动 | 仅版本、清单及适用范围核对，不声明主题兼容 | 应用安装/许可证 Console；1.19 免费额度变化，无主题契约 |

#### 受阻

| 插件 | 目标及版本依据 | 实际修改 | 验证结果 | 剩余问题 / 适用范围 |
| --- | --- | --- | --- | --- |
| `data-studio` | 无稳定版 | 无前台主题契约，不安装或替换预发布 | 官方稳定目标不存在 | 1.0.0-alpha.9 仍是预发布，等待官方稳定版 |

### 具体缺陷、原因及修复

1. **豆瓣 1.2.6 数据丢失**：`src/pages/douban/douban.js` 仍读取 `item.spec` / `item.faves`，但公开 API 已改为 `name/poster/link/favesCreateTime/favesRemark` 等扁平字段。新增 `src/apps/douban/model.js` 统一新旧结构；实站从 8 个“未命名条目”、0 张封面恢复为 8 个正确标题、8 张封面和有效外链。
2. **Links 首页选择分组报 EL1008E**：`templates/modules/widgets/links.html` 的 SpEL 集合选择会把当前对象切换为 LinkGroupVo；`linksSettings` 是页面变量，改为 `#root.linksSettings`。这不是 Links 2.3 删除了对象字段。真实 Thymeleaf/Spring 表达式测试覆盖不筛选、选中、选不到三个分支。
3. **Links 2.3 访客申请接口缺失**：在既有申请表中加入官方 REST CAPTCHA 与申请接口、反链地址和各类失败提示。仅在插件 >=2.3 且 `linkApplicationEnabled` 为 true 时显示，保留管理员创建及留言降级。所有公开申请请求 `credentials: omit`，提交结果后更新一次性验证码，失败保留输入；不会启用旧 Link Submit。
4. **代码块换行丢失**：行内代码的 `white-space: nowrap` 命中了 `pre code`。在 `src/static/css/article-content.css` 恢复 `white-space: inherit`；浏览器原生三行代码恢复为三行，Shiki 1.5.1 的 Shadow DOM 高亮保持正常。
5. **公共布局入口缺失**：新增 `templates/layout.html` 的 `html(head, content)`，自定义 head 与默认标题互斥，正文不依赖 post/singlePage，通过公共 footer 保留一次插件注入；该类插件页采用完整文档生命周期。Reload 后 Halo 状态为 `SUPPORTED`。契约依据：[Halo 2.26 布局文档](https://docs.halo.run/developer-guide/theme/page-layout)。
6. **检查脚本把旧资源版本写死**：评论 3.3.2、受限阅读 1.9.1 等资源校验改为匹配实际安装版本并以 GET 检查 JavaScript 可访问性；不再拿 3.1.2/1.8.1 作为当前运行时的唯一合法 URL。新增豆瓣条目结构检查，避免仅有空页面容器就判定通过。
7. **旧静态资源被长期缓存**：资源响应为一年缓存。将主题/package 版本一并提高到 2.2.39，重建并重载本地主题，普通页面已引用新版本 URL。没有修改用户插件缓存配置。

8. **版本匹配被误报为已测试**：`scripts/check-plugin-versions.mjs` 原先只比较插件版本就返回 `tested`，未绑定 Halo/代码/配置。本轮改为 `version-match` 并明确仅代表历史版本号匹配；统计字段改为 `versionMatches`。新增 `scripts/theme-code-identity.mjs` 与页面 `--report` 输出，将实际 Halo、插件清单、代码内容和结果放在同一记录；测试期间代码变化会拒绝通过。
9. **契约标识混用仓库别名**：将 Steam、Equipment、Shiki 的矩阵主键改为 manifest ID `steam`、`equipment`、`shiki`，原别名保留用于解析，不改插件版本或运行设置。

### 本轮验证

- Node 24.18.0 / pnpm 10.34.5：lint、完整构建、类型/契约/Links/升级回归、代码指纹回归、SEO、产物与安装包检查全部通过。
- `http-tests.json`：37 项通过，禁用 Friends 跳过 1 项；当前 Halo=2.26.1，47 个实际插件版本均附在记录内，测试期间内容指纹未变化。
- `browser-tests.json`：21 项通过，覆盖八条实际 PJAX 路由、Douban 8 条真实数据和 8 张图片、评论懒挂载、Shiki 26 块高亮/明暗/移动端、真实灯箱，Dishes/Schedule 整页导航，以及搜索查询、空态和键盘导航。
- `boundary-tests.json`：非数字 Bangumi 页码回退、数值越界 404、错误状态 404、缺失照片 404；遵循当前官方源码。

复现当前代码标识及读取测试：

```bash
npx --yes --package=node@24.18.0 node --input-type=module -e 'import { themeCodeIdentity } from "./scripts/theme-code-identity.mjs"; console.log(themeCodeIdentity())'
VERIFY_PLUGIN_DEEP=1 PHOTO_DETAIL_URL=/photos/photo-lglk3ors \
MOMENT_DETAIL_URL=/moments/moment-f6ircurs SHIKI_PAGE_URL=/archives/lKkDC8OW \
HYPERLINK_CARD_PAGE_URL=/archives/editor-feature-demo LOTTERY_PAGE_URL=/archives/ijhJxHtw \
npx --yes --package=node@24.18.0 node scripts/verify-plugin-pages.mjs --report=/tmp/halo-plugin-http-tests.json
```

样本路径属于本地实例，不应在另一个站点直接沿用。指纹或环境变化时应重新测试，不能只复制本报告的 Tested 值。

### 前序同日 AI 恢复记录（本轮未再启停）

前序同日还完成过 `37/37` HTTP/API 检查与九条 PJAX 路由回归，交付包 SHA256 为 `6f070251e3eb0be5d867c575b144179627e2ecffc76c76559426ceadb4bf74de`。当时没有采集当前格式的代码内容指纹，因此保留为历史证据，不用本轮指纹倒填；本轮构建/页面记录及包摘要见 [validation.json](./evidence/2026-09-22/validation.json)。

- 初始启动失败堆栈为 `NoClassDefFoundError: run/halo/aifoundation/media/GeneratedFile`，触发点为 AI 助手的 `EditorGeneratedAttachmentRegistry`。依赖由 AI Foundation 提供，与主题 CSS 无关。
- 用户授权后，复查时 AI Foundation 1.1.0 已为 `STARTED`，本任务没有重复安装。官方 Release 文件与本地安装 JAR 的 SHA256 均为 `d8f906657b7e36f38841caf748d0e630b6df89d1257907fb70d809557713f111`。随后仅对 `ai-assistant` 执行关闭、开启，等待状态协调完成；`2026-09-22T01:35:18.840630937Z` 记录为 `Started`，最终两者均启动正常。
- 读取配置确认 `summary.enabled=false`、尚未选择 `modelName`，故文章不注入摘要；没有修改这些设置。现存 50 条摘要，公开 `GET /apis/api.ai.halo.run/v1alpha1/summary` 读取既有内容返回 200；已从当前 JAR 核对该 GET 只查询记录，不触发生成。
- 3.0.0 的摘要 JS/CSS 均返回 200；在浏览器页面临时挂载官方 `ai-summary-widget`，读取一条真实既有摘要，四个 `--halo-asw-*` 变量生效，明暗正常，390px 视口宽度与页面宽度均为 390px。测试后整页导航移除临时节点。**这是组件展示验证，不是服务端自动注入或模型生成验收**，因此当前矩阵保持 `confirmed`，不填写新的 `testedVersion`。

### 剩余边界

- 自动摘要关闭、未选择模型；本轮没有模型迁移授权。完整摘要注入/生成、RAG 和编辑器 AI 仍待独立验收。
- Friends、Live2d、Link Submit 未启用；未制造评论、申请、投票、上传、维护或授权状态来补齐样本。具体待验及不适用项已逐项列明。
- Sitemap 当前 XML 不含 Moments/Photos/Docs/Links 路由，属于插件覆盖边界；不另造重复 XML。
- 原 Issues 中字体 CDN 证书及分类“自动加载 + 页码并存”未在本轮插件适配范围内修复。

## 历史快照（2026-07-17 / 2026-07-28）
> 快照日期：2026-07-17（含 `2.2.34` 本轮热加载复验）
> 目标实例：本地容器 `halo`，Halo Pro `2.25.4`，`http://localhost:8090`
> 2026-07-17 快照主题：`theme-sky-blog-1 2.2.34`（live mount + Theme Reload API）

本报告初始审计基于 `2.2.23`，当前结论已合并 `2.2.34` Build、Reload 和页面缓存刷新后的验证。它只记录该实例在快照时刻的安装状态和真实页面证据，不替代[插件适配矩阵](./plugin-adaptation.md)中的主题契约。`通过` 只表示列出的表面已通过，未执行提交、登录、上传、评论等会修改数据的操作。

## 2026-07-28 增量复验（主题 2.2.36 → 2.2.37）

本节记录当前主 Halo 的新状态，不改写上方 `2026-07-17 / 2.2.34` 历史快照。

- 主实例仍为本地容器 `halo`、Halo Pro `2.25.4`、端口 `8090`。主题 `2.2.37` 已完成 Build 和压缩包内二次校验，Theme Reload API 与页面缓存刷新接口均返回 200，控制台状态为 `READY`。
- 当前矩阵包含 28 个主题契约，45 个已安装插件中有 17 个在矩阵外。`PluginLinks 2.2.1` 已提升为 `contractVersion=testedVersion=2.2.1`；`link-submit` 已退出主题集成并进入矩阵外。Halo API 仍将 `plugin-friends 1.4.6` 与 `link-submit 1.0.7` 列为已安装但 `DISABLED`，它们不参与本轮 Links 独立适配结论。
- 读取型路由烟测通过：基础检查 `11/11`，另跳过 1 个禁用 Friends 路由；深度检查 `31/31`，另跳过该禁用路由。深度检查覆盖 Links 全部页面、动态发现的非空分组、真实空分组、不存在分组、7 条状态数据、3 个分组和 20 条公开 Feed API 数据。
- Links 页面采用 2.2.1 的 `linksTitle` 安全回退、访问/反链状态枚举和 `linkFeedFinder`。根页面实际渲染 7 张卡片、7 个状态和 8 条最近动态；命名分组仅渲染对应链接，真实空分组与不存在分组使用不同空态；公开 HTML 不含 Feed 源地址，也不再请求 Link Submit JS/CSS。
- 真实浏览器链路为首页 → Links → 非空组 → 空组 → 后退/前进 → 首页 → 再次进入。每一步保持单 canonical、单 description、单 `main`、单评论宿主和单 `#swup`；状态与 Feed 随路由正确收敛。390×844 同源移动视口为 390px，文档无横向溢出，卡片与 Feed 宽度均为 358px。
- 18 个真实布局统一接入 `seo-head`。标准 `description` 由主题在 Halo/插件未提供时补齐；SEO Tools 1.9.5 启用时独占 canonical、Open Graph、Twitter Card 与 JSON-LD，主题降级标记为 0，避免双 canonical 和重复结构化数据。插件不可用时的 SSR 降级已单独验证 canonical、社交标签和 JSON-LD 可解析。
- 真实页面验证覆盖首页、归档年/月分页、分类/标签分页、瞬间列表与详情、图库列表与详情、Docs 列表与详情。canonical 和标准 description 均保持单例，页面主体保持单 `main`；Docs 正文自身可包含内容级 H1，不由主题删除。
- 真实 PJAX 往返验证覆盖首页、瞬间、分类、Docs 与图库，并检查前进/后退后的 Head 收敛：旧页面 JSON-LD/Open Graph 不残留，SEO Tools 与主题降级不会同时输出。开发者模式关闭时，本轮未出现 `[SkyDebug:*]` 日志或控制台错误。
- 集合分页的新链接统一使用 `?p=`，兼容 SEO Tools 1.9.5 的 canonical 参数白名单；旧 `?page=` 仍可读取，但 canonical 会被插件归一到集合根路径。Photos 与 Bangumi 仍使用各自上游查询参数，分页 canonical 的精细化需要 SEO Tools 扩充白名单。
- `PluginSitemap 1.3.0` 仍未收录多类插件页面；SEO Tools 对部分插件页缺少专用 Open Graph/JSON-LD 生成器。这两项属于上游覆盖缺口，主题选择单一 Head 所有权，避免通过重复标签伪修复。
- 新增 `pnpm verify:seo` 与 `pnpm verify:seo:package`：工作树和最终 zip 都必须通过布局接管、canonical 所有权、鉴权页 noindex、图片 alt、H1、分页锚点和 `main` 所有权门禁。

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
| `alist-integration 1.2.0`      | AList 附件存储         | 已启动；无可追溯上传与展示样本                                                                               | 不纳入主题契约；用户已明确排除本项目修复和验收，不据此认定 Moments 发布链兼容                                                                       |
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
