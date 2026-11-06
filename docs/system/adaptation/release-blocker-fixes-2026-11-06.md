# 2026-11-06 发布阻断补修

**两项已确认发布阻断均已修复，本地门禁通过；未提交或发布。**

本批范围：修复终审确认的 taxonomy 手机溢出与构建依赖安全门禁；保持主题原有字体、颜色、图标和版式。不修改插件、数据库、业务数据、CI 或全局依赖策略，不暂存、提交、推送或发布。

## 修改与原因

| 位置 | 问题与本次修改 | 人工入口 |
| --- | --- | --- |
| `templates/modules/{tags,categories}/content.html` | 8 个主 flex 列补 `min-w-0`。原默认最小宽度受内容约束，390px 手机标签页被撑至 501px。 | `/tags/halo`、`/tags`、`/categories/ai`、`/categories` 及分页 |
| 四份 `templates/modules/categories/list-*.html` | 列表范围内允许无法正常断开的长字符串换行；图文列表的文字列补可收缩约束。保留正常文字换行、行数限制和原有样式，不使用全局 `overflow:hidden` 遮盖。 | 分类/标签使用这四种列表的页面；未绑定样式使用真实模板隔离样本 |
| `list-minimal.html` 底部栏 | 超长标签会把阅读数和“阅读更多”压成竖排。允许底栏换行，标签限制在容器内，统计/阅读区保持单行。 | `/tags/halo` 及使用极简列表的分类/标签页 |
| `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml` | 修复 Vite、glob、minimatch 和 source-map-js 的公告链，保留完整 audit、冻结安装和供应链门禁。 | 本地构建及 CI；没有新增用户界面 |

`min-width:auto` 对 flex 项的内容约束与 `overflow-wrap:anywhere` 的处理依据见 [MDN min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/min-width) 和 [MDN overflow-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-wrap)。新增构建 CSS 仅两条工具类：`gap-y-3` 和 `[overflow-wrap:anywhere]`，没有改全局字体/颜色规则。

## 依赖选择与边界

| 依赖 | 修复前 | 本批采用 | 2026-11-06 查询的 npm latest |
| --- | --- | --- | --- |
| Vite | 8.3.0 | 8.3.6 | 8.3.6 |
| glob | 13.0.6 / 10.5.0 | 14.0.3 | 14.0.4 |
| minimatch | 10.2.5 / 9.0.9 | 11.0.4 | 11.0.5 |
| source-map-js | 1.2.1 | 1.2.2 | 1.2.2 |

glob/minimatch 最新版本及其新传递依赖会触发 pnpm 发布冷却期豁免；本批采用已修复且通过冷却期的版本，没有写入豁免或降低策略。不宣称全部依赖已升到当天 latest。后续冷却期结束可以另行评估 patch 更新，当前安全审计没有依赖该更新的遗留项。

上游最新 ESLint/typescript-eslint 和 Halo 打包 CLI 仍依赖旧 matcher/glob，因此仅升级上游包不能清空公告。override 限定到已检查的消费者版本，后续上游采用安全版本时应移除。minimatch 11 删除部分旧 API，不能当作任意旧版本的直接替代：本项目消费者只使用已验证的构造器、`match` 和匹配函数；archiver-utils 保留的调用是 CommonJS `glob.sync`。

