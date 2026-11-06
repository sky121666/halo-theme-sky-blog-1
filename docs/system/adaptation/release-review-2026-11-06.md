# 2026-11-06 发布前终审：暂缓发布

> 后续状态：本报告记录的是修复前终审，两项阻断已在[后续补修](./release-blocker-fixes-2026-11-06.md)中修复并验证。保留以下历史结果与原指纹，不覆盖为新结果。

已完成本批全局终审，但不能称全部问题已修复。当前存在两项发布前必须处理的问题：全量依赖安全门禁失败，以及标签详情在手机尺寸下被长文本撑宽。**本轮只审查、做浏览器临时样式对照并新增报告，没有修改源码、依赖、插件、站点数据或配置，也没有 Git 暂存、提交、推送、标签或发布。**

## 当前候选与隔离边界

候选主题 **2.2.41 / Halo >=2.27.0**；现场 Halo **2.27.2**，活动主题为 `theme-sky-blog-3 0.9.51`。使用 `preview-theme=theme-sky-blog-1` 与专用浏览器空间 **162**，没有切换活动主题。它是请求级预览，不是独立 Halo/数据库。

当前代码指纹 `f0604c46861ae45f19b70539f5da1bf28c4605d85d282ca982e70f3ea3eb2062`，407 个代码身份输入文件。终审前后身份一致，54/54 服务端 CSS/JS 与本地字节一致；浏览器禁网络缓存，没有清除共享 Page Cache。构建在 `/tmp` 完整副本执行，原工作区构建产物未被改写。

## 确认问题与处理方案

### 1. 依赖审计使现有 CI/CD 无法发布

`pnpm audit --json` 退出 1：**2 high、6 moderate、1 low，共 9 条有效公告**。`pnpm audit --prod --json` 退出 0；全部命中开发/构建依赖，不能据此声称 Halo 在线页面已存在对应漏洞。CI 55 行与 CD 49 行均执行全量审计，会在构建前阻断。

| 依赖 | 当前命中 | 公告修复版本底线 | 官方依据 |
| --- | --- | --- | --- |
| source-map-js | 1.2.1 | 1.2.2 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| Vite | 8.3.0，6 条公告 | 8.3.3 | [其中一条高危公告](https://github.com/advisories/GHSA-587h-7wmj-h5pm) |
| glob | 13.0.6 / 10.5.0 | 14.0.2 | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) |
| minimatch | 10.2.5 / 9.0.9 | 11.0.1 | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) |

建议按依赖链修复并更新锁文件，复跑冻结安装、全量 audit、lint、构建和包内容对比；不关闭 audit、不改成仅生产审计掩盖门禁。glob/minimatch 涉及跨主版本及打包工具传递依赖，需要验证实际调用，不能只强制覆盖版本。上表是公告已核验的修复底线，不是本轮已升级，也不是全部 npm 包最新稳定版盘点。

### 2. 标签详情手机布局溢出

