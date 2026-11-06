# 2026-11-06 既有改动的体验复核与收敛

**结论：不整批回退既有修复。应撤掉重复说明、错误承诺和面向访客的内部术语；保留官方契约、内容完整性、权限、并发、生命周期及可访问性修复。本轮已收敛确认的问题，尚不能据此宣布全站全部业务通过或可直接发布。**

本报告将“是否值得保留”和“是否完成运行验收”分开。隐藏的辅助名称、展开状态和必要错误恢复不属于文字噪声；简化界面也不等于删除反馈、降低错误透明度或隐藏真实审核状态。

## 范围与身份

| 项目 | 本轮依据 |
| --- | --- |
| 仓库 | `theme-sky-blog-1` |
| HEAD | `5323cb64b859334b19f8aa6787eac4f4eb1a98ae`，简称 `5323cb64` |
| 原始待审集合 | 282 项 WIP：152 项已跟踪变更、130 个未跟踪文件；这不是 282 个产品功能，也不代表报告完成时的 Git 总数 |
| 运行文件集合 | 97 个 `src/**` 或非 `templates/assets/**` 的模板文件；按实际文件清单逐项归类，附录无重复列出 |
| 原始清单 | `/tmp/sky-release-review-20261103-3Y7y73/inventory.json`，生成于 2026-11-03；其历史根路径不替代当前工作区身份 |
| 本轮前置快照 | `/tmp/sky-ux-review-20261106-q8Etkb/before`；本轮增量以此快照对照，不把全部 HEAD diff 都算作今天新增 |
| 本轮运行文件增量 | 上述 97 个文件中，16 个调整、81 个保留；文件数不是缺陷数或功能数 |
| 当前已知代码指纹 | `2b223699f1f6adf994e4ef2c40883796bd1f9248abb174495a3e8d7c39836d09`；包含末次标题复制原生按钮及文档返回顶部辅助名称；代码、资源与验收范围见下文 |
| 运行环境 | Halo 2.27.1；活动主题为 `theme-sky-blog-3`，通过请求级 `preview-theme=theme-sky-blog-1` 检查主题 1 |
| Node / pnpm | Node 24.21.0 / pnpm 12.6.0 |
| 操作边界 | 主题源码、相应回归、说明及本机构建验证；未以本轮体验复核修改插件能力、业务配置、数据库或依赖，不包含 Git 暂存、提交、推送或发布 |

97 个运行文件之外的测试、契约脚本、配置版本说明、报告、截图、构建产物及旧分块删除均保留各自性质。测试是证据，文档是说明，构建文件是源码产物；不将它们列作新功能，也不因“文件很多”推出改造收益或风险分数。

## 判断依据与项目取舍

