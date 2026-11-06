# 2026-10-29 Docsme 公式首屏重复渲染修复

## 结论与范围

R01 的代码修复已完成，当前构建与官方回调共同运行的真实浏览器集成验证通过；**完整 Halo 动态页面复验待完成**。本轮只修改主题入口、对应回归及文档，没有改插件、数据库或业务配置，没有 Git 暂存、提交、推送或发布。

此前 G05 只覆盖了 PJAX 和主题自身幂等，没有覆盖“首屏同时运行主题与官方回调”。复审发现该缺口会产生实际错误：官方单独渲染 `x^2` 得到 `x²`；主题先渲染后，官方再次读取生成后的 `innerText`，结果变成 `x2x2`。没有抛出 JS 异常，单纯检查控制台或 `.katex` 数量无法发现。

## 修改与依据

- `src/pages/doc/doc.js`：`handlePageEnter(detail)` 接收既有生命周期参数。导航、TOC、抽屉等初始化照常执行，只有 `detail?.pjax === true` 才调用主题的公式补渲染；首屏由 Docsme 官方 `DOMContentLoaded` 回调处理。
- `scripts/verify-global-content.mjs`：改为执行生产生命周期入口；新增首屏和无 PJAX 上下文两个用例，检查不提前渲染、原始公式保留且导航初始化仍执行。既有 PJAX、失败重试及离页取消用例保持。
- `templates/assets/js/doc.js`：由构建生成，与本轮源码配套；未手工修改压缩产物。

官方依据为 Docsme 1.10.2 制品中的 `modules/plugin-scripts.html`、[KaTeX API](https://katex.org/docs/api)及 [DOMContentLoaded 执行顺序](https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event)。模块执行时文档可以已是 `interactive`，不代表官方 DOMContentLoaded 回调已执行。此次保留双方职责，不修改全站启动时序或插件脚本。

## 验证

| 检查 | 结果与范围 |
| --- | --- |
| 修复前 RED | 既有15项通过，新增2项均因首屏提前调用渲染而失败 |
| 修复后回归 | 全局17/17、文档导航14/14通过 |
| 构建与静态检查 | Node 24.21.0 / pnpm 12.6.0，build-only、lint、format:check、diff通过；build内Node用例277通过、5项可选夹具跳过、0失败 |
| 首屏浏览器对照 | 1440/390px，分别运行官方脚本单独处理、当前主题共同运行、关闭PJAX，共6组；公式annotation均为原始 `x^2/y^2`，无脚本异常 |
| 真实Swup导航 | 隔离页面加载实际main/doc构建，桌面/手机各点击进入第二页并历史返回两轮；均为同一document，`z^2/z^3` 与 `x^2/y^2` 正确，无重复字形或嵌套 |
| 缓存与身份 | 隔离服务使用no-store，冷启动之间先离开到about:blank；实际Halo返回的doc.js、main.js均200且字节与本地一致 |
| 完整Halo页面 | 两次GET实际Docsme路由均8秒超时，未完成本轮实站页面验收；未重启服务、改配置或将隔离结果冒充实站通过 |

候选主题仍为 **2.2.41 / Halo >=2.27.0**。Halo Pro 2.27.1、Docsme 1.10.2、KaTeX 3.0.0的实装版本引用同日05:32 UTC的只读观察；本批未重复完成动态API盘点，也未重新核对全量官方发行列表。

当前工作区源码指纹：`4ba48f0d9583a9fbc84b0073641e63b7c5ecfda0faced7af572502b8c1fad4c6`。前一指纹 `34069cc6…` 的证据保留，不覆盖。完整记录见[脱敏证据](./evidence/2026-10-29/docsme-formula-lifecycle-fix.json)，截图、日志及隔离服务脚本在 `/tmp/sky-doc-math-fix-20261029/`。已进行本批增量自审，未新增独立代理审查。

## 服务恢复后的实站复验

使用 `http://localhost:8090/docs/halo-theme-sky-blog-1?preview-theme=theme-sky-blog-1`，禁缓存后先核对doc.js实际字节。通过临时DOM注入或已有真实旧标记文档验证冷启动；公式annotation应保留原始TeX，而不是生成后的文字。随后真实侧栏切页、返回两轮，确认正文、公式、URL及同文档状态。测试样本只使用插件已有的 `[math-inline]/[math-display]`，不新增裸美元语法支持，不保存业务数据。