入口：[`/tags/halo?preview-theme=theme-sky-blog-1`](http://localhost:8090/tags/halo?preview-theme=theme-sky-blog-1)。设备尺寸 390px，文档宽度稳定为 **501px**；顶部、中部和底部均复现。移动浏览器会扩大布局 viewport，不能仅用 `scrollWidth > innerWidth` 检测；本轮与设定设备宽度比较。

定位：`templates/modules/tags/content.html:114` 的 flex 直接子项缺少 `min-w-0`；共用 `templates/modules/categories/list-minimal.html:38/45` 的标题/摘要缺少连续长字符串换行保护。相关结构在 HEAD 已存在，没有证据将它归为上一批 Shiki 变更新引入。

本次浏览器对照：原样 **501px** → 仅 `min-width:0` **485px** → 再加 `overflow-wrap:anywhere` **390px** → 恢复原样 **501px**。临时样式已撤销，**源码尚未修复**。依据 [flex 子项自动最小宽度](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/min-width)和[长字符串换行规则](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-wrap)，建议局部修复容器收缩与文本换行，不使用全局裁切掩盖。

分类/标签同族另有共 8 处 flex 主列同类结构，应一起检查，但其他位置未全部实页复现。实施后至少验证 390/1440 两端、四种列表样式、长 URL/长标题/长标签、带侧栏及无侧栏。临时 DOM 对照只证明候选方案有效，不等于最终代码已验收。

原图：`/tmp/sky-release-review-20261106/tag-repro-before-390.png`；临时修复对照：`/tmp/sky-release-review-20261106/tag-proposed-dom-only-390.png`。

## 已完成的验证

| 检查 | 结果与边界 |
| --- | --- |
| 干净副本构建 | Node 24.21.0 / pnpm 12.6.0，522 通过、5 跳过；build/lint/format 均退出 0 |
| 跳过条件补验 | 官方认证脚本与当前 `/js/main.js?v=2.27.2` 字节一致，28/28；实际容器 JAR 组合的导航夹具151/151、模板数据280/280、评论228个场景/664断言通过；这些集合有重叠，不累加为总测试数 |
| 实际模板库 | 262 个 JAR 与容器 SHA 一致；Thymeleaf3.1.3、Spring7.0.10、Jackson2.21.7/3.1.7。未采用的3.1.5混配失败单独保留，不算当前环境缺陷 |
| 冻结安装 | `/tmp` 中 `pnpm install --frozen-lockfile` 通过，原锁文件不变；这是 macOS 本地缓存安装，不冒充 Ubuntu 远端 CI |
| 打包 | 234 个模板/静态文件一致，ZIP 240 个文件内容一致；ZIP 容器时间戳和条目顺序不同，因此不宣称跨次 ZIP 哈希可复现 |
| 全站 HTTP | 574 个发现地址，571个200，3个404，无5xx/模板异常。404中2个负例，1个装备数据“地址”占位链接；未修改业务数据 |
| 浏览器路由 | 44 个代表路由/视图 × 两端，共88个组合；无导航异常、无捕获JS异常，标签详情手机有1项确认溢出。142份模板盘点不等于142个独立浏览器页面 |
| 视觉抽查 | 独立逐张看20张主页面截图，另审标签问题与对照图；没有宣称全部176张巡检截图都逐像素审查 |
| 插件只读 | 45通过、3缺真实正文宿主；前批隔离组件通过不能消除真实正文未覆盖标记 |
| 交互复核 | 手机菜单Tab约束、Escape、遮罩、断点切换及PJAX清理通过；图库两端20→40加载，读取响应前后scrollY不变，灯箱关闭保持打开时位置 |
| 后端日志 | 本批窗口ERROR=0、模板异常=0；WARN=22，其中15条PageRequestImpl、5条HaloTemplateEngine。共享实例，不能把全部日志归因本主题 |

## 逐路由覆盖

下表只表示当前配置下冷加载、滚动、可见布局/异常检查。两种尺寸是 Chromium 设备模拟，不是物理手机/Safari全矩阵，也不是所有历史内容、登录身份或业务状态的穷举。

| 类型 | 路由（均加预览参数） | 本批结果 |
| --- | --- | --- |
| home | `/` | 两端结构检查通过 |
| archives | `/archives` | 两端结构检查通过 |
| archive-month | `/archives/2025/08` | 两端结构检查通过 |
| post | `/archives/editor-feature-demo` | 两端结构检查通过 |
| author | `/authors/dev-acceptance-buyer-20261023` | 两端结构检查通过 |
| categories | `/categories` | 两端结构检查通过 |
| category | `/categories/ai` | 两端结构检查通过 |
| tags | `/tags` | 两端结构检查通过 |
| tag | `/tags/halo` | 手机溢出；桌面通过 |
| tag-empty | `/tags/pod` | 两端结构检查通过 |
| page | `/privacy` | 两端结构检查通过 |
| about | `/about` | 两端结构检查通过 |
| docs | `/docs` | 两端结构检查通过 |
| doc-catalog | `/docs/halo-theme-sky-blog-1/theme-settings` | 两端结构检查通过 |
| doc | `/docs/halo-theme-sky-blog-1/theme-settings/global` | 两端结构检查通过 |
| links | `/links` | 两端结构检查通过 |
| feeds | `/links?view=friends` | 两端结构检查通过 |
| apply | `/links?view=apply` | 两端结构检查通过 |
| photos | `/photos` | 两端结构检查通过 |
| photo | `/photos/photo-14xk1htg` | 两端结构检查通过 |
| moments | `/moments` | 两端结构检查通过 |
| moment | `/moments/moment-f6ircurs` | 两端结构检查通过 |
| douban | `/douban` | 两端结构检查通过 |
| bangumi | `/bangumis` | 两端结构检查通过 |
| steam | `/steam` | 两端结构检查通过 |
| equipment | `/equipments` | 两端结构检查通过 |
| login | `/login` | 两端结构检查通过 |
| passkey | `/login?method=passkey` | 两端结构检查通过 |
| signup | `/signup` | 两端结构检查通过 |
| reset | `/password-reset/email` | 两端结构检查通过 |
| oauth-error | `/login?oauth2_error` | 两端结构检查通过 |
| missing | `/__sky_ui_missing_20261028` | 两端结构检查通过 |
| home-page2 | `/page/2` | 两端结构检查通过 |
| archive-page2 | `/archives/page/2` | 两端结构检查通过 |
| categories-page2 | `/categories?p=2` | 两端结构检查通过 |
| category-page2 | `/categories/ai/page/2` | 两端结构检查通过 |
| tags-page2 | `/tags?p=2` | 两端结构检查通过 |
| tag-page2 | `/tags/halo/page/2` | 两端结构检查通过 |
| bangumi-page2 | `/bangumis/page/2?status=0&typeNum=1` | 两端结构检查通过 |
| photos-page2 | `/photos?page=2` | 两端结构检查通过 |
| board | `/links?view=board` | 两端结构检查通过 |
| douban-out-of-range | `/douban?page=9999` | 两端结构检查通过 |
| dishes | `/dishes` | 两端结构检查通过 |
| schedule | `/schedule-calendar` | 两端结构检查通过 |

## 发布集合与尚未覆盖范围

- 当前候选依赖6份未跟踪运行源码、9份chunk、文档选择器片段以及20份package直接调用的验证脚本。正式提交不能遗漏这些依赖，也不能把所有测试/运维脚本一概提交或一概排除。3份 `plugin-qa-*` 辅助脚本不宜混入正式发布集合；选定文件后重新生成发布对象指纹。
- `unreleased.md` 仍有“6份chunk”的旧描述，实际为9份；早期提交建议清单也需随最终集合更新。它是发布文档问题，不是在线运行故障。
- Contact Form、AI Summary、Restricted Reading 的3个实际正文宿主仍未覆盖；模型生成、提交/持久化、支付解锁、外部SSO、个人Passkey与需要切换共享配置的分支未执行。用户此前手测结论保留其来源。
- 维护接管、有效重置令牌、其他认证样式和4个未绑定分类模板不等于都已在实际站点逐配置访问；已有模板夹具与隔离验证分别记录。
- 无主题官方入口的后台/编辑器/存储能力不列为主题缺陷；AList排除、Friends退役。实际Ubuntu标签CI尚未执行，本轮没有触发它。

建议下一步：先修标签收缩/换行和构建依赖公告，再对最终发布文件集合重验冻结安装、audit、构建与相关路由；通过后才进入提交、打tag和发布阶段。本轮没有执行这些修改或发布操作。

[脱敏证据汇总](./evidence/2026-11-06/release-review.json)。原始日志与截图在 `/tmp/sky-release-review-20261106/`。专用浏览器空间162已清理关闭，Halo与另一主题保持运行；浏览器工具提示可选更新，本轮未升级。