- 反馈应帮助用户理解结果及下一步，文案使用用户熟悉的概念，重复的信息会争夺注意力。因此保留失败和恢复入口，合并重复标题、说明卡与成功通知。依据：[NNGroup 十项可用性启发式](https://www.nngroup.com/articles/ten-usability-heuristics/)。
- 纯图标控件可以保留；原生按钮、可访问名称、键盘激活和适当焦点恢复应同时存在。无需为了辅助名称给每个图标增加常驻文字。依据：[W3C APG Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)。
- 非焦点状态消息应能被辅助技术获知；减少冗余可见文案不应一并删除必要的 `role="status"`、`aria-live` 或真实操作结果。依据：[WCAG 2.2 状态消息说明](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)。
- 手机标题复制入口采用至少 24×24 CSS px 的点击目标，兼顾可触达性和标题阅读。WCAG 2.2 的最小目标规则含间距、行内等例外；本项目选择直接扩大目标，并非宣称每个小图标都必须以相同视觉尺寸绘制。依据：[WCAG 2.2 最小目标尺寸说明](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)。
- 图标名称、语义元素、可见焦点、异步状态、长内容与空态检查，也参考 [Vercel Web Interface Guidelines 原始规则](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)。这是工程检查参考，不代替 Halo 契约、项目设计决定或正式可访问性验收。

分类收拢数量、次级色强度、标题位置、反馈保留 4 秒，以及文字密度都是本项目针对真实页面作出的取舍，**不是上述规范规定的唯一颜色、排版或时长**。本报告没有据这些引用宣称全站 WCAG 合规。

## 应撤回或收敛的呈现

这里的“撤回”指移除问题呈现，保留其背后有效的业务或可靠性修复。

| 项目 | 来源与问题 | 本轮结果 | 明确保留 |
| --- | --- | --- | --- |
| Links 游标错误 | 此前未提交修复新增游标完整性检测，但将“游标重复/缺失”等内部错误直接交给访客 | 显示通俗的失败与重试提示；公开动态关闭也不再提 PluginLinks 内部配置名 | 游标校验、停止重复分页、可重试、已加载数据与目标状态保护 |
| Links 关闭留言 | 此前改动将确定的开关关闭描述为“评论服务暂不可用”，同时附加“页面可以正常浏览” | 准确显示“留言已关闭”，去掉多层故障样式和无意义浏览承诺；留言关闭时不再提供提交跳转 | 真正可用的评论组件、留言锚点与开关 |
| Moments 权限检查 | 此前新增检查反馈在每次初载占据列表主区域，确认完成又移除，干扰阅读 | 首次检查静默；检查失败显示恢复入口，用户主动重试时保留等待反馈 | 权限确认期间不能发布的门禁、失败重试、拒绝与暂时错误的区分 |
| Moments 固定审核承诺 | 此前把发布器说明改成固定“审核通过后公开”，但官方 UC 返回可能直接公开、待审核或状态未知 | 删除固定承诺；以实际返回状态给出结果 | 官方 UC 接口、作者与审核由服务端决定、待审核不假装已公开 |
| Moments 结果堆叠 | 此前成功条常驻，与“已发布但列表未更新”同时出现；新提交仍可能受旧刷新影响 | 成功和刷新失败互斥；公开列表刷新成功后 4 秒收起成功提示；新提交取消旧反馈计时与旧刷新结果归属 | 待审核/状态未知的必要反馈、刷新失败重试、草稿及并发保护 |
| 归档说明 | 此前增加的重复副标题与“100 篇”等实现说明未帮助访客完成归档浏览 | 删除重复副标题和分页实现说明 | 正确归档路由、日期状态、数据完整性与评论契约 |
| 关于页地图 | 无 Key 或无法显示地图时，地点、不可用解释及外部地图指引重复 | 保留地点和有效外链；无 Key 不再叠加指导语，错误压缩为简短状态 | 正确坐标顺序、地图 URL、加载失败回退及可用外链 |
| 分享平台空区 | 无平台可用时仍保留空平台布局，扩大弹窗留白 | 隐藏空平台区域 | 复制入口、复制失败恢复、会话隔离、焦点与关闭行为 |
| 首页瞬间入口 | 将错误的“发布”导航改准是必要的，但对已有箭头入口增加常驻“查看全部”并非必要 | 保留纯箭头及准确 `aria-label`，实际仍跳转全部瞬间 | 正确链接含义；不恢复“点击即发布”的误导 |

## HEAD 已有噪声：本轮顺带修正

Links 申请页的下列内容经 `git show HEAD:...` 对照，**已经存在于 HEAD，并非此前未提交修复新引入**：页面介绍、重复的“提交友链申请”卡片标题、识别/提交方式长说明、多个 Markdown 提示、`displayName` 占位、官方/浏览器识别过程、生成/复制后的重复成功通知。

本轮统一处理显示层，保留三视图设计、数据字段、接口和权限逻辑：

| 能力分支 | 按钮与唯一的主说明 | 结果含义 |
| --- | --- | --- |
| 管理员可直接添加 | “添加友链” / “直接添加，无需审核” | 实际添加完成才显示成功；不承诺当前列表无需刷新就自动出现 |
| 插件已开启公开申请 | “提交申请” / “提交后等待审核” | 按原插件接口与验证码流程提交 |
| 留言兜底且留言开放 | “生成申请内容” / “生成后复制到留言板提交” | 生成不等于提交；用户仍需完成留言 |
| 留言兜底但留言关闭 | “生成申请内容” / “留言已关闭，生成的内容可复制保存” | 保留可复制草稿，隐藏前往留言板提交的按钮 |

申请视图保留一个 H1，删除重复介绍、卡片标题和说明卡；识别用“正在识别”“识别完成，请核对站点信息”等短反馈，失败保留重试或手动填写路径。401/403 导致能力降级时仍说明当前会话不能直接添加；不通过隐藏权限错误制造成功假象。

Markdown 仍是生成内容的实际格式，只是不再成为完成申请必须理解的界面术语。“站点名称”的示例也改为用户可理解的文本。留言关闭时的旧误导一并修正，没有虚构额外提交能力。

## 已保留：有效的旧修改

| 功能域 | 保留内容及理由 | 适用边界 |
| --- | --- | --- |
| 全局导航与路由 | 使用实际路由和 LinkBuilder、保留预览参数；旧 Friends 入口指向 Links 动态；访客身份字段、菜单原生按钮、关闭和焦点行为修复 | 辅助名称、正确跳转和历史恢复不是文字噪声 |
| 全局运行时 | 偏好存储失败回退、页面清理、模块加载失败恢复、按页面生命周期执行；共享外链与模态焦点工具 | 只保留真实目标的生命周期，不据旧成功记录承诺所有插件版本 |
| 加载与动画 | 全屏加载私有类避免污染普通 loading；保留真实等待反馈及减少动画偏好 | 动画风格不在本轮整体重做 |
| 登录/注册/重置 | 密码显隐、键盘可达、禁用/错误状态、移动布局及 Halo 核心表单契约 | 未真实注册、重置、发验证码或完成外部 SSO |
| 文章/独立页面/作者 | 正文及媒体完整性、页面封面与权限边界、标题复制失败恢复和乱序隔离、正确作者及分享入口 | 没有因视觉精简删除正文、媒体或失败反馈 |
| 分类/标签 | 子分类递归、实际路由、空态、长内容和卡片可访问名称；杂志样式触屏/键盘可见性 | 本轮只改分类入口密度，不撤回完整分类树 |
| Links | 官方权限分支、单次游标加载、去重与可重试、详情保持、收藏/已读并发保护、识别取消和旧结果隔离、Logo 回退 | 列表与详情交互修复保留；仅改变呈现不冒充新插件能力 |
| Moments | UC 发布、附件数量与上传接口、取消/超时、防重复提交、草稿保护、单向点赞、完整展示历史媒体 | 未实测业务写入；单向点赞不改成虚构的取消点赞 |
| Photos | 原始尺寸占位、分页不回顶、灯箱延迟重建/关闭清理、图片失败与重试、坏图禁止打开及焦点保护；移除不支持的列表评论 | 仅失败时出现的短提示具有恢复价值，应保留 |
| Docsme | 正确插件字段、正文原样输出、局部宽表滚动、抽屉断点、移动版本/语言入口、切换保留正文路径、分享片段、公式生命周期 | 多语言/版本数据与所有正文类型仍按实际覆盖说明 |
| Equipment | 官方分组路由与分页、规格只拆首个分隔符、长值换行、窄屏网格、单份真实空态；移除不支持的评论主体 | 不以主题额外捏造插件没有的详情或评论能力 |
| Steam | 请求隔离、离页取消、热力图完整分页与去重、日历日期不偏移、背景失败终止及减少动画 | 本轮补分页等待门禁，不撤掉之前的乱序保护 |
| Douban / Bangumi | 豆瓣分页边界与等待保护、筛选选中状态、Dock 辅助名称；追番背景定时器取消和减少动画偏好 | 不为图标可发现性盲目添加常驻文字 |
| 小组件 | 文档/图库/友链/Steam/追番等入口使用正确链接；归档和热力图使用正确数据及日期路径 | 数据和入口修复保留；小组件数量不是新增功能数 |
| 嵌入插件 | Contact Form 离页清理；Restricted Reading 弹窗关闭及主题配色；Shiki 幂等处理和无进展终止；正文 blur 保留；插件启动变化时整页恢复 | 这些关系到内容与访问体验，不能当装饰代码回退；实际提交、支付、模型调用等另需业务验收 |

## 需完善：本轮完成的交互补齐

| 项目 | 之前不足 | 当前处理 | 已有证据与边界 |
| --- | --- | --- | --- |
| 分类入口密度 | 在“1 父分类＋20 子分类”的隔离样本中，递归后全部 21 项常驻，原先按顶层数量判断的折叠失效 | pills/chips/underline/glass 分别收拢到 6/10/12/10；允许展开全部，收起仍保留末尾当前分类 | 1920px 与 390px 隔离真实模板，四种样式键盘展开 21 节点、收起、当前项可见通过；没有删分类或更改路由 |
| Docsme 选择器 | 已共用版本/语言片段，但只切视觉 class，未同步展开语义和 Escape | `aria-expanded`、唯一 `aria-controls`；Escape 先关闭内层并返回按钮，第二次可交给抽屉；外部点击同步关闭 | 17 项直接回归通过；真实页面覆盖见最终浏览器小节 |
| Steam 分页 | 旧请求可被隔离，但等待时重复点击仍取消并重发同一目标页 | 加载时禁用分页，点击表达式另加守卫 | 6 项直接回归通过，保留直接加载函数的乱序和失败恢复测试 |
| 手机标题复制入口 | 修复出视口后，行首主色图标仍抢占标题注意力；原 `a` 点击始终被阻止导航，实际只执行复制 | 移到标题文字末尾，使用次级色，保持至少 24×24 CSS px 点击目标；改用原生 `button`，保持原图标并支持 Enter/Space | 保留标题复制、失败提示、重试、焦点和旧响应隔离；最终真实布局见浏览器小节 |
| 申请路径反馈 | 去重若不区分能力，容易把草稿称为已提交，或隐藏权限降级 | 分支说明收敛到一处，生成/提交语义分明；关闭留言仍能复制保存 | Links 89 项直接回归通过，未真实提交申请 |

## 验证结果与限制

下列构建、模板和服务结果来自本轮主代理已完成的运行记录；不能互相替代。直接回归包含在更大的检查集合中，不将重叠次数相加为覆盖率。

| 验证层 | 已知结果 | 不能推出的结论 |
| --- | --- | --- |
| 完整构建 | `pnpm build` 通过；413 项通过，2 项可选 Java 检查跳过；Node 24.21.0 / pnpm 12.6.0；`HALO_AUTH_CORE_SCRIPT` 使用本机真实核心脚本；末次原生按钮修复后完整构建再次通过 | 跳过不是通过；构建不证明真实业务链完成 |
| 静态门禁 | lint、format 通过；本批定向 diff 检查通过 | 不等于视觉或浏览器验收 |
| 直接回归 | Links 89/89、Docsme 17/17、Steam 6/6 | 替身响应不等于真实插件写入成功 |
| 模板数据 | 181 项通过；本机 Thymeleaf 3.1.5 + Spring 6.2.9 | **不是 Halo 实站运行依赖组合**，不得标为当前 Halo 全量模板验收 |
| 评论 Java 夹具 | 首次缺少 `JsonPropertyAccessor` 无法编译；加入现成本地 Spring Integration 7.1.1 后，Links 的 `page_description` 在 ComparableJsonNode 上出现 EL1008E。修改前快照在相同依赖组合下复现同一错误；未下载依赖 | **验证环境未通过，夹具未完成**；不能沿用历史评论场景成功数抵消本轮失败 |
| 缓存与服务身份 | 模板缓存 invalidate 返回 204，Page Cache 返回 200；末次构建后再次清缓存，抽查 15 份资产、15 份服务端字节哈希匹配本地 | 仅证明抽查资产和缓存请求，不证明每个动态分支 |
| 分类密度专项 | 1920px/390px、四种样式、真实隔离 21 节点的键盘展开/收起及当前项可见通过；Java 分类夹具使用现成依赖，未下载依赖 | 不扩展成所有分类数据、皮肤或真机触摸已通过 |
| 插件只读检查 | 36 通过、0 失败、12 未覆盖（未配置专项 URL） | 未覆盖不是通过；不冒充真实写入或全部插件功能兼容 |

### 最终浏览器结果

实际环境为 `localhost:8090`、Halo 2.27.1、主题 1 请求级预览；Chrome 独立访客上下文，桌面 1440×1000 与手机视口 390×844。主代理以 DevTools 设备模拟确认 `innerWidth`，没有把窗口最小宽度 500px 当作 390px。末次仅为文档返回顶部补辅助名称，随后重新构建、清缓存并核对实际文档 DOM；其他专项所测功能代码未再更改。

- **18 条布局记录**：`/`、`/archives`、`/categories`、`/about`、`/moments`、`/steam`、`/links?view=apply`、`/docs`、`/docs/halo-theme-sky-blog-1` 各在 1440/390 检查，目标主题正确、页面非空、无横向溢出。这是本次受影响区域的检查，不是所有路由或业务全量验收。
- **文章与分类详情补验**：`/archives/editor-feature-demo` 两端确认标题复制按钮，Enter/Space 各调用一次隔离剪贴板；390px 目标 24×24、图标位于文字末尾。`/categories/halo` 两端实际 5 个分类全部可见且当前项正确；21 节点压力场景使用独立模板样本，未改站点分类。
- **Docsme**：桌面版本选择器打开、Escape 关闭及回焦通过；手机先滚动显示 Dock，再展开文档工具、打开菜单，第一次 Escape 只关版本选单并回焦，第二次关闭抽屉，焦点回到工具入口并解锁滚动。手机滚动前 Dock 按既有逻辑隐藏，不把隐藏侧栏当作可操作选择器。另补返回顶部图标的辅助名称，保持图标外观。
- **Steam**：当前真实列表从第 1 页到第 2 页；只延迟浏览器读取请求，pending 时前后按钮均禁用，双击只产生一次请求，完成后上一页恢复。没有修改插件或游戏数据。
- **Links**：申请页保留单一 H1，无重复介绍/卡片标题；访客生成样本草稿后明确提示“复制后到留言板提交”，没有发出业务写请求。管理员、公开申请和关闭留言分支由隔离回归验证，未冒充真实申请提交。
- **共享分享**：文章手机、文档桌面的当前组件临时设为空平台，平台区域隐藏、复制区保留，关闭后焦点和滚动恢复；组件状态恢复，未更改主题设置。常规发布后的真实剪贴板和外站分享未执行。
- **瞬间**：两端访客页面布局通过；登录后的权限检查、提交结果互斥、4 秒收起、草稿及旧任务保护由 69 项隔离回归覆盖，本轮没有登录发布、上传或点赞。
- **地图与归档**：实际无 Key 地图卡保留地点和有效外链，不显示配置指导；归档不再显示重复副标题或“100 篇”实现说明。地图成功/失败其他分支仍由既有直接回归覆盖，不等于有效 Key 的远端调用通过。

关键页面截图已在工具中逐张查看；本轮没有保存一套新的完整前后对比图。分类专项另有本地隔离截图 `/tmp/sky-ux-review-20261106-q8Etkb/category-density/desktop.png`。Links 首次复验发现浏览器仍运行旧缓存 JS，该次观察作废，`ignoreCache` 重载后才验收新文案；不能用服务端哈希匹配独自证明浏览器已执行新版。

[本轮脱敏证据](./evidence/2026-11-06/ux-change-review.json)包含 16 个运行文件增量、环境、15 份资源哈希、18 条布局记录、交互边界和测试结果。完整临时日志位于 `/tmp/sky-ux-review-20261106-q8Etkb/`。分类代理使用 Ego Browser，任务空间已结束；该工具提示有可选更新，本次未升级。主代理自建 DevTools 访客页已关闭，用户原有页面保留。关键 Links/Docs 页面控制台未观察到错误；没有据此宣称所有第三方资源或后端日志完全无异常。

### 尚未解决的验收与发布边界

1. 真实发布、附件上传、评论/友链申请提交、受保护 RSS 状态写入、认证/外部 SSO、第三方地图有效 Key 及其他外部服务业务，不由本轮源码审查或替身测试证明。
2. 全部插件配置、文档多语言/版本、正文类型、装备皮肤与实体触屏设备没有因此获得全量验收。
3. 评论 Java 夹具需要正确依赖组合后重跑；本机模板 181 项不能替代 Halo 实站版本匹配检查。分类代理额外启用可选 UI Java 用例时为 64 通过、1 失败（手机菜单夹具同样缺少 JsonPropertyAccessor），此结果不计入默认构建通过数。
4. **11 月 3 日发布检查中的 9 条依赖 audit 发现及其既有发布门禁，未在本轮 UI 收敛中处理。** 它们不计为本轮新增 UI 缺陷，也没有被本轮构建、lint 或浏览器检查关闭；本报告不宣称发布就绪。
5. 历史报告保留各自指纹与验证范围。此前“全局复验通过”不能覆盖本轮尚未执行的分支，本报告也不改写旧记录为今日证据。

## 附录：97 个运行文件的处理清单

来源为原始 inventory 中所有 `src/**` 与非构建产物的 `templates/**`。状态“保留”仅表示本轮不撤销该文件的既有修改，**不表示文件每个配置与每条业务分支都已经验收**。状态“本轮调整”表示相对 11 月 6 日前置快照发生变化，文件内原有的有效修复仍保留。

### Links（2 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [src/apps/links/runtime.js](../../../src/apps/links/runtime.js) | 本轮调整 | 精简申请/识别/错误反馈，准确区分提交与生成，保留权限及并发逻辑 |
| [templates/modules/links/content.html](../../../templates/modules/links/content.html) | 本轮调整 | 去重复标题/说明，隐藏关闭留言时的提交入口，准确呈现关闭状态 |

### 全局导航、共享组件与嵌入插件运行时（18 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [src/common/css/base.css](../../../src/common/css/base.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/common/css/loading-screen.css](../../../src/common/css/loading-screen.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/common/js/alpine-modules.js](../../../src/common/js/alpine-modules.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/common/js/base.js](../../../src/common/js/base.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/common/js/toc-utils.js](../../../src/common/js/toc-utils.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/common/main.js](../../../src/common/main.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/static/css/article-content.css](../../../src/static/css/article-content.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/static/emoji/emoji-selector.js](../../../src/static/emoji/emoji-selector.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/static/js/article-content.js](../../../src/static/js/article-content.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/floating-dock.html](../../../templates/modules/floating-dock.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/footer.html](../../../templates/modules/footer.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/loading-screen.html](../../../templates/modules/loading-screen.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/nav.html](../../../templates/modules/nav.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/share-modal.html](../../../templates/modules/share-modal.html) | 本轮调整 | 无分享平台时隐藏空平台区域，保留复制 |
| [templates/modules/theme-script.html](../../../templates/modules/theme-script.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/common/js/external-links.js](../../../src/common/js/external-links.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/common/js/modal-focus.js](../../../src/common/js/modal-focus.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/common/js/plugin-script-lifecycle.js](../../../src/common/js/plugin-script-lifecycle.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |

### 关于页与地图（3 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [src/pages/about/about.css](../../../src/pages/about/about.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/about/about.js](../../../src/pages/about/about.js) | 本轮调整 | 保留地点与有效外链，删重复无 Key 指引，压缩地图状态 |
| [templates/modules/about/content.html](../../../templates/modules/about/content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |

### 登录、注册与认证页面（11 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [src/pages/auth/auth-common.css](../../../src/pages/auth/auth-common.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/auth/auth-common.js](../../../src/pages/auth/auth-common.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/auth/themes/illustration.js](../../../src/pages/auth/themes/illustration.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/auth/themes/split.css](../../../src/pages/auth/themes/split.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/gateway_fragments/common.html](../../../templates/gateway_fragments/common.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/gateway_fragments/layout.html](../../../templates/gateway_fragments/layout.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/gateway_fragments/login.html](../../../templates/gateway_fragments/login.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/gateway_fragments/password_reset_email_reset.html](../../../templates/gateway_fragments/password_reset_email_reset.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/gateway_fragments/signup.html](../../../templates/gateway_fragments/signup.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/login.html](../../../templates/login.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/login_local.html](../../../templates/login_local.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |

### Steam、Douban 与 Bangumi（7 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [src/pages/bangumi/bangumi.css](../../../src/pages/bangumi/bangumi.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/bangumi/bangumi.js](../../../src/pages/bangumi/bangumi.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/douban/douban.js](../../../src/pages/douban/douban.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/steam/steam.css](../../../src/pages/steam/steam.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/steam/steam.js](../../../src/pages/steam/steam.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/steam/content.html](../../../templates/modules/steam/content.html) | 本轮调整 | 翻页等待时禁用按钮并阻止重复激活 |
| [templates/modules/steam/layout.html](../../../templates/modules/steam/layout.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |

### Docsme（9 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [src/pages/doc/doc.css](../../../src/pages/doc/doc.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/doc/doc.js](../../../src/pages/doc/doc.js) | 本轮调整 | 补选择器展开语义、Escape、焦点恢复 |
| [templates/modules/doc-catalog-content.html](../../../templates/modules/doc-catalog-content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/doc-content.html](../../../templates/modules/doc-content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/doc-layout.html](../../../templates/modules/doc-layout.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/doc/floating-dock.html](../../../templates/modules/doc/floating-dock.html) | 本轮调整 | 返回顶部纯图标补原生按钮类型与辅助名称，不增加可见文字 |
| [templates/modules/docs-content.html](../../../templates/modules/docs-content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/doc/math.js](../../../src/pages/doc/math.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/doc/selectors.html](../../../templates/modules/doc/selectors.html) | 本轮调整 | 使用原生按钮与初始展开状态，保持纯图标/既有标签 |

### Equipment（7 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [src/pages/equipment/equipment.css](../../../src/pages/equipment/equipment.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/equipments/card-simple.html](../../../templates/modules/equipments/card-simple.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/equipments/card.html](../../../templates/modules/equipments/card.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/equipments/content.html](../../../templates/modules/equipments/content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/equipments/group-switch.html](../../../templates/modules/equipments/group-switch.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/equipments/style-simple.html](../../../templates/modules/equipments/style-simple.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/equipments/style-tech.html](../../../templates/modules/equipments/style-tech.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |

### Moments 与首页瞬间入口（6 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [src/pages/moments/moment-publish.js](../../../src/pages/moments/moment-publish.js) | 本轮调整 | 收敛权限与发布反馈，清理旧反馈并防旧刷新覆盖 |
| [src/pages/moments/moments.css](../../../src/pages/moments/moments.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/moments/moments.js](../../../src/pages/moments/moments.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/index/header/moments.html](../../../templates/modules/index/header/moments.html) | 本轮调整 | 恢复纯箭头入口，保留准确名称与跳转含义 |
| [templates/modules/moments/content.html](../../../templates/modules/moments/content.html) | 本轮调整 | 删除固定审核承诺，保留结果与恢复区域 |
| [templates/modules/moments/detail.html](../../../templates/modules/moments/detail.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |

### 文章、独立页面与作者页（10 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [src/pages/page/page.css](../../../src/pages/page/page.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/page/page.js](../../../src/pages/page/page.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/post/post.css](../../../src/pages/post/post.css) | 本轮调整 | 手机标题复制入口移末尾、次级色、24px 点击目标 |
| [src/pages/post/post.js](../../../src/pages/post/post.js) | 本轮调整 | 复制入口放在标题文字之后并采用原生按钮，支持 Enter/Space，保留失败反馈与乱序隔离 |
| [templates/modules/author/content.html](../../../templates/modules/author/content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/page/content.html](../../../templates/modules/page/content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/post/article-footer.html](../../../templates/modules/post/article-footer.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/post/content.html](../../../templates/modules/post/content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/post/floating-dock.html](../../../templates/modules/post/floating-dock.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/page/cover.js](../../../src/pages/page/cover.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |

### Photos（4 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [src/pages/photos/photos.css](../../../src/pages/photos/photos.css) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [src/pages/photos/photos.js](../../../src/pages/photos/photos.js) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/photos/content.html](../../../templates/modules/photos/content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/photos/detail.html](../../../templates/modules/photos/detail.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |

### 归档（2 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [templates/modules/archives/content.html](../../../templates/modules/archives/content.html) | 本轮调整 | 删除重复副标题 |
| [templates/modules/widgets/archive-sidebar.html](../../../templates/modules/widgets/archive-sidebar.html) | 本轮调整 | 删除向访客暴露的 100 篇实现说明，保留归档功能 |

### 分类与标签（8 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [templates/modules/categories/category-switch.html](../../../templates/modules/categories/category-switch.html) | 本轮调整 | 四种样式渐进展开 21 节点，收拢时保留当前分类 |
| [templates/modules/categories/content.html](../../../templates/modules/categories/content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/categories/list-magazine.html](../../../templates/modules/categories/list-magazine.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/categories/list-media.html](../../../templates/modules/categories/list-media.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/categories/list-minimal.html](../../../templates/modules/categories/list-minimal.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/categories/list-modern.html](../../../templates/modules/categories/list-modern.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/tags/content.html](../../../templates/modules/tags/content.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/tags/tag-switch.html](../../../templates/modules/tags/tag-switch.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |

### 侧栏小组件（10 个文件）

| 运行文件 | 结论 | 本轮处理 |
| --- | --- | --- |
| [templates/modules/widgets/author-card.html](../../../templates/modules/widgets/author-card.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/widgets/bangumi-card.html](../../../templates/modules/widgets/bangumi-card.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/widgets/categories.html](../../../templates/modules/widgets/categories.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/widgets/docs.html](../../../templates/modules/widgets/docs.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/widgets/gallery.html](../../../templates/modules/widgets/gallery.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/widgets/heatmap.html](../../../templates/modules/widgets/heatmap.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/widgets/links.html](../../../templates/modules/widgets/links.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/widgets/steam-card.html](../../../templates/modules/widgets/steam-card.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/widgets/tabs_group.html](../../../templates/modules/widgets/tabs_group.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
| [templates/modules/widgets/tags.html](../../../templates/modules/widgets/tags.html) | 保留 | 保留既有修改；功能与验证边界见正文对应项 |
