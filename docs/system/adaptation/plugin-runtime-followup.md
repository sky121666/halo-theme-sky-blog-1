# 2026-09-22 插件补充验收

目标：补齐原 11 项待验插件的主题运行证据；不将浏览器模拟请求等同于真实业务接口通过。9 月 23 日重新核对官方稳定版后，AI Assistant 的目标由 3.0.0 更新为 3.1.0；其余 46 项正式目标不变。

后续专项浏览器复验已补齐 **AI Assistant 3.1.0 的既有摘要组件展示与 PJAX 清理**，但自动摘要仍关闭，服务端自动注入和编辑器 Agent 未验。[原证据与指纹](./evidence/2026-09-23/seo-cache-ai-followup.json)将 AI/Passkey 的旧代码指纹和 SEO 接管的新代码指纹分别记录：后者在临时互斥配置下通过 15 URL、真实浏览器与后台日志定向验收，并已恢复原站点配置，不能替换下文当时的测试快照或宣称当前站点已启用 SEO 修复。

中间代码指纹 `bd7460b48581ce36481cba0786fa5d92ed47bad105c4e1650d0dba273be27318` 下，Passkey 1.0.4 新专用 guest 账号的用户中心凭据列表确实 403；显式赋予插件随包提供的 `plugin-passkey-role-template-authenticated` 后，真实浏览器显示“暂无 Passkey”和“添加 Passkey”。测试账号、角色绑定和临时凭据文件已清理，没有创建 Passkey，也没有发送邮件。浏览器工具不支持虚拟 WebAuthn 认证器，注册、登录及删除流程仍待可用的真实或虚拟认证器环境验收；只验证了 guest 权限，不推断所有普通角色。[权限、浏览器结果与清理证据](./evidence/2026-09-23/passkey-permission-latest-code.json)。同一指纹的[完整路由浏览器记录](./evidence/2026-09-23/browser-routes-latest-code.json)和[后端异常定位](./evidence/2026-09-23/backend-followup-latest-code.json)另行记录追番偶发 500 与装备分页警告。最终代码 `74d214a...` 在原配置下另有[114 路由浏览器复测](./evidence/2026-09-23/browser-routes-post-warning.json)和[后端窗口日志](./evidence/2026-09-23/backend-log-post-warning.json)，不能倒填为 Passkey 注册流程通过。

相同 Head 渲染代码下，再次临时切换 canonical 开关并扩展至[114 路由 HTTP/浏览器抽查](./evidence/2026-09-23/seo-full-http-temporary.json)，发现独立插件页 `/dishes`、`/schedule-calendar` 在 SEO Tools 全局 canonical 关闭后从 1 条变成 0；主题设置现标为“仅由主题页面”实验选项，不能将这条互斥配置作为全站修复。第一次扩展扫描把开关写错配置层级，已[单独标无效](./evidence/2026-09-23/seo-full-http-invalid-config.json)，正确配置后才形成上述结论。两个 ConfigMap 已逐项恢复原值、Reload 并刷新 Page Cache，临时快照已删除；本地当前仍由 SEO Tools 输出集合页原错误。

基线：本地 `http://localhost:8090`，Halo Pro 2.26.1，主题 2.2.39；版本来源与原始证据见 [运行态审计](./main-halo-runtime-audit.md)。保留原记录，新增测试另附代码内容指纹。

## 当前收口补记（2026-09-23）

原浏览器任务空间失效后，用户继续要求全界面、全路由和 GitHub 问题复测。本地新任务空间已完成[29 类页面浏览器进入](./evidence/2026-09-23/browser-routes-final.json)、[分类分页/代码块/移动友链交互](./evidence/2026-09-23/browser-interactions-final.json)并按技能要求正常结束；当前代码的[插件深度烟测 33/33](./evidence/2026-09-23/full-route-final.json)及[114 路由扫测](./evidence/2026-09-23/route-sweep-final.json)另有精确指纹。逐插件最新结论见[当前 45 项结果](./current-plugin-results.md)。下方 47 项安装、32/32 烟测、浏览器不可用和旧代码指纹均保留为采集时的历史状态，不表示当前仍如此。

