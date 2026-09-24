# 2026-09-24 依赖适配记录（未发布）

本记录对应待发布的主题 `2.2.40` 代码，不是已发布版本，也不是生产站点升级。2026-09-24 的后续修正已将 `spec.requires` 从 `>=2.23.0` 提高到 `>=2.26.0`；旧版 Halo 不再满足安装要求。目标是更新执行日的稳定版前端与构建依赖，保留 Node 24 LTS、Halo 插件契约和 pnpm 供应链检查。版本依据是当天 npm registry 的 `pnpm outdated`、官方发布页及锁文件；`@types/node` 的全局最新版本属于 Node 26，见兼容边界。

最低版本的依据是 [Halo 2.26.0 正式版](https://github.com/halo-dev/halo/releases/tag/v2.26.0)新增的主题 `layout.html` 页面布局契约、本主题已有的 `templates/layout.html` 集成，以及当前多项插件的 `>=2.26.0` 要求。官方[主题配置说明](https://docs.halo.run/developer-guide/theme/config)确认 Core 使用 `spec.requires` 判断最低运行版本。此约束表示计划支持 2.26 系列及以后；本地在 Halo Pro 2.26.1 上完成了主题元数据 Reload 与 READY 状态检查。2026-09-24 05:36 UTC 核验时本站激活主题 2，最低版本调整后的主题 1 页面尚未重新验收，2.26.0 也没有单独做全量页面测试。前端依赖升级本身不构成提高 Halo 门槛的理由。

## 版本与改动

| 依赖 | 原版本 | 本次目标 | 适配点 |
| --- | --- | --- | --- |
| Node.js | CI 24.18.0 | CI 24.21.0 | 项目支持范围仍为 `>=24.18.0 <25`。 |
| pnpm | 10.34.5 | 12.6.0 | 将 `.npmrc` 和 `package.json#pnpm` 迁至 `pnpm-workspace.yaml`；仅批准 `esbuild@0.28.2` 的安装脚本。 |
| TypeScript | 6.0.3 | `@typescript/native` 7.0.2 + `@typescript/typescript6` 6.0.2 | `tsc` 使用 TS 7；`typescript-eslint` 的 peer 使用 TS 6 别名。该别名包版本为 6.0.2，`tsc6 --version` 当前报告 6.0.3，两者分别记录。 |
| Alpine.js / Swup | 3.15.12 / 4.9.2 | 3.17.4 / 4.10.0 | 检查主题启动、搜索组件、PJAX、Head 替换及脚本单实例。 |
| daisyUI | 5.6.18 | 5.7.44 | 重建 CSS，抽查桌面、390px、深浅主题和搜索浮层。 |
| Vite / esbuild | 8.1.5 / 0.28.1 | 8.3.0 / 0.28.2 | 重建 19 入口、6 个版本化分包和主题 ZIP。 |
| ESLint / typescript-eslint | 10.7.0 / 8.64.0 | 10.11.0 / 8.70.1 | lint、TS 7 主检查及 TS 6 peer 安装通过。 |
| Prettier / globals | 3.9.5 / 17.7.0 | 3.9.9 / 17.12.0 | 格式检查通过。 |
| `@iconify/json` | 2.2.500 | 2.2.533 | 图标数据随 CSS 重建。 |
| `@types/node` | 24.13.3 | 24.13.6 | Node 24 分支最新；npm 全局最新 26.6.2 与本项目 Node 主版本不符。 |
| `flatted@3` / `yaml@2` 覆盖 | 3.4.2 / 2.9.0 | 3.4.4 / 2.9.1 | 覆盖规则迁至 workspace；移除旧 CVE 忽略项后审计为 0。 |

其余直接依赖保持原版本；当天 `pnpm outdated --format json` 仅列出跨 Node 主版本的 `@types/node`。本次未改动 Halo 或插件二进制、插件版本及主题插件 API 契约；后续单独提高了主题对 Halo Core 的最低版本要求。主题版本预留为 `2.2.40`，让入口 `?v=` 与分包名更新，避免长期缓存继续使用 `2.2.39` 资源。

产物体积是本次升级的可见代价：`main.css` 从 422,110 B 增至 450,858 B（gzip 约增加 2.6 KB），`main.js` 从 114,876 B 增至 124,406 B（gzip 约增加 3.1 KB）。这属于依赖更新后的构建差异，未观察到页面功能回归；后续可单独优化 CSS 范围，不能把这次依赖适配说成体积零变化。

[pnpm 迁移说明](https://pnpm.io/migration)要求把 `package.json#pnpm` 和非认证类 `.npmrc` 设置移至 workspace；[构建权限说明](https://pnpm.io/settings/build#allowbuilds)要求明确批准依赖脚本。[TypeScript 7 官方双版本说明](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)是保留 TS 6 peer 的依据。运行依赖参考 [Alpine.js 3.17.4](https://github.com/alpinejs/alpine/releases/tag/v3.17.4)、[Swup 4.10.0](https://github.com/swup/swup/releases/tag/4.10.0)、[daisyUI 更新记录](https://daisyui.com/docs/changelog/)及 [Vite 8.3.0](https://github.com/vitejs/vite/releases/tag/v8.3.0)。

新特性评估：Alpine 3.17.4 修复 MutationObserver 出错后的恢复，主题当前 PJAX 流程仍使用官方 `deferMutations` / `destroyTree` / `flushAndStopDeferringMutations`；不需要新 API。Swup 4.10.0 重构失败访问处理并调整原生视图过渡时的历史动画，主题现有 `content:replace` 生命周期在成功导航中通过；**失败访问/404 回退没有在本次浏览器轮次中注入复现**，保留为后续定向回归。Vite 8.3.0 的更新不要求修改本项目的入口生成 API，实际构建和资源校验通过。暂未为这些可选新特性增加主题功能。

## CI/CD 和运行验证

CI 改为 Node 24.21.0、pnpm 12.6.0 和 `actions/setup-node@v7.0.0`，仍执行冻结安装、lint、格式、审计、完整打包及产物一致性检查。原 CD 引用的上游固定提交使用 `pnpm/action-setup@v5`；现改为仓库内的打包、GitHub Release 上传、Halo App Store 发布三个 job，并固定 Action 提交。App Store 等待 GitHub Release 资产上传完成。CD 仅在将来 `release.published` 事件运行；本次不创建 Release、标签或上传发布资产。`actionlint 1.7.12` 校验两个工作流通过；GitHub `main` 的 [Quality Gate 35956215629](https://github.com/sky121666/halo-theme-sky-blog-1/actions/runs/35956215629) 已真实启动，并在冻结安装时因下述 24 小时发布时龄门禁失败，后续 lint、审计和构建步骤被跳过；App Store 发布未执行。

本地 Node **24.21.0** / pnpm **12.6.0** 的 `lint`、`format:check`、`build`（类型检查、27 项静态插件契约、Links/升级回归、SEO、热力图、19 入口及 ZIP）和 `pnpm audit` 全部通过，审计为 **0 个已知漏洞**。全新临时目录的冻结安装通过。本地 Halo **Pro 2.26.1** 实装 **45 个插件**（44 STARTED、1 DISABLED）。主题 Reload 前后配置 SHA256 相同；Page Cache 在 **2026-09-24T03:22:38Z** 刷新。之后先验 13 个代表性原始 URL，再按此前清单复测 **114 个原始 URL：113 个 200，预期 `/terms` 404**；状态无回归、0 旧缓存、0 个 `2.2.39` 资产引用。112 个主题路由引用 `2.2.40`，`/dishes` 与 `/schedule-calendar` 是独立插件页。匿名 `main.js` 响应 SHA256 为 `0be4b31811460f2e9d69fafb0174c97e82d02c3613e1e3c4d3e57962448e8cae`，与本地字节一致。插件 HTTP/API 深测 **33/33**；真实浏览器 10 个代表路由的 Alpine 初始化、无旧资产/横向溢出和无脚本异常通过，PJAX 链路与 390px 三页抽查通过。这不等于 45 个插件的全部后台写入流程已验收，也不等于 114 路由均经浏览器交互验收。上述 114 路由与浏览器记录对应**提高 Halo 最低版本前**的源码内容指纹（不含报告文档）`15c5823cc2b237848944edcbd75b4f568837ab6c4ec0182327063387d2296486`；后续元数据修正需单独记录验证。

本次锁文件中 `@iconify/json 2.2.533`、daisyUI 5.7.44、Prettier 3.9.9、Rolldown 1.2.10 等 **19 项**在测试时尚未满 pnpm 12 默认的 24 小时发布观察期。本地仅对安装、冻结安装和构建命令临时设置 `PNPM_CONFIG_MINIMUM_RELEASE_AGE=0`；项目和 CI **没有**关闭该默认策略。无例外的安装当前仍因 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 失败，故不能宣称 CI 已通过。按最晚的 daisyUI 发布时间，应在 **2026-09-24 15:28 UTC（北京时间 23:28）后**重新运行无例外冻结安装与 CI；若仍失败，核查发布元数据和锁文件，不静默降低目标。

本次后端日志无新 ERROR，`/equipments` 访问仍出现此前已定位的装备插件分页警告 `Page size must not be greater than 1000`；主题无法修正插件内部查询。27 个版本契约中 24 项与安装/历史测试版本对应，AI Assistant 3.1.0、Restricted Reading 1.9.1、Schedule Calendar 3.5.0 仍高于契约基线；本轮仅做读路径烟测，不把既有差距描述为已补齐。

## Halo 2.26 最低版本后续校验

后续将 `theme.yaml#spec.requires` 和 README 标识改为 `>=2.26.0`，没有修改前端源码、插件二进制或主题版本。新代码内容指纹为 `d3ab8cd39d2304a2f158185da49df3fca640cf29b83a9122769ab053b5d54634`（基底提交 `2d683a5`）；之前的 114 路由及浏览器结果不能倒填到该指纹。Node 24.21.0 / pnpm 12.6.0 下重新构建、27 项静态插件契约、19 个入口、ZIP 与 SEO 归档校验通过；ZIP 中的 `theme.yaml` 确认为 `version: 2.2.40`、`requires: ">=2.26.0"`。

本地 Halo Core `/v3/api-docs` 为 `2.26.1`。主题 Reload 返回 200，Core 读回主题 1 的 `spec.requires` 为 `>=2.26.0`、状态 `READY`、布局契约 `SUPPORTED`；主题配置 `data` 的 SHA256 在 Reload 前后均为 `86b8576f70c60378c89795e5bfe601bc7cbcdf2ba29def662e34b1b17add5ab8`。主题 1 的 `main.js` 匿名资源字节仍与本地一致。清理 Page Cache 后的 33 项读路径烟测有 18 项未匹配，因为 2026-09-24 05:36 UTC 核验时系统配置的**激活主题是 `theme-sky-blog-2`**，实际页面使用主题 2 的资源；这些结果不能判定主题 1 回归失败或通过。本轮没有切换激活主题。主题 1 在新最低版本下的完整页面复测仍待其被激活时进行；此前 Halo 2.26.1 页面验收仍对应修改门槛前的代码。CI 另受上文 pnpm 发布时龄门禁阻挡，尚无本轮代码的绿色 GitHub 构建。
