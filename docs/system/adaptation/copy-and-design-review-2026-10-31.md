# 2026-10-31 复制修复、全局复验与设计规范核对

**结论：已确认的主题侧问题已修复；最终代码的32类代表路由和专项交互通过。已核对部分遵守现有设计约束，但不宣称全站所有配置逐像素一致或所有插件业务全部验收。**

本轮仅修改主题源码、既有回归和说明；插件、业务配置、数据库和正文未修改，未暂存、提交、推送或发布。

## 最终环境与证据

- Halo Pro **2.27.1**，主题候选 **2.2.41 / >=2.27.0**；活动主题仍为theme-sky-blog-3，通过请求级`preview-theme=theme-sky-blog-1`验证主题1。
- Node **24.21.0** / pnpm **12.6.0**。
- 最终指纹：`1f12d5712c119c22fa0a51243a47ca8e91c2ce15ad85ae974d4d066bfae67227`，401个代码/模板/构建/脚本输入文件。
- 模板与Page Cache已刷新；50/50份服务端JS/CSS哈希匹配本地。
- [脱敏精确组合和结果](./evidence/2026-10-31/copy-design-review.json)；完整日志与截图暂存`/tmp/sky-copy-design-20261031/`，不将临时截图加入Git。
- 本轮不重新核定全部官方最新发行；2026-10-27版本审计、技能基线、契约及历史实测记录仍分开保留，不机械提升`testedVersion`。

## 修复与人工验收入口

所有地址以`http://localhost:8090`为前缀，并保留预览参数。

| 路由/组件 | 问题与修复方法 | 本轮验收 |
|---|---|---|
| `/archives/editor-feature-demo?preview-theme=theme-sky-blog-1`、文档和瞬间的共用分享 | 同一打开会话的旧复制失败覆盖新成功；按操作序号隔离结果、定时器和焦点，保留开关会话与销毁保护。 | 桌面/手机真实复制按钮+Promise替身控制乱序；旧失败不覆盖新成功。 |
| 同一文章页的标题图标 | 拒绝后静默；现显示可重试提示，成功清除，并在离页清理。提示仅失败时插入、重试移除，保留正常`h1+h2/h1+p`相邻排版。 | 两端拒绝→提示→重试成功→图标定时恢复；新旧请求及离页回归通过。 |
| 同一文章页的手机标题图标 | 原H1图标x=-23px、H2 x=-17px，完全出视口；<=640px改为标题行内图标，保持16px尺寸，不增加常驻文字，桌面保留原规则。 | 六级标题图标均在390px视口内；320/390px临时长标题正常换行、无横向溢出。 |
| `/douban?preview-theme=theme-sky-blog-1`的右侧Dock | 补图标按钮辅助名称、同步展开状态、原生关闭按钮及Escape；外观与daisyUI focus-within机制保留。 | 聚焦展开、内部移动、关闭和Escape通过；没有把所有图标替换为文字。 |
| `/douban?preview-theme=theme-sky-blog-1`筛选 | 原先只切换视觉active类；现动态创建和所有状态更新同步`aria-pressed`。 | 初载/异步/重置Node回归；真实点击和历史返回通过。 |
| `/steam?preview-theme=theme-sky-blog-1`、`/bangumis?preview-theme=theme-sky-blog-1` | 装饰浮动/入场未覆盖减少动画偏好；增加局部`prefers-reduced-motion`，内容保持可见，不修改默认动画。 | 浏览器reduce为animation:none/opacity:1；no-preference仍保留既有动画。 |

## 是否遵守用户设计规范

| 依据 | 结论与边界 |
|---|---|
| 用户明确要求允许纯图标 | 遵守。Moments心形/评论及Dock保留图标；名称由ARIA提供，复制失败时才显示短提示。 |
| `docs/theme/base/nav.md`与主题配色配置 | 继续使用既有daisyUI语义色、明暗主题和配置；没有引入新配色系统。 |
| `docs/theme/base/general.md`的字体、Dock和背景配置 | 保留配置所有权；Links两端明暗切换后字体一致、无溢出。天气/背景内容可能动态变化，不作为逐像素相等要求。 |
| `design-qa.md`及Links原型 | 三个胶囊入口、40px最小高度、真实数据卡片/侧栏结构保留；已目视对照历史比较图与当前两端、明暗界面。它只约束Links，不冒充全站规范。 |
| 原有多风格配置与正文 | 保留荧光笔标题、页面各自的排版、装备样式与第三方品牌色；没有把Skill通用审美偏好当成用户禁令。 |
| 规范完整性 | 未找到独立完整的全站设计规格；现有文档、配置、批准原型和明确要求足以指导本轮小修，不足以宣称所有主题/页面风格逐像素验收。 |