## 9 月 23 日后续状态

后续范围调整：用户确认 Friends 与 PluginLinks 的友链动态重复，已退出主题适配目标。下方 Friends 临时启动失败仍是当时的准确诊断，但不再构成主题待验或修复项；当前入口改为 `/links?view=friends`，新版代码的验证另记于[主运行审计](./main-halo-runtime-audit.md)。最新 Console 清单已无 `plugin-friends` 与 `link-submit`；此前禁用安装是历史快照，本轮没有执行卸载。

本地 AI Assistant 已由初次验收的 **3.0.0** 变为 **3.1.0 / STARTED**；实装 JAR 的 SHA256 与官方 3.1.0 制品一致，摘要 JS/CSS 和 RAG UI 资源均返回 200，当前主题代码的读取型深度烟测通过 32/32（原禁用 Friends 跳过 1 项）。AI Foundation 1.1.0 中已有用户设置的 `deepseek-flash`：提供者状态 `OK`，该模型同时是 Foundation 默认语言模型和 AI Assistant 摘要所选模型；自动摘要仍为 `enabled=false`，旧 `deepseek-chat` 配置保留。用户报告手动测试通过；本轮没有再次调用模型，只读核对到一条新生成的 Flash 摘要，内容非空、带 token 统计，匿名与管理员按文章引用读取摘要均为 200。**后端生成及读取已验证，自动注入和浏览器展示未验。**准确组合、资源状态和代码指纹见[后续运行观测](./evidence/2026-09-23/followup-runtime.json)。

## 初次验收时的已核实条件

- KaTeX 3.0.0 已开启客户端渲染，选择器为 `.math-inline` / `.math-display`，无需为测试调整此设置。
- Text Diagram 1.5.2 使用默认 Mermaid 内容选择器；主题负责 PJAX 补渲染及 `data-color-scheme` 变化后的重绘。
- 演示文章已有真实投票和三种块级、一种行内超链接卡片；现有投票已结束，不向这些业务记录提交测试票。
- Friends 1.4.6 已禁用；维护模式开关为关闭。
- AI Assistant 3.0.0 与 AI Foundation 1.1.0 已启动；自动摘要关闭，摘要未选择模型。

## 已授权的本地业务验收范围

用户已明确授权下列本地测试资源及临时开关的写入和恢复；未授权真实支付、个人 Passkey、通知发送、生产部署与 Git 提交。独立模型迁移的授权见下节。

| 对象 | 测试动作 | 恢复及边界 |
| --- | --- | --- |
| 测试文章 | 仅新建带 `codex-plugin-qa-20260922` 标记的样本，覆盖公式、绘图、表单、抽奖、投票和受限内容 | 不改现有文章；完成后只删除本次创建的文章及关联测试记录 |
| 联系表单 / 投票 / 抽奖 | 新建同一标记的测试资源，验证校验、提交、重复限制和结束状态 | 不向既有资源提交；表单通知关闭，不发送真实邮件或通知，不配置真实奖品 |
| Friends | 临时启用已安装的 1.4.6，检查与 Links 2.3 的启动、读取、分页和空态 | 保存原状态并恢复禁用；不手动触发外部 RSS 同步 |
| Maintenance | 短暂开启本地维护模式，分别读取匿名入口和白名单入口，再关闭 | 原始配置完整备份；在 finally 中恢复并复查首页与 Console |
| Passkey | 独立测试账号与浏览器虚拟认证器，验证注册、登录及删除 | 不绑定或删除个人硬件凭据；仅清理本次测试账号和虚拟凭据 |
| AI Assistant | 先完成真实既有摘要读取、组件生命周期与错误态测试 | 模型配置和一次调用另获单项授权；不启用全站自动摘要，不重建 RAG |
| 受限阅读 Pro 支付 | 检查组件、入口、错误态及官方 1.9 接口差异 | 不创建真实支付订单、不付款、不修改支付渠道配置；真实支付回调留作独立验收 |

