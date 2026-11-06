# 2026-10-28 插件主题契约修复方案与进度

## 范围与基线

按用户“制定修复方案，开始修复”的授权实施。只修改主题对插件已有官方能力的接入、必要文档及回归测试。保留当前工作区改动，不修改插件、数据库、站点业务配置或历史评论数据，不进行 Git 暂存、提交、推送或发布。

实施前源码指纹：`4b5b6382d01dc6dba85d5596f47ce2f52d22fa4edc9a16b59c6cbe1ebcfb52a2`；基准提交：`5323cb64b859334b19f8aa6787eac4f4eb1a98ae`。本地最近一次只读观测为 Halo Pro 2.27.1，主题候选版 2.2.41 / Halo >=2.27.0；活动主题为 theme-sky-blog-3，主题1使用请求级预览验证。实施前相关文件原件及哈希在 `/tmp/sky-contract-repairs-20261028/before/` 与 `before.json`，不覆盖既有验收记录。

官方版本全量核对基线仍为 2026-10-27；本方案采用下列精确版本的官方接口，不把技能基线或版本约束当成运行通过。

## 实施顺序与验收

| 项目 | 官方依据与实际问题 | 最小改动 | 验收条件 | 进度 |
| --- | --- | --- | --- | --- |
| Moments 1.19.0 | UC `createMyMoment` 在服务端确定 owner/审核；主题却对所有登录用户展示管理级创建入口 | 使用 UC 创建接口及官方发布权限，反馈待审核/公开状态 | 无权限入口隐藏；请求和载荷符合 UC；待审核不被当成公开；原草稿/并发/取消回归通过 | 代码完成，站点待验 |
| Shiki 1.5.1 | 额外路径的内联模块注册持久 PJAX 监听器，主题每次重放导致累积 | 精确区分 Shiki 持久引导和逐页配置，避免重复注册；配置变化采用安全的完整导航边界 | 冷启动、首次 PJAX 引入、重复往返只有一个引导；表单逐页脚本仍更新；配置变化不沿用旧设置 | 代码完成，站点待验 |
| Steam 1.0.0 | records 是分页记录；主题只读第一页 | 按官方分页字段读取完整日期范围并合计，保留取消/错误 | 多页、同日多记录、空页/异常响应、离页取消；热力图界面正常 | 代码完成，站点待验 |
| Equipment 1.1.1 | 官方 group 参数筛选与主题纯前端 all 状态冲突 | 以官方路由链接/返回模型同步分组、全部和分页 | 分组深链、全部、下一页、历史返回的 URL/选中态/数据一致 | 代码完成，站点待验 |
| 无契约评论入口 | 装备无 EquipmentPage 评论主体；图库列表借用了不保证存在的 SinglePage/photos | 收回两个入口及相应设置说明，保留旧评论数据 | 页面不再生成伪主体；已有合法 Post/SinglePage/DocTree 主体不受影响 | 代码完成，站点待验 |
| 合法评论外壳 | Halo 官方要求用 haloCommentEnabled 控制外壳 | 全局开关叠加原有主题/内容开关，不绑定单一评论插件 | 开/关模板夹具与真实启用页；合法主体保持 | 代码完成，站点待验 |
| 验收口径 | strict 是拒绝版本漂移；可选插件/无样本检查的表示不统一 | 说明 strict 边界，补所属插件和明确的跳过/未覆盖结果；不抬高历史实测号消红 | 已启用目标照常验证；停用及无样本明确列出；差异提醒不冒充不兼容结论 | 代码与专项完成 |

补查发现归档有同类虚构主体回退，已限定为真实 SinglePage；瞬间列表/详情全局评论开关的漏项也已补齐。

不新增单张照片评论、日历外观覆盖、插件后台/MCP/模型/投票/开奖等主题业务。Text Diagram 保留当前默认宿主范围，自定义 selector 不扩大支持承诺。Friends 退役、AList 排除继续有效。

## 验证方法

