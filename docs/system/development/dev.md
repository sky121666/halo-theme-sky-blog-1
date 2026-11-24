# 开发说明

这份文档给二次开发和本地排查使用。普通配置请先看功能文档。

## 常用命令

| 命令                           | 作用                                          |
| ------------------------------ | --------------------------------------------- |
| `pnpm dev`                     | 监听构建主题资源                              |
| `pnpm lint`                    | 检查 `src` 里的 JS/TS 代码                    |
| `pnpm build-only`              | 运行 TypeScript 检查并构建前端资源            |
| `pnpm build`                   | 构建前端资源并打包主题                        |
| `pnpm verify:plugins`          | 检查本地 Halo 核心插件页是否可访问            |
| `pnpm verify:plugins:deep`     | 做更完整的插件页面和接口 smoke 检查           |
| `pnpm verify:plugin-versions`  | 通过 Halo 后端 API 检查插件安装版本和主题契约 |
| `pnpm verify:plugin-contracts` | 校验契约清单、文档矩阵和关键模板断言          |

项目声明 Node.js `>=24.18.0 <25`，固定使用 pnpm `12.6.0`；CI 使用 Node.js `24.21.0`。依赖安装策略位于 `pnpm-workspace.yaml`，默认要求新发布的依赖经过 pnpm 12 的 24 小时观察期。TypeScript 7 用于 `tsc` 检查，`typescript-eslint` 的兼容别名使用 TypeScript 6。低于 Node 声明范围或进入 Node 25 只能视为预检查；正式构建和发版应使用 CI 组合。

普通提交推送到 `main` 不会自动运行 GitHub Quality Gate；推送匹配 `v*` 的版本标签才会自动运行，也可在 Actions 手动触发。标签必须与 `package.json` 版本一致。发布顺序是先推送版本标签、等该标签的 Quality Gate 通过，再手动发布对应的 GitHub Release；Release 的 `published` 事件才会触发 CD 打包并上传 GitHub/Halo App Store 资产。GitHub 不会自动阻止你在 Quality Gate 失败时点击发布，发版前需要核对该标签的检查结果。

默认 smoke 目标是 `http://localhost:8090`，页面与版本脚本都会自动读取 `.env.local` / `.env` 中的 `HALO_BASE_URL`。如果本地端口不同，也可以单次覆盖：

```bash
HALO_BASE_URL=http://localhost:8091 pnpm verify:plugins
```

`SMOKE_BASE_URL` 仅作为旧命令兼容别名。Dishes 与 Schedule Calendar 的自动门禁固定检查默认 `/dishes`、`/schedule-calendar`；若在插件后台改路由，菜单链接必须标记 `data-no-swup`，并对自定义路由另做浏览器回归。

## 主题设置重组

旧站点更新前导出主题的 ConfigMap。用下面的命令生成迁移后的文件，再更新同名 ConfigMap 并重载主题配置。原始导出可用于回滚。

脚本也支持已使用五个分组的配置。侧边栏小工具和首页模块会按原顺序转换为 ID 列表，单页例外的布尔显示值会转成 `on` 和 `off`。

```bash
node scripts/migrate-theme-settings.mjs theme-config.before.json > theme-config.after.json
```

## 插件版本检测

主题里的“适配版本”不是插件最新版，也不是当前站点随手安装的版本，而是主题模板已经按它验证过的契约版本。插件升级后，先跑版本检测，再决定是否需要页面回归。

本地创建 `.env.local`，不要提交真实 token：

```bash
cp .env.example .env.local
```

填写：

```bash
HALO_BASE_URL=http://localhost:8090
HALO_PAT=pat_xxx
```

然后执行：

```bash
pnpm verify:plugin-versions
```

输出分为两段：第一段逐项比较主题显式契约，第二段列出当前 Halo 已安装但处于主题矩阵外的插件。矩阵外清单不是失败清单；它用于发现新增的前台插件适配缺口，并区分无需主题契约的后台、存储、认证和运行平台插件。不能只看第一段成功就宣称所有已安装插件兼容。

输出含义：

| 结果       | 含义                              | 处理方式                                      |
| ---------- | --------------------------------- | --------------------------------------------- |
| `ok`       | 安装版本等于主题契约版本          | 不需要改文档                                  |
| `tested`   | 安装版本等于已标记测试版本        | 不需要改契约版本                              |
| `newer`    | 安装版本高于契约或已测版本        | 跑页面 smoke 和人工验收，通过后再标记已测版本 |
| `older`    | 安装版本低于主题契约版本          | 升级插件，或确认主题是否还能兼容旧版本        |
| `inactive` | 插件已安装但不是运行状态          | 先看插件后台错误、依赖插件和启动日志          |
| `missing`  | 当前站点没装该插件或 API 名称变化 | 确认插件是否启用，或更新脚本 aliases          |