所有站点变更应使用官方 API，记录创建资源的准确 ID，并在操作前保存恢复信息。浏览器临时 DOM 样本、受控响应、真实后台请求分别记录。最终记录不得用模拟通过覆盖真实流程的未测状态。

### 单独的 AI 模型迁移方案

只读核对：Foundation 当前没有模型；旧摘要配置为 `deepseek / deepseek-chat`，对应旧凭据存在，未在报告中输出凭据。

用户已单独授权：在 Foundation 新建专供摘要使用的 DeepSeek 提供者及 `deepseek-chat` 模型，沿用本地旧凭据；保留旧配置，不启用全站自动摘要，不重建 RAG 知识库，只对本轮测试文章发起一次模型调用。模型调用失败时删除新建配置、恢复原摘要选择。不迁移其他旧提供者。

实际执行：Foundation 会将模型的 `metadata.name` 改写成包含提供者和哈希的名称。第一版测试脚本使用请求时填写的名称，端点在本地报 `ModelNotFoundException`，日志确认请求未到达模型供应商。脚本改为读取响应中的实际名称后，唯一到达 DeepSeek 的测试文章请求返回 **401 invalid API key**。原凭据仍保留在旧配置，新建 Secret / Provider / Model 均已删除，摘要仍为 `enabled=false`、未选择 Foundation 模型。没有生成摘要，也没有重试真实模型调用。对应 Halo 日志时间为 2026-09-23 07:27:34 与 07:28:40（北京时间），具体凭据不写入报告。

## 结果

2026-09-23 阶段结果（全部基于本地 Halo Pro 2.26.1；精确插件版本见表，主题为 2.2.39 未提交代码；每条测试保留其采集时的代码指纹）：

| 插件 | 稳定目标 / 本地安装 | 实际代码与运行结果 | 剩余边界 |
| --- | --- | --- | --- |
| KaTeX | 3.0.0 / 3.0.0 | 真实文章 2 处公式首次加载及 PJAX 返回均渲染，0 错误 | 编辑器 3.0 新预渲染样本尚未验收 |
| Maintenance | 1.1.0 / 1.1.0 | 临时启用后本地 GET 收到 302 指向配置的绝对站点 `/maintenance`；localhost 直接读取独立维护页为 200，标题和说明正确；开关已恢复 | 绝对域名跳转不作为本地页面验收；浏览器交互待补 |
| Lottery | 1.0.2 / 1.0.2 | 无奖品测试活动与通知关闭设置已建立；公开接口拒绝参与并提示必须先验证 Redis，手动开奖返回“无人参与”；通知与验证码设置已恢复 | 当前 `effectiveSource=NONE`、`connectionVerified=false`，参与、重复限制和开奖受阻 |
| Passkey | 1.0.4 / 1.0.4 | 专用账号密码登录曾解锁受限文章；凭据列表对该账号返回 403；官方插件角色已安装，管理员读取为 200 | 注册、WebAuthn 登录和删除未通过；需查明用户权限与本地站点 Origin |
| Vote | 1.1.3 / 1.1.3 | 专用单选、多选、PK 三个资源经真实页面各提交一票；多选上限 2 的后台结果为 2 选项，单选和 PK 各 1 用户 | 重复投票、结束态与移动端仍待补 |
| Text Diagram | 1.5.2 / 1.5.2 | 专用文章 Mermaid 输出真实 SVG，PJAX 返回仍有 1 个 SVG | 明暗重绘和 PlantUML 仍待补 |
| Friends | 1.4.6 / 1.4.6（原禁用） | 临时启用时启动失败，日志为 `RssSyncReconciler` 的 `ObjectMapper` 类加载冲突；已恢复禁用 | 插件启动受阻，无法验证 Finder、路由和分页；主题不能修复插件 JAR 的类加载 |
| Contact Form | 1.6.4 / 1.6.4 | 专用表单的必填校验与真实提交成功，后台生成 1 条测试 Entry；修复离开指定页后悬浮 Loader 残留，PJAX 离页 0 个、返回 1 个 | 上传、弹窗和移动端待补 |
| AI Assistant | **3.1.0** / **3.1.0**（最初为 3.0.0） | 官方 3.1.0 摘要 JS/CSS 与 16 个摘要类和 3.0.0 相同，实装 JAR 匹配官方 SHA；3.1.0 启动及资源读取通过，Flash 摘要生成记录和公开读取接口均通过；旧 Chat 凭据调用曾返回 401 | **后端生成/读取已验证，前台运行验证待完成**；自动注入、浏览器生命周期与编辑器能力未验 |
| Hyperlink Card | 1.9.2 / 1.9.2 | 真实演示文章输出 `hyperlink-inline-card` 1 个与 `hyperlink-card` small/regular/grid 各 1 个，外链带安全属性 | 首轮浏览器探针用错标签已作废；明暗、移动和 PJAX 交互待补 |
| Restricted Reading | 1.9.1 / 1.9.1 | 专用登录限制文章的匿名响应有解锁组件，隐私正文未泄漏；专用账号登录后曾观察到正文 | 答题/评论/支付模式未测；不执行真实付款或个人账号操作 |

