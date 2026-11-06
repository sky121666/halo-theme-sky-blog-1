# 2026-11-01 全局审计修复与路由复验

**本批确认的主题问题已修复；当前代码的 32 类代表页面和相关交互通过，未发现新的已确认主题回归。** 本批继续检查模板、插件数据消费和浏览器生命周期；只修复有触发条件和证据的问题。没有修改插件、数据库、认证配置、站点业务设置或正文，没有暂存、提交、推送或发布。保留此前未提交改动。

## 环境和版本边界

- 实际环境：localhost:8090，Halo Pro **2.27.1**，46 条插件安装记录；详细实装版本见本批证据。
- 主题：候选 **2.2.41**，最低要求 **>=2.27.0**；活动主题仍是 theme-sky-blog-3，验收使用 `preview-theme=theme-sky-blog-1`。
- Node **24.21.0** / pnpm **12.6.0**。
- 最终代码指纹：`aa552cc833c3e494cac00b72f29b095ef6003c11cd8161ed61937878e9950a3a`，401 个源码、模板、构建和脚本输入文件；基础提交 `5323cb64b859334b19f8aa6787eac4f4eb1a98ae` 未变。
- 本批没有重新核对全部官方发行版本。官方稳定目标仍指向 2026-10-27 版本审计；技能基线、接口契约、实装和本次实测组合分别保留，不把旧基线改成“当日最新”。
- 模板与 Page Cache 已刷新，50/50 服务端资源哈希与磁盘匹配。浏览器每轮禁缓存并重新设置视口；短屏弹窗曾因测试脚本漏禁浏览器缓存而读到旧 CSS，该结果作废，确认新规则生效后重测。

## 本批修改和人工检查方法

下表 URL 均需添加 `?preview-theme=theme-sky-blog-1`。非默认配置通过真实 Thymeleaf 片段和临时 DOM 验证，没有改站点配置。

| 路由/范围 | 触发问题 | 修复及检查方法 |
|---|---|---|
| 所有 PJAX 页面，代表 `/archives/editor-feature-demo` | 页面模块超过 5 秒未加载时，旧兜底提前恢复 Alpine；模块晚到后初始化遗漏。 | 成功才恢复，超时或失败用当前 URL 整页重载；旧导航任务不能刷新新页。浏览器延迟 6.5 秒/一次资源失败后，文章 7 个标题入口恢复，预览参数、锚点、返回目标保留。异常重载可能中断跨页音乐续播。 |
| `/archives/editor-feature-demo`、`/docs/halo-theme-sky-blog-1/theme-settings/global` | 自动生成标题 ID 与已有 ID 冲突；文档标题 ID 含引号、反斜杠时 CSS 选择器失效。 | 预留文档已有 ID，缺失 ID 才生成唯一值；高亮按 dataset 原值比较。临时四标题样本验证唯一 ID、特殊字符定位和手机抽屉关闭，原作者 ID 保留。 |
| `/equipments`，tech/simple 两种风格 | 空值规格可能产生数组越界；多个冒号截断 URL、比例；完整长 URL 令网格列越界。 | 仅按首个中/英文冒号分隔，忽略空键/值，保留完整值和进度语法；可收缩列与长值换行。检查完整 URL、`16:9`、中文冒号、80% 进度及空行，两端四种组合通过。 |
| `/douban` | 请求未完成时连续“下一页”跳过页码，可能显示超出末页的空列表。 | 当前分页请求期间锁定翻页，使用真实 hasNext/hasPrevious；筛选仍可取消旧请求。延迟响应下两次点击只请求一次第 2 页；末页禁用，旧筛选响应不能解锁新请求。 |
| `/steam` | `YYYY-MM-DD` 作为 UTC 时间解析，西侧时区的浮层日期少一天。 | 日历日期直接读取月/日。实际浏览器在洛杉矶、上海时区悬停，浮层日期与格子 data-date 一致。 |
| `/moments` 发布弹窗 | 390×480 短屏加图片后，面板高 600px，顶部 -60px、底部 540px，操作超出视口。 | 面板按动态视口限高，仅表单内容滚动，操作头部保留。修复后面板 16–464px，表情位于视口内，取消恢复焦点和页面滚动；上传/权限响应隔离，未发布内容。 |
| `/authors/sky0821` 的瞬间标签 | 超过 9 张的历史图片被截断，第十张没有有效查看入口。 | 保留所有已有图片与原图链接，去掉无功能遮罩；十图真实模板在桌面/手机均能显示第十张，不改变官方发布附件上限。 |
| `/login`、`/signup`、`/password-reset/email` 共用 features 布局 | 已配置 SVG 图标未输出；无 Logo 时渲染空图片。 | 输出已有配置中的 SVG，无配置保留默认图标；Logo 为空不生成 img。默认/自定义/无 Logo 三组两端验证，手机按原设计隐藏品牌列。 |
| `/categories` | 关闭侧栏时读取了错误变量，未按原设计居中限宽。 | 读取实际 sidebarCfg.show_sidebar；无侧栏模板两端居中，桌面最大宽度 1152px。 |
| `/about` | 开启统计卡、关闭日历时没有配色探针，统计卡退回固定颜色。 | 两种卡任一启用即提供隐藏探针；明暗主题生成不同颜色参数。外部统计服务被隔离，仅验证主题 URL 参数，不宣称远端成功。 |
| 全站页脚 `/privacy`、关于页可配置 CTA | 原始动态 href 绕过 Halo LinkBuilder，预览中的站内跳转可能回到活动主题。 | 站内可配置地址使用 Thymeleaf `@{...}`；关于页纯锚点保持原值。真实点击隐私链接仍在主题 1，当前 About 锚点和外链保留。 |