原生API和语义依据：Clipboard API的异步拒绝按[W3C工作草案](https://www.w3.org/TR/clipboard-apis/#dom-clipboard-writetext)处理；按钮名称和选中状态参考[WAI Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)；减少动画使用[Media Queries Level 5工作草案](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion)中的媒体特性。请求序号是主题内部防止迟到结果的实现，不是虚构的Halo插件接口。

## 验证结果

| 项目 | 结果 |
|---|---|
| `pnpm run build-only` | 417项Node回归通过，0失败、0跳过；typecheck和产物验证通过。 |
| 其他检查 | lint、format:check、git diff --check通过；78/78真实Thymeleaf数据夹具，228个评论模板场景/652断言通过。 |
| 回归有效性 | 两项分享乱序+三项标题复制新增回归修复前5项失败、修复后通过；豆瓣新增3项先RED后GREEN。长标题与图标坐标另有真实浏览器证据，不用字符串镜像测试代替渲染。 |
| 全局HTTP | 121条：119个200，`/terms`及故意不存在的测试路径为预期404；无500。 |
| 插件只读探针 | 41通过、0失败、7未覆盖；不等于41个插件全部业务验收。 |
| 浏览器首屏 | 32类路由×1440/390共64次；无记录到的未处理JS异常、横向溢出、可见无名按钮或可见坏图；已目视检查64张截图。 |
| 相关交互 | 16次共享代表页面/6次分享弹窗；文档同document PJAX、历史返回、旧复制清理；Links三视图；Dock/豆瓣/减少动画/明暗设计检查通过。 |
| 图库回归 | 两端20→40→46张和灯箱通过；可见照片位置差手机约-0.47px、桌面0px，无回顶或遮罩丢失。 |

浏览器复制仅替换本页Clipboard Promise，主题偏好写入仅在内存隔离，长标题仅临时DOM；未向插件提交真实写入，不把这些当作真实业务通过。未实测读屏播报、实体手机触摸或偏好持久化。

## 全局分析与保留边界

- 本批独立复核未发现剩余实质问题。曾怀疑的footer脚本来源问题，经实际HeadPlugin和head同步验证撤回，没有保留该项改动，也不列作修复成果。
- 最终后端窗口内模板表达式/解析异常关键字命中为0；仍有插件分页上限和模板处理中断WARN，以及用户排除的AList后台日志。中断未做请求级因果定位，不因此强改主题或插件。
- 七项未覆盖：Text Diagram、内嵌Contact Form业务、AI Summary模型调用、Shiki代表代码块业务、Lottery Card业务、Restricted Reading业务、启用维护模式。它们不是七个确认故障。
- AI与Passkey保留此前用户手测来源；AList排除；Friends由Links承接；Dishes/Schedule独立插件页的不同主题身份属于预期。
- 验证覆盖当前代表数据和配置；不能据此保证所有皮肤、私有内容、实际写入及外部SSO均无问题。

## 本轮全局浏览器路由

| 类型 | 人工核查URL |
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
| feeds | [/links?view=friends](http://localhost:8090/links?preview-theme=theme-sky-blog-1&view=friends) |
| apply | [/links?view=apply](http://localhost:8090/links?preview-theme=theme-sky-blog-1&view=apply) |
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
| oauth-error | [/login?oauth2_error](http://localhost:8090/login?oauth2_error=&preview-theme=theme-sky-blog-1) |
| missing | [/__sky_ui_missing_20261028](http://localhost:8090/__sky_ui_missing_20261028?preview-theme=theme-sky-blog-1) |

本轮未上传截图、未发布新版本。Ego Lite提示有可选更新，本次未升级。