原本的 9 月 22 日全量报告仍为其当时的快照，以上结果不回填旧 `testedVersion`。当前代码修复位于 `src/common/main.js`，源于插件 1.6.4 在新页配置为空时先返回，未清理挂在 `body` 的旧 Loader；主题离页清理之后，新页仍可由官方 Loader 正常挂载。未触碰用户现有内容。

[逐条运行与恢复证据](./evidence/2026-09-23/followup-runtime.json)记录了 24 次测试/诊断事件及当时各自的 `codeHash`，其中失败、部分通过和作废的探针仍保留，不能直接按事件数计算“通过项”。该次补充验收收尾时代码指纹为 `94da2d4b233512dbb3d4e9832281506a0c029f467598928a219728eeb58b9c62`，Halo 2.26.1 / 主题 2.2.39；`pnpm run lint`、`pnpm run build`、深度读取型烟测 `32/32`（另跳过原本禁用的 Friends 1 项）及 `git diff --check` 通过。深度烟测在 AI Assistant 升到 3.1.0 后已重新执行。该次包 SHA256 为 `6e58dd93f2ae12baa828989fad73988f58d8a202b454a8974ab73fd0617cc019`。

临时测试资源已清理：两篇专用文章、表单及 Entry、三类投票及 VoteData、抽奖活动、登录记录、测试账号和两个角色绑定均无残留；清理脚本错误为 0。维护和抽奖 ConfigMap 的完整数据与修改前一致，Friends 恢复 `DISABLED`；**本次测试创建的** AI Secret / Provider / Model 均不存在。用户随后设置的 Flash 提供者和模型保持原样，旧 DeepSeek 配置保留、自动摘要仍关闭。该时点插件总数 47、`STARTED=44`、`DISABLED=3`，本地首页 200；之后 Friends 与 Link Submit 退出清单，最新实装为 45 项。

原浏览器任务空间曾隔夜丢失，后续新任务空间的页面与部分移动交互结果见本文件开头。上传、弹窗、答题及完整 Passkey 流程仍待验；不会把 API 或源码读取替代页面交互。旧 `deepseek-chat` 凭据此前被 DeepSeek 拒绝；用户新设的 Flash 已有真实摘要生成记录和接口读回，用户手测的具体范围仍待明确。公开文章 HTML 未自动插入 `ai-summary-widget`，与当前 `enabled=false` 一致，不能据此声称自动摘要展示通过。
