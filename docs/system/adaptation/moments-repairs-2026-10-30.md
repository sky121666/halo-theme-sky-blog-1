# 2026-10-30 瞬间修复与修改路由复审

> 后续[官方契约收口](./contract-closure-2026-10-30.md)已将点赞的 `aria-pressed` 修正为单向动作的 `aria-disabled`，并补权限失败重试。下文保留本批原指纹与验证事实，不代表后续代码再次全部运行这些检查。

本批完成上一轮确认的瞬间问题，只改主题。点赞、评论继续显示原图标与计数，没有改成文字按钮；`aria-label` 和 `aria-pressed`/`aria-expanded` 仅向辅助技术描述用途和状态。

## 修改与官方依据

| 修改 | 位置 | 依据与行为 |
| --- | --- | --- |
| 附件总量上限 | `src/pages/moments/moment-publish.js` | 按 [PluginMoments 1.19.0 官方编辑器](https://github.com/halo-sigs/plugin-moments/blob/v1.19.0/console/src/uc/MomentEdit.vue)的 `uploadMediumNum = 9`；图片/视频/音频合计，单次和累计超限都在上传前明确拒绝本批选择，不静默截断 |
| 上传取消与旧响应隔离 | 同上 | 单次上传独立 AbortController；关闭时立即恢复按钮；旧 finally 不更新新会话；单文件 5 分钟超时提示重试。客户端取消不删除服务端附件 |
| 上传地址契约 | 同上 | [Halo 2.27.1 AttachmentHandler](https://github.com/halo-dev/halo/blob/v2.27.1/application/src/main/java/run/halo/app/core/endpoint/AttachmentHandler.java)在响应前解析地址，直接读取 `status.permalink`；缺失时提示失败，移除不存在的旧轮询路径 |
| 已有超限图片不丢入口 | `templates/modules/moments/content.html`、`detail.html` | 官方媒体模型为列表；新发布限制 9 个，已有数据完整输出图片与原图链接，去掉没有完整数据入口的“+N”遮罩；不改写、删除内容 |
| 图标交互状态 | 上述模板与 `src/pages/moments/moments.js` | 保留图标/数字和原接口，只补读屏用途、点赞确认状态、评论区域关联与展开状态；遵循 [W3C 名称/角色/状态](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) |

## 验证环境

- `localhost:8090`，Halo Pro **2.27.1**、PluginMoments **1.19.0**、PluginLightGallery **1.2.1**。
- 主题 **2.2.41**，最低 Halo **>=2.27.0**。活动主题仍为主题 3，通过 `preview-theme=theme-sky-blog-1` 验主题 1。
- Node **24.21.0** / pnpm **12.6.0**。
- 最终源码指纹：`6a6b12be2eea4b729051e9154b30ccc9577dad783acb07e1403129cc9af867be`。
- 按既有授权刷新本地模板与 Page Cache，浏览器禁缓存；main/moments CSS、JS 及 modal-focus 共 5 份资源与磁盘 SHA-256 一致。
- 首次构建误用 Thymeleaf 3.1.5 的离线测试依赖，导致原有导航 Logo 用例失败；改回此前验证过的 3.1.3 测试依赖后通过。本地 Halo 实际也使用 Thymeleaf 3.1.3。未修改项目依赖来绕过失败。

## 修改路由复审

| 路由/状态 | 实际验证 | 结果 |
| --- | --- | --- |
| `/moments` | 1440/390 宽度，图标、计数、辅助名称、无横溢与未捕获异常 | 通过 |
| `/moments?tag=哈哈` | 相同双视口，筛选列表与交互名称 | 通过 |
| `/moments/moment-f6ircurs` | 双视口，详情、点赞图标和评论区域 | 通过 |
| 列表评论开关 | Enter 展开、Space 收起，区域可见性与 `aria-expanded` 同步 | 双视口通过，未提交评论 |
| 列表 → 详情 → 返回 | 真实 Swup 页面切换，脚本状态重挂载及评论关闭态 | 双视口通过 |
| 发布弹窗 | 10 个拒绝；8+2 拒绝；8+1 可提交 9 个；取消重开、新上传中旧请求返回、缺地址失败 | 双视口通过，使用生产模板片段/构建脚本和浏览器内响应替身 |
| 点赞 | 保留原心形图标，成功后实心状态、计数与辅助名称同步 | 双视口通过；请求及点赞存储均隔离，不真实写入 |
| 历史十图内容 | 生产列表/详情片段经 Thymeleaf 渲染均保留 10 张；浏览器点击第 10 张，官方灯箱显示 `10 / 10` | 隔离内容样本通过，无站点内容创建 |

上述是实际界面和隔离交互验收，不把普通模板断言冒充真实上传、发布或权限验收。未在本轮登录真实账号或提交业务数据。

## 自动检查与反例

- 先增加反例：单次/累计超限、取消不释放、缺地址仍轮询、辅助状态缺失、十图模板丢图；修改前失败，修改后通过。
- `pnpm run build`：**382 项 Node 测试，0 跳过**，含瞬间/文章动作 **54/54**；类型、构建产物与打包检查通过。
- `pnpm run lint`、`pnpm run format:check`、`git diff --check`：通过。
- `THYMELEAF_TEST_CLASSPATH=… node scripts/verify-template-data.mjs`：**66/66**，包含 18 项瞬间空媒体、单图、9/10 图及混合媒体检查。
- 全局既有 122 URL 清单重跑：120 个 200，2 个预期 404（已移除入口的 `/terms` 和故意缺页探针），没有 500。
- 日志窗口内为 4 条范围外 AList 错误、3 条插件分页 WARN、1 条请求中断 WARN；无其他未分类 WARN/ERROR。不将这些自动定性为本次瞬间回归。

本批进行了作者自检，未进行另一位审查者的独立代码审查。已复核本批差异、同文件原有逻辑及旧请求/新会话交叉状态；无新增确认的主题问题。

本轮没有重查全部插件当日发行；官方源码依据固定于上列实装版本。未修改插件、数据库、认证配置或站点业务设置，未 Git 暂存、提交、推送或发布。

详细本地证据：`/tmp/sky-moments-fix-20261030/`，包含 `environment.json`、RED/GREEN 日志、`routes-browser.json`、`interactions-browser.json`、`publish-browser.json`、`media-render.log`、桌面/手机截图与 `http.json`。临时证据不是项目运行所需文件。