1. 对会改变行为的脚本先补生产行为回归，记录实际 RED/GREEN。模板使用真实 Thymeleaf/Spring 夹具及浏览器结果，不用源码字符串检查替代渲染验证。
2. Node 24.21.0 / 项目锁定 pnpm 12.6.0 执行受影响专项、完整构建、lint、format 和差异检查；新增专项接入现有门禁。
3. 本地模板及 Page Cache 按已有授权刷新；浏览器禁缓存，核对预览主题身份及服务资源与磁盘哈希。
4. 在 1440px/390px 验证相关真实路由与 PJAX 往返。写入、权限与多页边界使用接口替身；替身不计作真实账号发布或插件完整业务通过。
5. 更新当前结果和未发布说明，记录最终代码指纹、确切版本、官方源、实际执行命令、截图和未覆盖项。独立复核发现的问题在本批内修正后再验。

## 官方来源

- [Moments UC 创建接口](https://github.com/halo-sigs/plugin-moments/blob/v1.19.0/src/main/java/run/halo/moments/uc/UcMomentEndpoint.java)、[权限定义](https://github.com/halo-sigs/plugin-moments/blob/v1.19.0/src/main/resources/extensions/roleTemplate.yaml)
- [Shiki 引导脚本](https://github.com/halo-sigs/plugin-shiki/blob/v1.5.1/src/main/java/run/halo/shiki/ShikiHeadProcessor.java)
- [Steam records 查询](https://github.com/Tim0x0/halo-plugin-steam/blob/v1.0.0/src/main/java/com/timxs/steam/service/PlaytimeTrackingServiceImpl.java)
- [Equipment Router](https://github.com/chengzhongxue/plugin-equipment/blob/1.1.1/src/main/java/com/kunkunyu/equipment/EquipmentRouter.java)
- [Photos 官方评论主体](https://github.com/halo-sigs/plugin-photos/blob/v2.1.2/src/main/java/run/halo/photos/comment/PhotoCommentSubject.java)
- [Halo 主题插件集成](https://docs.halo.run/developer-guide/theme/plugin-integration)

## 验收记录

最终结果见[本批独立证据](./evidence/2026-10-28/plugin-contract-repairs.json)。上一轮的构建、HTTP、首屏或替身结果不改记为本批通过。

Shiki 无官方销毁接口，跨出额外路径、引导配置变化或首屏加载未确认时采用整页导航；这会重新加载文档并中断跨页音乐续播。相同配置内的 PJAX 往返仍保留。浏览器首次夹具用了旧模块（没有新生命周期守卫），记录保留为缓存诊断；禁缓存且资源验证参数变化后重新采集的 `browser-shiki-current.json` 才是当前代码结果。

本地动态路由与 API 持续超时，静态资产可正常读取。没有刷新无响应服务上的业务配置或重启服务。真实 Halo 运行验收待环境恢复，不能据浏览器夹具宣布所有插件已兼容。

### 本批最终检查

- 最终源码指纹：`4e0406e9a9bec3b65c8432d412296e887bccb9572c2416b8263a4cec6068b096`。
- Node 24.21.0 / pnpm 12.6.0：完整 build、lint、format、diff检查通过；315/315项Node回归，0跳过；27项插件契约门禁。
- 评论：228组真实Thymeleaf渲染、652项断言；装备：2风格×4导航×5状态、400项断言。Java依赖由独立模板验证命令显式提供，不作为默认构建的新硬依赖。
- 1440/390浏览器夹具：Shiki共6次PJAX往返始终1监听/1宿主/0嵌套，并真实整页离开；瞬间待审核/公开反馈、移动弹窗、装备分组/全部/历史返回、Steam两页合计60分钟通过。没有真实发文或写入插件业务数据。
- 本地48/48份CSS/JS服务字节与磁盘一致；ZIP的237份文件逐字节一致，SHA-256：`01dee42595d2c0cbfccfa5806bdd9b7aae93cb38b4126cdb16c409d39d44789f`。
- 两组独立代码复核的发现均修正并复验；四张稳定代表截图经独立查看，无可操作的错位/裁切问题。
- 真实站点只读验收退出1：登录GET超时，44项因插件清单无法取得而未覆盖，0项通过。这是运行验收待完成，不改记为兼容或已确认主题缺陷。此前站点运行证据不倒填为本批。
- HEAD和暂存区与实施前一致，未提交或发布。TaskSpace195已关闭；本机Ego Lite提示可选更新，本批未升级浏览器工具。
