# 2026-11-06 全局路由复验与主题补修

本批修复导航焦点、标签折叠、页脚安全区、认证加密失败、短屏错误页、Steam 重试页码、豆瓣越界恢复、Links 本地历史与焦点，以及纯图标控件的辅助名称。保留原有字体、配色、玻璃卡片、布局和图标，不给纯图标统一增加可见文字。

范围仅为主题代码、必要回归与文档。未修改插件、业务数据、数据库或站点配置；未暂存、提交、推送、打标签或发布。本批基线是 `/tmp/sky-global-audit-20261106-r2/before.zip`，不能把历史未提交改动全部算作本批。

## 与另一个主题并行工作的边界

- 本轮只编辑 `theme-sky-blog-1`；Halo 活动主题仍为 `theme-sky-blog-3 0.9.50`。
- 使用官方请求级 `preview-theme=theme-sky-blog-1` 访问主题 1，没有切换活动主题。54 份服务端 CSS/JS 均与本项目构建字节一致。
- 使用独立的任务浏览器空间 145，但这不等于独立 Halo、数据库或浏览器存储安全边界。本轮没有清除 Cookie 或持久化主题偏好。
- 两个主题共用 `localhost:8090`、插件和后端；Page Cache 刷新会作用于共用实例。后台日志不能仅凭同一时间窗口归因于某个主题。
- 本轮确认的问题均有本主题代码或浏览器事件链依据，没有证据表明它们由另一个主题覆盖代码造成。若另一任务修改共享插件配置或服务，仍可能影响现场结果；预览参数不提供这种隔离。

## 实际修复与人工验证

下表中的链接均保留主题 1 的预览身份。正常交互不增加提示文案；必要错误反馈仅在失败时出现。

