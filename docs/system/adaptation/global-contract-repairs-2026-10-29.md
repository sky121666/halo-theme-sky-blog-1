# 2026-10-29 全局主题接入修复

后续审计修正：本记录中 G05 的 PJAX 结果有效，但当时漏测与官方首屏回调共同运行，随后发现重复渲染。该回归现已补修，详见[后续修复及验收边界](./docsme-formula-lifecycle-fix-2026-10-29.md)。以下保留当时的指纹和验证范围，不作为后续代码的验收结论。

本批完成上一轮确认的 G01–G05，范围为主题对浏览器标准与插件已有能力的消费。保留原有 WIP；未修改插件源码、业务配置、数据库，也未暂存、提交、推送或发布。候选主题仍为 `2.2.41 / Halo >=2.27.0`。

| 编号 | 问题与触发条件 | 实际修复 | 验证结果 |
| --- | --- | --- | --- |
| G01 | 浏览器拒绝读取偏好存储时，头部初始化脚本提前中断；写入失败也可能阻断切换 | `theme-script.html` 对偏好读写捕获异常，并保留当前文档内的选择；`alpine-modules.js` 共用此接口 | 正常、读失败、写失败回归通过；真实 Docsme 页在两种故障注入下均建立 SkyPjax / SkyDebug，按钮完成深色、auto、浅色循环。Online 插件自身的拒读异常另列边界 |
| G02 | 正文样式块只要含 `blur` 就被整体删除，连带丢失合法布局 | `article-content.js` 删除批量移除样式的逻辑，保留作者和插件的原始样式 | 真实页面临时样本连续初始化两次后，style 仍在，grid 布局保持；没有绕过受限阅读样式 |
| G03 | 两套外链逻辑覆盖 `nofollow/ugc/sponsored`，且相似域名被误判为同站 | 新增共享 `external-links.js`，按 `URL.origin` 比较，以 `relList.add` 增补安全标记；全局和正文共用 | 真实页面原 rel 保留，相似域名和不同端口作为外链，同源链接保持；重复初始化无重复 token |
| G04 | HTTPS 页面无条件把内网地址、不同端口或相似主机的媒体改成当前站点 | 删除 `normalizeInsecureContentUrls()`；原始 `src/poster/srcset` 不再被主题猜测改写 | 生产代码回归覆盖 HTTPS 上下文中的 origin、端口及多资源属性。实站为 HTTP，不冒充 HTTPS 实站通过；源内容自身的混合内容或失效地址不由主题自动迁移 |
| G05 | Docsme 1.10.2 的旧公式脚本只监听 DOMContentLoaded，PJAX 切入后不执行 | `doc/math.js` 仅消费本次响应声明的同源官方 KaTeX 资源，按 `[math-inline]/[math-display]` 调用 `katex.render`；接入 doc 生命周期，补幂等、取消、失败重试和逐公式容错 | 真实侧栏点击与历史返回均为同一 document，两处临时官方标记渲染成功，零嵌套；慢加载、失败重试、离页和插件缺失由隔离回归覆盖 |

## 官方依据与实现取舍