[glob 官方版本差异](https://github.com/isaacs/node-glob/compare/v13.0.6...v14.0.3)、[minimatch 官方版本差异](https://github.com/isaacs/minimatch/compare/v10.2.5...v11.0.4)、[Vite 8.3.6 发布记录](https://github.com/vitejs/vite/releases/tag/v8.3.6)。实际项目模式对比包含 12 组 glob、12 组打包展开和 59,616 次 matcher 断言，均与旧版结果一致；这不是所有旧 API 的兼容承诺。

## 最终验证与版本身份

最终代码指纹 `2dae66eb35df1bdba3ac708b2ebe4d8043e7cf9886a643310cbda2635475f9a7`，407 个身份输入文件。环境为 Halo **2.27.2**、主题 **2.2.41**、Node **24.21.0**、pnpm **12.6.0**。现场46个插件版本在本批前后未变，没有重新宣称全部官方最新；确切清单保存在证据JSON。

- 冻结安装、全量和生产 audit、完整 build、lint、format、差异检查通过；安全审计9条降至0。使用当前Halo实际JAR与官方认证脚本，构建回归 **577/577、0跳过**；补充模板数据280/280、评论228场景664断言通过。这些不是可直接相加的独立业务总量。
- 44路由/视图×两端 **88组** 无导航失败、捕获JS异常或页面横向溢出，对应 `33dab4ed659913610416131e8db05b1bd2a748212285a53a71b9abd3b8238875`。独立复核随后仅修正无标签阅读区对齐；54份构建CSS/JS逐字节未变。最终指纹下，受影响9条分类/标签路由×两端 **18组** 追加复验通过，不能把此前88组改写成新指纹全量重跑。
- 四种真实Thymeleaf列表×正常/长标题/长摘要/长标签/空标签×两端×侧栏开关，共 **80组隔离布局** 通过。手机真实标签页从501px恢复为390px（顶部、中段、底部均390px）；长标签阅读入口保持16px单行，无标签保留原左对齐。杂志焦点态6组通过，8张重点截图经独立复核无未关闭缺陷。
- 手机菜单的Tab约束、Escape/遮罩关闭、断点切换、PJAX清理通过。图库两端20→40加载未返回顶部，灯箱关闭保持打开时位置；桌面响应期间701→832px含滚轮运动，因此不宣称网络响应前后坐标严格相等。
- 浏览器禁缓存，服务端 **54/54** CSS/JS与磁盘匹配，未清共享Page Cache。最终ZIP **240份文件** 与磁盘逐字节一致，SHA-256 `bb0d61b12da616794dca2329322fcd330638ca68c868811bd9b3cba40e2e0721`；未发布。
- 后端限定窗口 `2026-11-06T10:56:57.837Z` 至 `2026-11-06T11:16:59.676716+00:00`：模板异常 **0**；ERROR **4** 条均含AList解码失败上下文，属于用户明确排除项，未修改；WARN **23** 条。共享实例日志不能一概归因主题。原始日志未保存或公开。

活动主题在检查期间从theme-sky-blog-3 0.9.51变为theme-sky-blog-1 2.2.41；本任务仅GET读取，未执行切换，不推断操作者。一直使用明确的主题1预览参数与资源身份核对。

浏览器专用空间165完成后关闭。初次隔离data URL外链CSS被浏览器阻止，其结果已排除；正式样本内联已校验的实际构建CSS并断言样式生效。一次初始冻结安装因重新下载103MB图标包被主动中断，随后复用本机临时pnpm store完成冻结安装，没有更改持久策略。上述工具过程不作为主题失败或通过证据。

[脱敏证据](./evidence/2026-11-06/release-blocker-fixes.json)。原始构建日志、模板样本和截图在 `/tmp/sky-release-fix-20261106/`。浏览器工具提示可选更新，本轮未升级。

## 手动验证

访问时加 `?preview-theme=theme-sky-blog-1`，先禁用浏览器缓存并确认资源地址包含 `/themes/theme-sky-blog-1/`：

1. 手机 390px 打开 `/tags/halo`，滚动到页面中段和底部：内容不应横向滚动；标题、摘要与标签在主栏内；阅读数和阅读链接保持正常横排。
2. 桌面 1440px 打开同页及 `/categories/ai`：原有标题层级、列表宽度、图标与侧栏正常。翻页、返回后布局保持一致。
3. `/tags`、`/categories`：切换标签/分类、展开更多后，列表和切换区都留在视口内。四种列表的极端长内容、侧栏开关以隔离样本验证，不为测试修改后台内容或设置。

## 未扩大声明的范围

本批不重验模型生成、真实提交/持久化、支付解锁、外部 SSO、个人 Passkey 或插件后台业务。Contact Form、AI Summary、Restricted Reading 三个实际正文宿主的既有覆盖空缺仍保留；隔离样本不能冒充真实文章业务验收。用户此前手测 AI/Passkey 的结论保留其来源。AList 排除、Friends 退役，无主题接入点的后台能力不列为主题缺陷。

发布仍须获得相应授权后选择完整文件集合、提交并执行远端 Ubuntu CI；本批本地门禁不等于远端 CI 已执行。当前工作区含既有未跟踪运行源码、9 份版本 chunk 和构建脚本，不能只提交本批文件而遗漏此前运行依赖，也不应将临时截图/业务辅助脚本无差别纳入。
