# 2026-10-29 官方模板契约修复

## 范围与实施结果

承接本日对 142 个 HTML 模板的官方能力审查，只实施已确认的 F01–F05。只调整主题对 Halo / 插件现有数据与入口的消费，没有修改插件源码、数据库、业务设置、权限或模型，没有 Git 暂存、提交、推送及发布。原有未提交修改保留。

采用最小修复：先用生产模板的真实 Thymeleaf 渲染复现字段和作用域错误，再改模板，最后构建、刷新缓存并访问本地预览。主题版本保持候选 `2.2.41`，最低要求 `>=2.27.0`。本轮未重新核对全部官方发行列表，不能把 2026-10-27 的版本审计称为今天的最新版本证明。

| 编号 | 原因与触发条件 | 实施方式和位置 | 结果 |
| --- | --- | --- | --- |
| F01 | 分类/标签有非公开文章或分类级联时，`status.postCount` 与公开列表计数不同 | 分类和标签的四种切换风格及侧栏共 11 处统一读取官方 VO 根字段 `postCount`，保留零值回退；不自行重算分类级联 | 已修复；隔离数据覆盖公开数 2、原始总数 5、status 可见数 3，以及零和 null；实际列表及 PJAX 验证通过 |
| F02 | `postFinder.archives(1,100)` 先分页文章再分组，前 100 篇的年份/月数量不能当全站统计 | 删除归档页标题的重复查询及年份总数；正文标明“本页 X 篇”。侧栏仍有限读取，明确“最近 100 篇以内文章的年月索引”，去掉误导的月总数，按 `site.routes.archivesUri` 提供全部归档入口 | 已修复；归档双视口首屏与月份 HTML 响应通过。不扩大查询 size，不新增不存在的统计 API；本轮没有创建超过 100 篇的业务数据 |
| F03 | 同标签的 `th:if` 早于 `th:with` 执行，极简列表的 `excerptText` 尚未定义 | `modules/categories/list-minimal.html` 将摘要变量移至外层 `th:block`，保留手动摘要优先、自动摘要回退和空摘要隐藏 | 已修复；5 组隔离摘要输入及真实 `/tags`、`/tags/ai` 极简页面通过，手机 PJAX 往返无空段落 |
| F04 | Docsme 1.10.2 不提供 `Project.Spec.public/head/body`；“已登录”也不等于成员授权 | `doc-content.html` 改用 `authorizeRequired`，文案为“此文档需要授权访问”；`doc-layout.html` 删除无契约的项目 head/body 分支，保留布局片段与官方插件脚本 | 已修复；公开项目真页通过，true/false/null/缺项目由引擎夹具覆盖。未执行真实受限成员访问，不称权限业务全部通过 |
| F05 | 首页链接实际打开 `/moments`，却对任何登录用户显示“发布” | 首页瞬间入口统一为“查看全部”，title/aria-label 为“查看全部瞬间”；目标页原有官方 UC 权限与发布逻辑保持 | 已修复；桌面/手机真页入口通过，未发布瞬间或更改账户权限 |

## 官方依据

