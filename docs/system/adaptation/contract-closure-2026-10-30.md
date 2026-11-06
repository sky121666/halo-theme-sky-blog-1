# 2026-10-30 官方契约收口：瞬间与 Links

本批执行已确认的三项主题适配调整。保留图标与计数；只消费插件已有接口。图片布局、Shiki 有限整页降级保持现状，未修改插件、站点业务配置或数据库，未暂存、提交、推送或发布。

## 修改与官方依据

| 路由 | 主题修改 | 官方依据与边界 |
| --- | --- | --- |
| `/moments`、`/moments?tag=…`、`/moments/{name}` | 点赞使用单向动作语义，移除 `aria-pressed`；请求中与成功后使用 `aria-disabled`，仍显示心形图标和数字，重复操作不重复提交 | [W3C Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)区分普通动作与切换按钮；未新增插件没有的取消点赞 |
| `/moments` 与标签筛选 | 权限查询的网络、超时、5xx、响应格式错误显示状态及重试图标；查询未完成不能发布；401/403 与无发布权限继续隐藏入口；离页旧响应不恢复入口 | 沿用 [Moments 1.19.0 权限声明](https://github.com/halo-sigs/plugin-moments/blob/v1.19.0/src/main/resources/extensions/roleTemplate.yaml)中的 `uc:plugin:moments:publish`，以及 [UC 发布端点](https://github.com/halo-sigs/plugin-moments/blob/v1.19.0/src/main/java/run/halo/moments/uc/UcMomentEndpoint.java)。主题提示不替代服务端授权和审核 |
| `/links?view=friends` 及 `scope/itemId` 参数 | 未知动态只读取当前页，显示未加载提示；用户点击“加载更多”才读取下一页；不自动换筛选遍历全部记录，不把未找到直接说成已删除；保留会话中已打开详情与历史返回 | [Links 2.5.0 OpenAPI](https://github.com/halo-sigs/plugin-links/blob/v2.5.0/api-docs/openapi/v3_0/linksV1alpha1Api.json)提供 RSS 游标列表，没有单条 RSS GET。使用官方游标，不虚构查询接口 |
| 同上 | 去掉权限确认后重复触发的首屏请求；复用当前正在加载或已完成的页 | 浏览器先复现两次首屏请求，增加回归在旧代码失败；最终首屏一次，手动下一页一次，详情历史返回零次追加请求 |

代价明确：重新打开一个不在首屏、也不在当前会话缓存中的 `itemId`，不再保证自动定位；需要按需加载或调整筛选。保留 URL 中的目标，不假称插件具备随机读取任意动态的能力。

代码位置：`src/pages/moments/moments.js`、`moment-publish.js`，`templates/modules/moments/content.html`、`detail.html`，`src/apps/links/runtime.js`，`templates/modules/links/content.html`。专项回归复用 `scripts/verify-moments-post-actions.mjs` 与 `scripts/verify-links-history.mjs`。

## 当前验证组合

- 本地 Halo Pro **2.27.1**，PluginMoments **1.19.0**、PluginLinks **2.5.0**、LightGallery **1.2.1**。
- 候选主题 **2.2.41 / Halo >=2.27.0**；活动主题仍为主题 3，通过 `preview-theme=theme-sky-blog-1` 验主题 1。
- Node **24.21.0** / pnpm **12.6.0**。
- 最终源码指纹：`bd962a1eb8131e4ac6ff7918a34335cd651756ffe7f11727e0265065fb3be1db`。
- 本批沿用前轮在线核对的固定版本官方依据，没有重新扫描全部插件的当日发行；技能基线、矩阵历史实测版本不冒充本批全量实测。

## 检查与浏览器证据

`pnpm run build-only` 通过：**338 项 Node 回归通过，2 项可选导航 Java 夹具跳过，0 失败**；没有提供 `SKY_UI_JAVA_FIXTURE_CLASSPATH`，不将这两项记为通过。认证实际官方脚本已接入本次测试。瞬间专项 **61/61**、Links 历史专项 **49/49**（包含在完整 Links **87/87** 内）；lint、格式和 `git diff --check` 通过。本批未重新打 ZIP。

刷新本地模板和 Page Cache，7 份 CSS/JS 与磁盘 SHA-256 一致。首轮浏览器确实执行旧的版本化脚本；在同一浏览器调用内禁缓存并重新导航后，确认当前点赞属性和脚本字节。旧缓存观察没有计入最终通过。

| 实际浏览器检查 | 1440 / 390 宽度结果 | 证据边界 |
| --- | --- | --- |
| `/moments`、`/moments?tag=哈哈`、`/moments/moment-f6ircurs`、`/links`、`/links?view=friends`、`/links?view=apply` | **12/12**：无整页横溢、无捕获到的页面未处理异常；瞬间图标存在，无点赞切换属性 | 真实 Halo 页面与当前主题资产；仅这些路由首屏，不是全站业务验收 |
| 瞬间评论 Enter 展开、Space 收起；列表 → 详情 → 返回 | 两个视口通过，确认同一 document 的 PJAX，返回后状态正确 | 没有提交评论 |
| 点赞成功、重复操作、图标与数字状态 | 两个视口通过，计数只加一次，请求只一次，保留心形图标 | 写请求与点赞存储为浏览器内替身，不是真实点赞验收 |
| 权限 503 → 重试等待 → 授权 → 打开发布弹窗 | 两个视口通过，等待中入口不可用，成功后弹窗聚焦正文 | 当前浏览器匿名，使用当前生产模板片段、构建脚本和隔离权限响应；不冒充真实登录态 SSR 或发文验收 |
| Links 首屏 → 手动加载 → 详情 → 关闭 → 后退 | 两个视口通过，请求数依次为 **1 → 2 → 2**，详情标题和历史正确 | 身份、RSS 内容和状态写请求均为浏览器内替身；没有真实标记已读 |

图片检查覆盖瞬间、权限错误提示/弹窗、动态列表。RSS 详情截图捕获了打开动画的中间帧，未用它证明稳定后的弹窗布局；其实际打开、内容和历史恢复通过 DOM/请求断言确认。网络错误、取消、游标异常、无权限与未读筛选不扫描全部等边界由专项回归覆盖，不统称全部真实后台业务通过。

本批完成作者差异复核，没有另一位审查者的独立审查。未发现本批三项范围内仍需修改的确认问题；不据此宣称全站所有功能已验证。

脱敏结果见[精确证据](./evidence/2026-10-30/contract-closure.json)。完整临时日志、隔离驱动与截图保留于 `/tmp/sky-contract-close-20261030/`，未放入主题运行产物。