严格模式会把缺失、未启用和未经回归的新版本都当成失败；低于契约版本在普通模式下也会失败：

```bash
pnpm verify:plugin-versions -- --strict
```

需要给 AI 或其它脚本读取时：

```bash
pnpm verify:plugin-versions -- --json
```

JSON 的 `inventory.installed`、`inventory.contracted` 和 `inventory.outsideThemeContract` 可用于持续审计全量插件覆盖。

## AI 自动测试流程

给 AI 代理做本地回归时，推荐顺序固定下来：

| 顺序 | 命令或动作                     | 目的                               |
| ---- | ------------------------------ | ---------------------------------- |
| 1    | `pnpm verify:plugin-contracts` | 校验仓库契约清单、文档和模板断言   |
| 2    | `pnpm verify:plugin-versions`  | 确认站点安装版本是否超过主题契约   |
| 3    | `pnpm verify:plugins`          | 检查核心插件页面是否能打开         |
| 4    | `pnpm verify:plugins:deep`     | 检查首页组件、评论、搜索、灯箱绑定 |
| 5    | 浏览器打开重点页面             | 看真实布局、交互、Console          |

AI 判断规则：

| 情况                  | 建议                                                         |
| --------------------- | ------------------------------------------------------------ |
| 只有 `newer`          | 不直接改契约版本，先跑 smoke；页面通过后记录“已兼容测试版本” |
| 有 `inactive`         | 先修插件启动状态；页面 404 通常不是主题模板问题              |
| 有 `older`            | 优先升级插件；不要为了旧插件降低主题契约                     |
| 页面 smoke 失败       | 先看模板变量、插件路由、Finder/API 是否变更                  |
| 只有文档改动          | 不需要构建前台资源，但仍要检查 Markdown 格式和链接           |
| 涉及 JS/CSS/Swup/灯箱 | 必须 `pnpm lint`、`pnpm build-only`，再浏览器回归            |

## 目录约定

| 目录                 | 说明                              |
| -------------------- | --------------------------------- |
| `templates/`         | Halo Thymeleaf 模板               |
| `templates/modules/` | 页面和组件片段                    |
| `src/common/`        | 全局样式、Swup、Alpine 和公共脚本 |
| `src/pages/`         | 各页面独立 JS/CSS 入口            |
| `templates/assets/`  | 构建产物和静态资源                |
| `docs/`              | 本地说明文档                      |
| `scripts/`           | 本地验证脚本                      |

`templates/assets/` 里的 JS/CSS 多数由构建生成，除非确认是静态资源，不要手工改构建产物。

## 页面模块与导航

布局在 `#swup` 上声明 `data-page`，页面附属控件放进 `#swup-page-extras`。Vite 将 `src/pages/{page}/{page}.js` 或 `.ts` 构建为版本化入口，导航按页面加载入口。常驻导航和页脚位于这两个容器之外。

页面模块导出 `mount({ content, extras, signal, initial })`，返回的清理函数会随旧页面一起释放。通过可选的 `registerAlpine(alpine)` 注册组件。首屏和站内切页使用同一个入口，组件注册先于新 DOM 初始化。插件专属资源由页面适配模块按需加载。

Halo 的公共布局仍暴露 `html(head, content)`。内容片段带 `data-theme-swup` 时，主题使用单页入口接入 Swup，包括 404 的恢复路径。使用各自文档启动脚本的插件继续按其完整文档启动，调用公共布局时仍可复用站点外壳。

使用 Swup 的 `page:view` 等官方生命周期。认证入口和独立应用按整页导航处理。站长可通过后台的开发者模式打开页面和插件初始化日志。

## 资源缓存

本地 live mount 开发时，`pnpm dev` 会持续重建 `templates/assets/**`，不需要反复打包或安装主题。模板缓存、`theme.yaml` 或版本元数据变化后，在 Halo Console 执行一次主题“重载”；也可以使用 Console 的同一 Reload API。

如果实例启用了 `page-cache`，主题重载不会清除它已经生成的匿名 HTML。验收模板变化前，还要在 Console 仪表盘执行“刷新页面缓存”，或使用插件提供的 Console API：

```bash
curl -X DELETE \
  -H "Authorization: Bearer $HALO_PAT" \
  "$HALO_BASE_URL/apis/console.api.cache.halo.run/v1alpha1/caches/page"
```

最后用普通浏览器新导航确认 DOM；仅看到 Reload API 返回 200，不代表浏览器一定已经离开旧的页面缓存。纯静态资源变化还要核对实际响应字节，必要时禁用浏览器缓存或更新主题版本以刷新 `?v=` 参数。