- [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage#exceptions) 说明存储访问可能抛出异常。主题仅保护自身偏好，不覆盖全局 Storage 或伪造插件存储。
- [MDN URL.origin](https://developer.mozilla.org/en-US/docs/Web/API/URL/origin) 用协议、主机和端口表达来源；[DOMTokenList.add](https://developer.mozilla.org/en-US/docs/Web/API/DOMTokenList/add) 支持增补现有关系 token。保持原“外链新窗口”行为，不删除内容已有的关系。
- [Docsme 主题适配文档](https://www.halo.run/docs/docsme/develop/theme) 配合本地官方 `plugin-docsme-1.10.2.jar` 的插件脚本确认旧标记和资源地址；制品及片段哈希见证据。网页说明的历史基线不作为当前实现证明。
- [KaTeX 官方 API](https://katex.org/docs/api) 提供 `katex.render` 和 `throwOnError:false`。本次桥接只处理插件已有标记；不扫描任意 `$...$` 正文，不重放全部插件内联脚本。

## 环境、缓存与证据

2026-10-29 实际确认：Halo Pro **2.27.1**、Docsme **1.10.2**、KaTeX **3.0.0**、Shiki **1.5.1**、Page Cache **1.6.0**。使用主题 1 的官方预览参数，活动主题仍为主题 3。全量官方发行核对日期仍为 **2026-10-27**；本批不是新的全插件版本升级。

本批源码指纹：`34069cc6a37381aff7e222f8ef741dad8fae463cc0fbba422fe97b0c3ffd9c4a`，计入 394 份工作区文件。Node **24.21.0** / pnpm **12.6.0** 下 build-only、lint、format:check、diff 检查通过。新增全局回归 **15/15**，文档导航 **14/14**；build 日志中的 Node 用例合计 275 通过、5 跳过、0 失败，不把可选夹具跳过算作通过。初始 RED 中 9 个用例失败；异步补充用例在实施后加入，不将它们全部描述为测试先行。

北京时间 **13:32:38** 已刷新主题模板与 Page Cache，4/4 关键 JS 服务字节与磁盘一致。最初浏览器仍持有旧 ES 模块，故障样本结果未计为通过；重建验收文档后再次核对实际运行函数及网络传输，才执行下列验收。未清除浏览器配置文件级缓存、Cookie 或业务存储。

- 真实首屏：`/`、`/archives/editor-feature-demo`、`/docs/halo-theme-sky-blog-1`、`/links`，1440px 与 390px 共 **8 组**，无横向溢出或捕获的 JS 异常。首屏结果不代表页面所有业务流程均已通过。
- Docsme：真实侧栏点击，临时在 incomingDocument 注入两处官方旧标记；返回使用浏览器 History API。`pjax:complete` 达到 3 次，仍是同一 document，公式保持两处、无嵌套。桌面/手机显示检查通过。没有保存或修改真实文档。
- 存储：临时新文档脚本注入读/写失败，使用真实主题按钮完成循环，finally 撤销注入并离页；未改变站点设置或原有偏好。
- 隔离浏览器：生产构建 doc/article 模块、实际主题头部脚本及生产切换函数，配合官方 KaTeX 资源验证。1440/390px 下手动生命周期重入成功。这部分不是完整 Halo 页面，也不是网络 PJAX 证明。

逐项结果、版本与缓存身份见[脱敏证据](./evidence/2026-10-29/global-contract-repairs.json)。临时截图、运行脚本和日志在 `/tmp/sky-global-fixes-20261029/`，不作为发行资产。由主代理对本批增量自审，没有新增独立审查结论。

## 保留边界

1. 完全拒绝 localStorage 读取时，Online 插件的 `/plugins/online/assets/static/js/client.js:15` 自身无保护读取仍抛出一条异常。调用栈和实际脚本已核对；主题初始化、PJAX 和颜色切换继续运行。本批不修改插件，也不通过全局存储替身掩盖异常。
2. 验收中 Halo 动态页面曾超时，同期后端定时任务及附件协调任务出现超时；稍后在未重启、未改配置的情况下恢复。13:32:38–13:51:47 读取的 647 行日志中没有模板解析/表达式异常；后端超时根因未定位，不归因于主题或宣布已根治。
3. G04 的 HTTPS 语义、公式失败/慢加载/离页使用隔离回归覆盖；没有执行真实站点迁移、插件停用、权限变更或业务写入。
4. Shiki 特殊配置/慢加载边界、完整评论测试中原有的 Links/Jackson 夹具失败仍是验证缺口，没有新的生产故障证据。用户手测 AI / Passkey 的来源保持，插件缺少的功能不列为主题待修复。

## 人工复验

每个路径附加 `?preview-theme=theme-sky-blog-1`；禁缓存后整页重载，先确认 Network 中加载主题 1 的 `2.2.41` 资源。

1. 首页及文档页：点击主题切换按钮，检查深色、跟随系统、浅色与按钮提示一致；禁止存储场景使用开发工具临时故障注入，不修改个人浏览器长期设置。
2. 文章/文档正文：样式中同时有 grid 和 blur 时，初始化后布局规则仍存在；有 `nofollow ugc sponsored` 的外链应保留这些值并增补安全标记。
3. Docsme 公式：使用实际官方旧标记内容或临时 DOM 样本，从侧栏切入、离开、返回；应显示公式且无重复嵌套。当前样本文档中的裸美元文本不是本次适配的标记，不能以它判失败。
4. HTTPS 资源：在具备 HTTPS 的验收环境检查资源地址仍保持原 origin/端口。主题不承诺原始 HTTP 地址可以越过浏览器混合内容限制。