- [Halo v2.27.1 CategoryVo](https://github.com/halo-dev/halo/blob/v2.27.1/application/src/main/java/run/halo/app/theme/finders/vo/CategoryVo.java)、[TagVo](https://github.com/halo-dev/halo/blob/v2.27.1/application/src/main/java/run/halo/app/theme/finders/vo/TagVo.java)、[CategoryFinderImpl](https://github.com/halo-dev/halo/blob/v2.27.1/application/src/main/java/run/halo/app/theme/finders/impl/CategoryFinderImpl.java)：公开计数及分类级联交由官方 Finder / VO 提供。
- [Halo v2.27.1 PostFinderImpl](https://github.com/halo-dev/halo/blob/v2.27.1/application/src/main/java/run/halo/app/theme/finders/impl/PostFinderImpl.java)及[官方 Post Finder 文档](https://docs.halo.run/developer-guide/theme/finder-apis/post)：归档为文章分页结果的年月分组。
- [Thymeleaf 3.1 属性优先级](https://www.thymeleaf.org/doc/tutorials/3.1/usingthymeleaf.html#attribute-precedence)：条件处理先于局部变量定义。
- [Docsme 主题开发文档](https://www.halo.run/docs/docsme/develop/theme)及本地官方 `plugin-docsme-1.10.2.jar` 的 `Project.Spec`：本轮以制品字段补足技能说明，不新增插件没有的字段。
- [Moments 官方仓库 v1.19.0](https://github.com/halo-sigs/plugin-moments/tree/v1.19.0)：目标页现有 UC 发布权限保持；首页本次只修正文案与链接意图，不复制第二套发布权限逻辑。

## 精确环境与代码身份

2026-10-29 本次只读确认：Halo Pro **2.27.1**，Docsme **1.10.2**，Moments **1.19.0**，Comment Widget **3.4.0**，Page Cache **1.6.0**，均为 STARTED。主题通过 `preview-theme=theme-sky-blog-1` 访问；没有切换活动主题。Node **24.21.0** / pnpm **12.6.0**。

最终源码指纹：`23c151a0b1f54b2b3f6c543afd0e64640ad6510463869f912b24949240d72755`，390 个输入文件，包含既有未提交和未跟踪实现；基准提交 `5323cb64b859334b19f8aa6787eac4f4eb1a98ae`。这不是已提交版本或发行包身份。报告不参与代码指纹，最终复核保持不变。

实际安装、官方稳定目标、技能基线、主题接口基线、实测组合继续分开。旧版矩阵字段不因本轮页面通过就机械提升；完整安装快照和本轮结果见[脱敏证据](./evidence/2026-10-29/template-contract-repairs.json)。

## 验证结果与限度

| 层次 | 本轮结果 | 不代表什么 |
| --- | --- | --- |
| 构建/静态 | `pnpm run build-only`、lint、format:check、`git diff --check` 通过；包含现有构建门禁及产物检查 | 未执行新 ZIP 打包或发布 |
| 新数据回归 | `verify:template-data` 修复前 11/48、修复后 48/48 | 使用本机 Thymeleaf 3.1.5 / Spring 7.0.9 / JDK 21 隔离引擎，不冒充 Halo 内置依赖组合 |
| 受影响评论模板 | 既有 fixture 中单页、Docsme、归档两种 Map/Jackson 配置，共 96 场景、212 断言通过 | 未提交真实评论 |
| 完整评论 fixture | 当前本机依赖组合下失败；以本批修改前模板和 fixture 重跑，同样在 Links `cfg?.page_description` / `ComparableJsonNode` 解析处失败 | 是已复现的基线失败，具体依赖/夹具根因未定位；不能称整套测试通过，也不改 Links 生产代码迁就夹具 |
| 真实页面 | 7 路由 × 1440/390px，共 14 个首屏，主题资源身份正确，无文档级横向溢出，捕获脚本异常为空；已人工查看关键截图 | 不等于每个插件完整业务通过，也未切换所有主题风格 |
| 真实交互 | 分类 AI→其他→历史返回、手机标签全部→AI→历史返回保持同一 document；极简摘要 5→6→5 个、空段落 0 | 历史返回通过浏览器 history API 触发，不冒充用户点击浏览器工具栏 |
| 归档月份 | 展开年份后真实点击已改变路由且保持同文档，但采集时仍是旧正文；单独 GET 月份页为 200，正确月标题及“本页 6 篇”，资源身份为主题 1 | 此次浏览器等待条件不足，不计作月份 PJAX 正文验收通过；属于测试记录限制，不能据此断言主题路由故障 |
| 缓存 | 模板缓存清理 204、Page Cache 清理 200；浏览器禁缓存；归档同 URL 返回的缓存时间晚于清理；4/4 CSS/JS 响应哈希与磁盘一致 | 不以随机查询参数替代服务端缓存核验 |

模板缓存及 Page Cache 清理时间为 **2026-10-29 12:43:13（北京时间）**；归档缓存时间为 **12:46:54**。本轮范围沿用此前本地缓存刷新授权，没有 Reload 业务配置。

新增可选命令 `pnpm run verify:template-data`，需要提供 `THYMELEAF_TEST_CLASSPATH`（Thymeleaf、Spring、jsoup 和运行依赖）；缺少环境时明确退出，不自动下载。与现有 Java 评论夹具一致，不将本机 Java 路径写入项目，也不把它加入纯 Node 默认构建。

日志只读窗口从 **12:43:13** 开始，读取时最后一条记录为 **12:48:47**：13 INFO、1 WARN、5 ERROR；诊断链包含后台任务超时和已排除的 AList 字段类型错误，未出现模板解析/表达式异常。不能由这个短窗口断言后端没有错误，也没有证据将这些后台异常归因于本批模板改动。

## 后续验证项与非目标

以下不是本批已确认而遗漏的五项修复：

- Docsme 旧 KaTeX 标记的 PJAX：既有“KaTeX 样本”冷启动与 PJAX 都只有美元符号文本，没有 `[math-inline]` / `[math-display]`、`.katex` 或 MathML，因此不足以验证旧格式生命周期；未据此新增猜测性的公式解析器。
- Shiki 跨配置边界与慢加载：沿用上一批实现和记录，本批未重跑专门的故障注入，仍为验证缺口。
- HTTPS 下正文私网 HTTP 地址改写：属于已识别的主题自有行为风险，本批未改变迁移策略；需单独确认历史地址映射范围，不能当作插件提供的新功能。
- 真实受限 Docsme 成员、分类级联开关组合、超过 100 篇的归档数据没有在本次业务环境构造；引擎验证和语义修正不冒充这些实站分支全部通过。
- 插件没有的主题能力不新增。Equipment 服务端分页、Redis、后台业务不列为主题待修；Friends/link-submit 已退役，AList 排除。AI/Passkey 的既有用户手测来源保留。

## 人工复验入口

统一使用 `http://localhost:8090`，每个入口附加 `?preview-theme=theme-sky-blog-1`，浏览器禁缓存并等待入场动画结束。

1. `/categories/ai`、`/tags/ai`：比较切换条和侧栏公开计数；切换分类/标签后返回，数字、正文与地址保持一致。
2. `/tags`：当前真实极简列表已有非空和空摘要；确认非空摘要显示、空摘要不留段落，再进入 AI 标签并后退。
3. `/archives`、`/archives/2025/08`：检查“本页 X 篇”、近期索引范围说明和“查看全部归档”；不能把侧栏当完整年月统计。
4. `/docs/halo-theme-sky-blog-1`：公开项目正文、目录与三栏/手机布局正常；受限权限验证须使用实际已有成员数据，不自行改权限。
5. `/`：瞬间卡片右上角为“查看全部”，点击打开列表，不承诺当前用户可发布。

原始构建日志、增量 diff、截图和本地测试材料保存在 `/tmp/sky-template-contract-fix-20261029/`；截图不提交仓库。本批由主代理自审，没有新增独立审阅结论。