诊断 Page Cache 1.6.0 时，默认 `curl` 的 `Accept: */*` 不会进入 HTML 缓存分支。对**同一个原始 URL**发送 `Accept: text/html`，记录 `X-Halo-Cache-At`、`Cache-Control` 和 HTML；刷新缓存后再请求同一 URL，确认时间戳与内容变化。给 URL 加随机 `qa` 参数只会生成另一条缓存键，不能证明原 URL 的旧响应已失效。清理 API 是站点缓存操作，执行前确认本地测试授权与凭据权限；正式发布还要核对代理/CDN 层缓存。

刷新后记录 UTC 时间，用下面的只读烟测核对原 URL；每次运行须把示例时刻替换成**本次**刷新时间。脚本对 HTML 请求使用 `Accept: text/html`，如果响应带有早于刷新时刻的 `X-Halo-Cache-At` 就失败，并在 JSON 中保留每页缓存时间。未带该响应头的页面只能判定为“未观察到页面缓存”，不能据此证明其他缓存层已刷新。浏览器还需禁用本机缓存，分别检查匿名（命中 Page Cache）和已登录（可能绕过 Page Cache）界面；静态 JS/CSS 用响应字节与本地构建产物比对。

```bash
node scripts/verify-plugin-pages.mjs \
  --cache-fresh-since=2026-09-23T09:17:05Z \
  --report=docs/system/adaptation/evidence/2026-09-23/cache-guard-weather-after-refresh.json
```

定位 SEO Tools、追番、装备与 Passkey 的已知问题可运行只读回归；`--cache-fresh-since` 必须填**本次** Page Cache 刷新前记录的 UTC 时刻。该脚本遇到已知缺陷会返回非零退出码，JSON 报告区分通过、失败和未测，不应把一次正常追番请求当成上游超时分支通过。

```bash
node scripts/verify-plugin-runtime-issues.mjs \
  --cache-fresh-since=2026-09-23T13:50:51.716Z \
  --report=docs/system/adaptation/evidence/2026-09-23/runtime-issues-automated.json
```

Passkey 普通用户权限另有本地一次性账号探针。它使用当前登录页的 Altcha 验证码流程，创建专用账号和角色绑定后自动清理；仅在已获授权的本地 Halo 上使用 `--allow-local-write`，不得指向正式站点或使用真实账号。若进程中断，先运行同脚本的 `--cleanup` 并确认账号、绑定均已删除；失败的 403 是诊断结果，不表示脚本通过。

```bash
node scripts/verify-passkey-disposable.mjs --allow-local-write \
  --report=docs/system/adaptation/evidence/2026-09-23/passkey-disposable-automated.json
# 仅测试中断且恢复状态文件仍存在时运行：
node scripts/verify-passkey-disposable.mjs --allow-local-write --cleanup
```

当前构建规则：

| 资源    | 规则                                                               |
| ------- | ------------------------------------------------------------------ |
| 入口 JS | `templates/assets/js/{name}.js`，模板通过 `?v=主题版本` 控制缓存   |
| 分包 JS | `templates/assets/js/chunks/{name}-{主题版本}.js`                  |
| CSS     | `templates/assets/css/{name}.css`，模板通过 `?v=主题版本` 控制缓存 |

主题版本来自 `package.json`。改完前端资源后要重新构建，避免模板引用和构建产物不一致。

## 灯箱

Halo 的 LightGallery 插件声明需要放大的页面和图片区域。主题在这些区域按需挂载 GLightbox。图库新增图片时刷新当前实例，页面离开时销毁实例。页面和图片区域由插件的路径与 selector 设置控制。

## 本地验收

改代码后按影响范围选择：

| 改动范围         | 建议验证                                    |
| ---------------- | ------------------------------------------- |
| 文档             | Markdown 格式检查、链接和内容人工检查       |
| CSS/JS           | `pnpm lint`、`pnpm build-only`              |
| 插件页           | `pnpm verify:plugins`，再浏览器打开对应页面 |
| Swup、灯箱、评论 | 浏览器从首页进入目标页，再返回和重复进入    |
| 发布、上传、登录 | 只在明确需要时手工验证，避免误改本地数据    |

脚本通过不等于真实页面通过。涉及页面交互时，必须再用浏览器看一次。

`pnpm verify:plugins` 和 `pnpm verify:plugins:deep` 检查 HTTP 状态、服务端标记和公开 API。浏览器验收从真实链接出发，覆盖返回、前进、重复进入、快速连续导航，以及灯箱、评论、筛选和无限滚动。