## 官方方法与主题责任

- 动态导航 URL 使用 [Halo 官方 Thymeleaf 方法](https://docs.halo.run/developer-guide/theme/thymeleaf)，并核对 [Halo 2.27.1 ThemeLinkBuilder](https://github.com/halo-dev/halo/blob/v2.27.1/application/src/main/java/run/halo/app/theme/ThemeLinkBuilder.java)。纯锚点不强制包装，避免添加预览参数改变原滚动行为。
- 模块载入、导航恢复遵循 [Swup Scripts Plugin](https://swup.js.org/plugins/scripts-plugin/) 与 [Hooks](https://swup.js.org/hooks/) 的生命周期边界；失败恢复采用浏览器 [Location.reload](https://developer.mozilla.org/en-US/docs/Web/API/Location/reload)。超时和代次保护是主题内部策略，不是插件新 API。
- 日期修正依据 [Date.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse) 对纯日期字符串的 UTC 解释；日历标签不应转换为本地时间瞬间。
- 其余修复消费现有插件字段、主题配置和原生 DOM/CSS，没有新增插件不存在的接口或功能。未修改 Equipment 分页服务端逻辑、Redis 或评论 provider。

## 设计规范判断

本批保持 `docs/theme/base/general.md`、`docs/theme/base/nav.md` 和既有设置的字体、daisyUI 语义色、明暗模式、响应式断点与图标策略。没有把图标按钮全部变成文字，没有另换组件库或皮肤。装备修复只保证值在卡片内；短屏弹窗只调整滚动容器；分类修复恢复已有无侧栏设计；认证图标修复恢复用户已配置内容。

`design-qa.md` 只用于 Links，不扩大为全站规范。当前没有完整的全站逐像素设计稿，因此结论是“本批改动符合已明确的约束”，不宣称所有皮肤逐像素一致。明暗、减少动画和 Links 导航状态另作回归。

## 验证结果

| 检查 | 实际结果 |
|---|---|
| `pnpm run build-only` | 434 项 Node 回归全部通过，0 失败、0 跳过；typecheck 和产物验证通过。 |
| lint / format / diff | `pnpm run lint`、`pnpm run format:check`、`git diff --check` 均退出 0。 |
| 真实模板 | 141/141 数据断言；评论模板 228 场景、652 断言通过。 |
| 全局 HTTP | 121 条：119 个 200；`/terms` 和故意不存在的路径是预期 404，无 500。Dishes/Schedule 独立页面身份差异属于预期。 |
| 插件只读探针 | 41 通过、0 失败、7 未覆盖。不是 41 个插件所有业务通过。 |
| 最终浏览器巡检 | 32 类路由 × 1440/390 共 64 次；首屏及滚动检查未记录未处理 JS 异常、横向溢出、可见坏图、可见无名按钮；64 张底部截图已目视检查。 |
| 专项 | 模块慢加载/失败恢复 2 组、真实模板配置 16 组、目录/豆瓣/时区/预览链接 9 组，以及 390×480 发布弹窗通过。 |
| 交互回归 | 16 次共享页面、6 次分享弹窗；文档同 document PJAX/返回/迟到复制清理、Links 三视图、Dock、明暗与减少动画通过。 |
| 图库 | 桌面/手机 20→40→46，灯箱遮罩保留；滚动值未回顶，可见照片偏移 0px / -0.46875px。 |
| 独立复核 | 当前任务差异复核无新增确认缺陷；页脚空值的怀疑由真实 Thymeleaf 对照否定，未作为修复成果。 |

最终后端采样窗口为北京时间 **2026-11-01 00:08:27–00:24:08**：56 INFO、36 WARN、4 ERROR。其中 27 条插件分页上限、8 条模板处理中断、1 条外部 RSS 刷新告警；4 条 ERROR 来自排除范围的 AList。模板表达式/解析错误分类为 0；处理中断尚未按请求定位原因，不宣称后端零异常。

[本批脱敏版本组合和验证证据](./evidence/2026-11-01/global-audit-repairs.json)与本报告共同保存本次结果；此前历史指纹、截图和环境失败记录保留，不覆盖、不冒充本次验收。临时浏览器空间 68 已关闭，Halo 服务继续运行。

## 验证边界

- 7 项插件业务未覆盖：Text Diagram、内嵌 Contact Form、AI Summary、Shiki 代表代码块、Lottery Card、Restricted Reading、Maintenance Theme。它们不是七个已确认故障，也没有宣称本轮业务兼容通过。
- AI 和 Passkey 的真实业务保留用户此前手测来源；本批认证页只读展示和交互不替代真实登录。
- AList 排除；Friends 已由 Links 承接；Dishes 和 Schedule 使用插件独立页，预期不加载主题 1 的完整资源，不强行覆盖。
- 不修改站点业务数据；非默认配置、竞态和上传使用明确隔离的模板/只读响应/内存替身，不冒充真实业务提交。
- 模板处理中断告警需请求级证据才能归因，不能据关键字直接认定主题语法错误；插件分页上限也不转为主题修复项。
- 本轮未升级浏览器工具。临时截图和完整日志保留在 `/tmp/sky-global-round2-20261031/`，不添加到 Git；长期记录只保留脱敏证据。

## 本轮全局浏览器路由

下列 32 类页面均以 1440×900 和 390×900 巡检首屏、滚动中段及底部。代表页不等同于全站每个内容实例、全部配置组合或真实业务写入。

| 类型 | 人工核查 URL |
|---|---|
| home | [/](http://localhost:8090/?preview-theme=theme-sky-blog-1) |
| archives | [/archives](http://localhost:8090/archives?preview-theme=theme-sky-blog-1) |
| archive-month | [/archives/2025/08](http://localhost:8090/archives/2025/08?preview-theme=theme-sky-blog-1) |
| post | [/archives/editor-feature-demo](http://localhost:8090/archives/editor-feature-demo?preview-theme=theme-sky-blog-1) |
| author | [/authors/dev-acceptance-buyer-20261023](http://localhost:8090/authors/dev-acceptance-buyer-20261023?preview-theme=theme-sky-blog-1) |
| categories | [/categories](http://localhost:8090/categories?preview-theme=theme-sky-blog-1) |
| category | [/categories/ai](http://localhost:8090/categories/ai?preview-theme=theme-sky-blog-1) |
| tags | [/tags](http://localhost:8090/tags?preview-theme=theme-sky-blog-1) |
| tag | [/tags/halo](http://localhost:8090/tags/halo?preview-theme=theme-sky-blog-1) |
| tag-empty | [/tags/pod](http://localhost:8090/tags/pod?preview-theme=theme-sky-blog-1) |
| page | [/privacy](http://localhost:8090/privacy?preview-theme=theme-sky-blog-1) |
| about | [/about](http://localhost:8090/about?preview-theme=theme-sky-blog-1) |
| docs | [/docs](http://localhost:8090/docs?preview-theme=theme-sky-blog-1) |
| doc-catalog | [/docs/halo-theme-sky-blog-1/theme-settings](http://localhost:8090/docs/halo-theme-sky-blog-1/theme-settings?preview-theme=theme-sky-blog-1) |
| doc | [/docs/halo-theme-sky-blog-1/theme-settings/global](http://localhost:8090/docs/halo-theme-sky-blog-1/theme-settings/global?preview-theme=theme-sky-blog-1) |
| links | [/links](http://localhost:8090/links?preview-theme=theme-sky-blog-1) |
| feeds | [/links?view=friends](http://localhost:8090/links?view=friends&preview-theme=theme-sky-blog-1) |
| apply | [/links?view=apply](http://localhost:8090/links?view=apply&preview-theme=theme-sky-blog-1) |
| photos | [/photos](http://localhost:8090/photos?preview-theme=theme-sky-blog-1) |
| photo | [/photos/photo-14xk1htg](http://localhost:8090/photos/photo-14xk1htg?preview-theme=theme-sky-blog-1) |
| moments | [/moments](http://localhost:8090/moments?preview-theme=theme-sky-blog-1) |
| moment | [/moments/moment-f6ircurs](http://localhost:8090/moments/moment-f6ircurs?preview-theme=theme-sky-blog-1) |
| douban | [/douban](http://localhost:8090/douban?preview-theme=theme-sky-blog-1) |
| bangumi | [/bangumis](http://localhost:8090/bangumis?preview-theme=theme-sky-blog-1) |
| steam | [/steam](http://localhost:8090/steam?preview-theme=theme-sky-blog-1) |
| equipment | [/equipments](http://localhost:8090/equipments?preview-theme=theme-sky-blog-1) |
| login | [/login](http://localhost:8090/login?preview-theme=theme-sky-blog-1) |
| passkey | [/login?method=passkey](http://localhost:8090/login?method=passkey&preview-theme=theme-sky-blog-1) |
| signup | [/signup](http://localhost:8090/signup?preview-theme=theme-sky-blog-1) |
| reset | [/password-reset/email](http://localhost:8090/password-reset/email?preview-theme=theme-sky-blog-1) |
| oauth-error | [/login?oauth2_error](http://localhost:8090/login?oauth2_error&preview-theme=theme-sky-blog-1) |
| missing | [/__sky_ui_missing_20261028](http://localhost:8090/__sky_ui_missing_20261028?preview-theme=theme-sky-blog-1) |