| 修改与入口 | 问题及修复 | 如何手动验证 |
| --- | --- | --- |
| [全站导航](http://localhost:8090/?preview-theme=theme-sky-blog-1) | 手机抽屉在显示过渡完成后设置焦点；限制 Tab 范围，关闭、断点变化和 PJAX 离页释放滚动锁。用户菜单补 Escape、失焦和换页关闭 | 手机打开菜单，Tab / Shift+Tab 留在抽屉；Escape、遮罩关闭后可滚动；打开菜单后转横屏或点击归档，没有残留遮罩。用户菜单为已登录分支，本轮由自动回归覆盖 |
| [标签详情](http://localhost:8090/tags/halo?preview-theme=theme-sky-blog-1) | 折叠后位于末尾的当前标签原先被隐藏；四种样式均保留当前项并同步展开状态 | 当前 Halo 标签在第 28 项；默认只显示 12 项时仍应可见。展开显示 28 项，再收起仍保留当前项。当前配置为 underline，其他样式由夹具覆盖 |
| [共享页脚](http://localhost:8090/archives/editor-feature-demo?preview-theme=theme-sky-blog-1) | 非法、空或未来建站日期原先可能显示无效天数；现隐藏整行。手机侧 Dock 留白不足；与联系表单入口共存时按实际抬高位置补安全区 | 手机滑到真正底部，备案、托管信息与两个浮动入口均可见且不重叠。桌面布局不变；无效日期通过模板夹具验证，没有修改本站日期 |
| [密码登录](http://localhost:8090/login?preview-theme=theme-sky-blog-1) | JSEncrypt 缺失、抛错或返回无效密文时可能继续提交；现阻止提交、清空旧密文，并允许恢复后重试 | 正常页面外观不变。故障通过实际渲染脚本的隔离 iframe 检查，未绕过现场验证码或执行真实登录；不要把它当作认证端到端通过 |
| [404 错误页](http://localhost:8090/__sky_global_missing_20261106?preview-theme=theme-sky-blog-1) | 固定高度和裁切导致短屏返回按钮不可达；改为最小高度和纵向滚动 | 将视口缩至 390×320，滚动或 Tab 可到达返回按钮；桌面保持原布局 |
| [Steam](http://localhost:8090/steam?preview-theme=theme-sky-blog-1) | 第 3 页失败后重试原先请求旧的第 2 页；现记录实际请求页 | 第 3 页失败后点重试，应继续请求第 3 页。此故障用浏览器临时 GET 替身驱动真实按钮，两端通过，没有改插件 |
| [豆瓣越界页](http://localhost:8090/douban?page=9999&preview-theme=theme-sky-blog-1#collection) | 越界页返回空列表时缺少恢复；现依据官方分页返回最多纠正一次，保留筛选、预览参数和锚点 | 打开入口后回到有效第 1 页并显示内容；反复缩页不会无限重试，错误仍可手动恢复 |
| [友链动态](http://localhost:8090/links?view=friends&preview-theme=theme-sky-blog-1)、[申请页](http://localhost:8090/links?view=apply&preview-theme=theme-sky-blog-1) | 列表重绘丢焦点；本地 query 历史与 Swup 状态不同步导致返回时卸载列表；提示浮层会拦截手机点击。现保存合理焦点、隔离本地历史、同步 Swup URL，非交互提示允许点击穿透 | 在动态详情中关闭或后退，回到原条目；申请页→首页→浏览器返回仍为申请页。收藏失败、连点、删除当前项的验证使用临时权限和响应替身，没有真实写入 RSS 状态 |
| [追番第 2 页](http://localhost:8090/bangumis/page/2?status=0&typeNum=1&preview-theme=theme-sky-blog-1)、[文档列表](http://localhost:8090/docs?preview-theme=theme-sky-blog-1)、[文档目录](http://localhost:8090/docs/halo-theme-sky-blog-1/theme-settings?preview-theme=theme-sky-blog-1) | 上/下一页及两处文档 Dock 图标缺辅助名称；仅补非视觉属性 | 视觉仍为原图标。用浏览器可访问性面板查看按钮名称；文档滚动后工具入口名称为“展开文档工具”，没有增加旁边文字 |

手机抽屉和弹窗遵循 [WAI-ARIA 模态焦点规则](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)，异步列表重绘依据[键盘焦点连续性](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)处理。Links 通过 [Swup 4 官方 `skipPopStateHandling`](https://swup.js.org/options/#skip-pop-state-handling)协调本地历史；未知 query、预览主题变化和跨页返回继续交给正常导航。没有增加插件不存在的 API。

## 验证身份与结果

- 实例：Halo Pro `2.27.1`；候选主题 `2.2.41`、最低 Halo `>=2.27.0`；Node `24.21.0` / pnpm `12.6.0`。
- 最终源码指纹：`102802524ae4fc567aee026185a00b7e7c56e369ead5a370fda3e7a35aa11a80`。
- 完整构建、打包通过：481 项 Node 回归通过、0 失败、2 项可选 Java 夹具跳过；另行模板数据 280/280、页脚选择器组合 64/64 通过。模板夹具使用本机 Thymeleaf 3.1.5 / Spring 6.2.9，不冒充 Halo 随包依赖组合。
- 最终 lint、format:check 与 `git diff --check` 通过；收尾只读复核源码指纹不变，54 份服务端资源仍匹配。独立复核未发现本轮剩余阻断，图库与分页封面加载疑点已用稳定截图关闭。
- 模板缓存刷新 204、Page Cache 刷新 200，54/54 资源字节一致；浏览器禁缓存并核主题资源路径。
- HTTP 574 条：571 个 200、3 个 404，无 5xx、请求失败或异常模板标记。两条 404 是测试负例，另一个是下述装备占位链接。
- 浏览器 44 类路由/视图 × 1440×1000 / 390×844，共 88 个不同组合；无捕获的页面脚本异常、横向溢出或导航错误。主巡检绑定 `b0aa1ecd…`，随后仅补两个文档 Dock 的非视觉属性，重建后追加 6 次相关页面复验，最新结果中无无名称控件。没有把早期截图重新标成新指纹。
- 插件只读探针 36 通过、0 失败、12 未覆盖，报告 `complete=false`，使用最终指纹及本轮缓存刷新时间。
- 双端使用 Chromium 设备模拟，不是实体手机或 Safari 全矩阵。真实页面、临时响应、隔离 iframe、模板夹具分别记录。
- 最后两次源码变化仅为手机页脚 CSS 和文档 Dock 辅助名称；此前已通过的 Links / Steam / 认证专项相关 JS 没有再修改。主页面样式在最后 CSS 构建后全量复验，文档在最后属性修复后重验。

图库另外验证了真实 20→40→46 张加载；新照片灯箱关闭后滚动位置不变。最终分别到达 1440px 和 390px 的真正末页，`scrollY + viewport = scrollHeight`，没有把无限滚动中途当成页底。标签展开/折叠与文档分享 Escape 焦点返回均完成两端实际操作。另补 5 类页面的两端浅色布局，使用临时 DOM 主题属性，未保存用户偏好。

主巡检的“坏图 0”仅表示采样视口中已完成且加载失败的图片为 0，不证明所有图片已完成。图库与分类分页中的加载中封面另等到完成后复查，证据分别保留，未为截图等待问题修改图片样式。

## 全部浏览器入口

这是 44 个不同路由/视图的代表性两端巡检，包含首屏、中段、底部和若干专项；不是对每一条历史文章、每一套后台配置或所有业务状态的穷举。574 个发现地址另外执行了 HTTP 与主题身份检查。

| 页面/视图 | 本地预览入口 | 本轮处理与结果 |
| --- | --- | --- |
| home | [/](http://localhost:8090/?preview-theme=theme-sky-blog-1) | 共享导航/页脚；两端显示检查通过 |
| archives | [/archives](http://localhost:8090/archives?preview-theme=theme-sky-blog-1) | 共享导航/页脚；两端显示检查通过 |
| archive-month | [/archives/2025/08](http://localhost:8090/archives/2025/08?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| post | [/archives/editor-feature-demo](http://localhost:8090/archives/editor-feature-demo?preview-theme=theme-sky-blog-1) | 共享页脚安全区；两端显示检查通过 |
| author | [/authors/dev-acceptance-buyer-20261023](http://localhost:8090/authors/dev-acceptance-buyer-20261023?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| categories | [/categories](http://localhost:8090/categories?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| category | [/categories/ai](http://localhost:8090/categories/ai?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| tags | [/tags](http://localhost:8090/tags?preview-theme=theme-sky-blog-1) | 标签折叠；两端显示检查通过 |
| tag | [/tags/halo](http://localhost:8090/tags/halo?preview-theme=theme-sky-blog-1) | 标签折叠当前项；两端显示检查通过 |
| tag-empty | [/tags/pod](http://localhost:8090/tags/pod?preview-theme=theme-sky-blog-1) | 标签折叠/空态；两端显示检查通过 |
| page | [/privacy](http://localhost:8090/privacy?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| about | [/about](http://localhost:8090/about?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| docs | [/docs](http://localhost:8090/docs?preview-theme=theme-sky-blog-1) | Dock 辅助名称；两端显示检查通过 |
| doc-catalog | [/docs/halo-theme-sky-blog-1/theme-settings](http://localhost:8090/docs/halo-theme-sky-blog-1/theme-settings?preview-theme=theme-sky-blog-1) | Dock 辅助名称；两端显示检查通过 |
| doc | [/docs/halo-theme-sky-blog-1/theme-settings/global](http://localhost:8090/docs/halo-theme-sky-blog-1/theme-settings/global?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| links | [/links](http://localhost:8090/links?preview-theme=theme-sky-blog-1) | Links 历史协调；两端显示检查通过 |
| feeds | [/links?view=friends](http://localhost:8090/links?view=friends&preview-theme=theme-sky-blog-1) | 焦点/历史/提示点击穿透；两端显示检查通过 |
| apply | [/links?view=apply](http://localhost:8090/links?view=apply&preview-theme=theme-sky-blog-1) | 跨页返回历史；两端显示检查通过 |
| photos | [/photos](http://localhost:8090/photos?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| photo | [/photos/photo-14xk1htg](http://localhost:8090/photos/photo-14xk1htg?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| moments | [/moments](http://localhost:8090/moments?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| moment | [/moments/moment-f6ircurs](http://localhost:8090/moments/moment-f6ircurs?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| douban | [/douban](http://localhost:8090/douban?preview-theme=theme-sky-blog-1) | 越界恢复；两端显示检查通过 |
| bangumi | [/bangumis](http://localhost:8090/bangumis?preview-theme=theme-sky-blog-1) | 分页辅助名称；两端显示检查通过 |
| steam | [/steam](http://localhost:8090/steam?preview-theme=theme-sky-blog-1) | 重试页码；两端显示检查通过 |
| equipment | [/equipments](http://localhost:8090/equipments?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| login | [/login](http://localhost:8090/login?preview-theme=theme-sky-blog-1) | 加密失败分支；两端显示检查通过 |
| passkey | [/login?method=passkey](http://localhost:8090/login?method=passkey&preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| signup | [/signup](http://localhost:8090/signup?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| reset | [/password-reset/email](http://localhost:8090/password-reset/email?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| oauth-error | [/login?oauth2_error](http://localhost:8090/login?oauth2_error&preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| missing | [/__sky_ui_missing_20261028](http://localhost:8090/__sky_ui_missing_20261028?preview-theme=theme-sky-blog-1) | 短屏滚动；两端显示检查通过 |
| home-page2 | [/page/2](http://localhost:8090/page/2?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| archive-page2 | [/archives/page/2](http://localhost:8090/archives/page/2?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| categories-page2 | [/categories?p=2](http://localhost:8090/categories?p=2&preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| category-page2 | [/categories/ai/page/2](http://localhost:8090/categories/ai/page/2?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| tags-page2 | [/tags?p=2](http://localhost:8090/tags?p=2&preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| tag-page2 | [/tags/halo/page/2](http://localhost:8090/tags/halo/page/2?preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| bangumi-page2 | [/bangumis/page/2?status=0&typeNum=1](http://localhost:8090/bangumis/page/2?status=0&typeNum=1&preview-theme=theme-sky-blog-1) | 分页辅助名称；两端显示检查通过 |
| photos-page2 | [/photos?page=2](http://localhost:8090/photos?page=2&preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| board | [/links?view=board](http://localhost:8090/links?view=board&preview-theme=theme-sky-blog-1) | 共享变更回归，未改该页业务；两端显示检查通过 |
| douban-out-of-range | [/douban?page=9999](http://localhost:8090/douban?page=9999&preview-theme=theme-sky-blog-1) | 越界恢复；两端显示检查通过 |
| dishes | [/dishes](http://localhost:8090/dishes?preview-theme=theme-sky-blog-1) | 插件原生页，只验入口及显示；两端显示检查通过 |
| schedule | [/schedule-calendar](http://localhost:8090/schedule-calendar?preview-theme=theme-sky-blog-1) | 插件原生页，只验入口及显示；两端显示检查通过 |

## 剩余边界与无需主题修复的项目

- 首页瞬间中的代码围栏是现有 `content.html` 的普通段落（例如 `<p>```js</p>`），主题没有新增这段文字或重新解析插件已渲染的 HTML；未修改共享内容。
- `/地址` 的 404 来自装备记录中 `href="地址"` 的占位内容；没有擅自修改业务数据或禁止正常相对链接。两个审计专用不存在路由返回 404 是预期结果。
- Dishes、Schedule Calendar 使用插件原生页面，本轮核验入口和页面，不改插件内部实现。AList 依照用户决定排除，Friends 已退役。
- 归档年月标记随滚动吸顶是原有设计，卡片经过标记下方属于可滚动遮挡；没有删掉吸顶或改变版式。当前数据中未见内容永久不可达的证据。
- 插件探针仍有 12 项未覆盖：缺少专用目标或业务条件，不能自动算故障，也不能算新版业务兼容通过。详情页的浏览器显示不等于探针所需的完整业务条件。
- 未执行真实登录、注册、验证码发送、密码重置、外部 SSO、业务提交、支付或模型调用；AI 与通行密钥保留用户此前手测来源。本轮不改写历史实测版本，也没有重查全部插件的当日最新发行。
- 条件维护页、有效重置 token、非 404 错误状态、其他认证风格以及未绑定的分类样式，没有冒充现场全部验收。模板夹具与真实页面记录分开。
- 共享后端日志同一窗口内有 12 条 ERROR（附件协调器）和 184 条 WARN；模板解析/表达式异常计数为 0。附件错误包含 JSON 的 int/数组类型不符；另有分页上限、模板处理中断等记录。没有将共享实例日志全部归因于主题，未修改插件或附件数据；详细时窗与分类见证据。
- 本轮结论针对主题修复与界面回归，不替代依赖安全审计、生产环境或正式发布门禁；未发布新版本。

## 文件与证据

相对本轮快照：16 个运行源码/模板、11 个验证文件、10 个构建资源变化；本报告和索引更新另计。完整清单保存在结构化证据中。

运行文件：

- `src/common/main.js`（modified）
- `src/apps/links/runtime.js`（modified）
- `src/pages/steam/steam.js`（modified）
- `src/pages/douban/douban.js`（modified）
- `src/pages/links/links.css`（modified）
- `src/common/css/base.css`（modified）
- `src/common/js/alpine-modules.js`（modified）
- `templates/gateway_fragments/common.html`（modified）
- `templates/modules/footer.html`（modified）
- `templates/modules/nav.html`（modified）
- `templates/error/error.html`（modified）
- `templates/modules/steam/content.html`（modified）
- `templates/modules/bangumi/content.html`（modified）
- `templates/modules/tags/tag-switch.html`（modified）
- `templates/modules/doc/floating-dock.html`（modified）
- `src/apps/links/history.js`（new）

验证文件：

- `scripts/verify-auth-forms.mjs`（modified）
- `scripts/verify-steam-pagination.mjs`（modified）
- `scripts/verify-ui-navigation.mjs`（modified）
- `scripts/verify-links-regressions.mjs`（modified）
- `scripts/verify-plugin-contracts.mjs`（modified）
- `scripts/verify-build-artifacts.mjs`（modified）
- `scripts/verify-plugin-upgrades.mjs`（modified）
- `scripts/fixtures/TemplateDataChecks.java`（modified）
- `scripts/verify-douban-pagination.mjs`（new）
- `scripts/verify-links-pjax-history.mjs`（new）
- `scripts/verify-links-focus.mjs`（new）

构建资源：

- `templates/assets/css/main.css`（modified）
- `templates/assets/css/links.css`（modified）
- `templates/assets/js/moments.js`（modified）
- `templates/assets/js/douban.js`（modified）
- `templates/assets/js/links.js`（modified）
- `templates/assets/js/post.js`（modified）
- `templates/assets/js/main.js`（modified）
- `templates/assets/js/steam.js`（modified）
- `templates/assets/js/doc.js`（modified）
- `templates/assets/js/chunks/history-2.2.41.js`（new）

[结构化证据](./evidence/2026-11-06/global-route-audit.json)保存源码身份、实装版本、缓存与资源哈希、发现地址、浏览器记录和验证边界。临时截图、日志及浏览器脚本在 `/tmp/sky-global-audit-20261106-r2/`，未将浏览器截图加入 Git。

代表截图：[手机文章页脚](/tmp/sky-global-audit-20261106-r2/final/post-390-bottom.png)、[标签末尾当前项](/tmp/sky-global-audit-20261106-r2/tag-current-390.png)、[图库稳定末页](/tmp/sky-global-audit-20261106-r2/photos-settled-bottom-390.png)、[浅色友链动态](/tmp/sky-global-audit-20261106-r2/light-feeds-390.png)。

浏览器空间 145 已结束，Halo 服务保持运行。Ego Lite 提示有可选更新，本轮未升级。
