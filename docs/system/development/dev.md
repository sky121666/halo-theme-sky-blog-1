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

项目声明 Node.js `>=24.18.0 <25`，并固定使用 pnpm `10.34.5`。版本低于该范围或进入 Node 25 均只能视为预检查，正式构建、CI 和发版必须使用这组基线。

默认 smoke 目标是 `http://localhost:8090`，页面与版本脚本都会自动读取 `.env.local` / `.env` 中的 `HALO_BASE_URL`。如果本地端口不同，也可以单次覆盖：

```bash
HALO_BASE_URL=http://localhost:8091 pnpm verify:plugins
```

`SMOKE_BASE_URL` 仅作为旧命令兼容别名。Dishes 与 Schedule Calendar 的自动门禁固定检查默认 `/dishes`、`/schedule-calendar`；若在插件后台改路由，菜单链接必须标记 `data-no-swup`，并对自定义路由另做浏览器回归。

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
| 涉及 JS/CSS/PJAX/灯箱 | 必须 `pnpm lint`、`pnpm build-only`，再浏览器回归            |

## 目录约定

| 目录                 | 说明                              |
| -------------------- | --------------------------------- |
| `templates/`         | Halo Thymeleaf 模板               |
| `templates/modules/` | 页面和组件片段                    |
| `src/common/`        | 全局样式、PJAX、Alpine 和公共脚本 |
| `src/pages/`         | 各页面独立 JS/CSS 入口            |
| `templates/assets/`  | 构建产物和静态资源                |
| `docs/`              | 本地说明文档                      |
| `scripts/`           | 本地验证脚本                      |

`templates/assets/` 里的 JS/CSS 多数由构建生成，除非确认是静态资源，不要手工改构建产物。

## 页面脚本约定

每个有独立交互的页面，优先放到 `src/pages/{page}/{page}.js`，再由对应模板在 `#swup-scripts` 中加载。

页面脚本要满足：

| 要求            | 说明                                   |
| --------------- | -------------------------------------- |
| 首屏可执行      | 直接打开页面时能初始化                 |
| PJAX 可重复进入 | 从其他页面切入时能重新初始化           |
| 可清理          | 离开页面前清理监听器、定时器、observer |
| 不重复绑定      | 多次进入页面不产生重复事件             |
| 失败可降级      | 插件接口失败时显示空态或错误态         |

通用辅助方法在 `src/common/js/page-runtime.js`：

| 方法                             | 用途                             |
| -------------------------------- | -------------------------------- |
| `runPageInit()`                  | 首屏和 DOM 已加载场景统一初始化  |
| `registerPageLifecycle()`        | 首屏/PJAX 统一挂载并在离页时清理 |
| `registerAlpinePageComponents()` | 注册页面级 Alpine 组件           |
| `notifySwupPageReady()`          | 通知 PJAX 页面脚本已就绪         |

## PJAX 合约

主题使用 Swup 管理无刷新切换，核心容器为：

| 容器                | 作用               |
| ------------------- | ------------------ |
| `#swup`             | 页面主体内容       |
| `#swup-scripts`     | 当前页面脚本       |
| `#swup-page-extras` | 页面附加资源和片段 |

需要随 PJAX 重新执行的脚本要加 `data-swup-reload-script`，插件注入脚本可按 `script[data-pjax]` 或 `script.pjax` 兼容。

`window.SkyPjax` 提供三个常用入口：

| 方法                    | 用途                   |
| ----------------------- | ---------------------- |
| `SkyPjax.once(key, fn)` | 全站只执行一次         |
| `SkyPjax.onPage(fn)`    | 首屏和每次 PJAX 后执行 |
| `SkyPjax.onCleanup(fn)` | 离开当前页前清理       |

### 开发者模式诊断

在主题设置的“通用 -> 开发者与调试”开启开发者模式后，控制台会以 `[SkyDebug:pjax]`、`[SkyDebug:page]` 等前缀输出：

- `visit:start`、`content:replace:before`、`page:view`、`visit:end` / `visit:abort`
- 页面 mount / unmount、Alpine destroy / resume 与恢复原因
- PJAX 脚本 scan / skip / load / error、模块超时
- 缺少 PJAX 容器时的整页导航降级，以及 `fetch:error` / `fetch:timeout`

日志只用于本地诊断，不包含 URL 查询参数、请求体、表单内容、原始 DOM、位置或凭据。验证结束后关闭开发者模式并硬刷新，主题前缀日志应为零；第三方插件、Swup 或浏览器原生错误仍会正常显示。

## 资源缓存

本地 live mount 开发时，`pnpm dev` 会持续重建 `templates/assets/**`，不需要反复打包或安装主题。模板缓存、`theme.yaml` 或版本元数据变化后，在 Halo Console 执行一次主题“重载”；也可以使用 Console 的同一 Reload API。

如果实例启用了 `page-cache`，主题重载不会清除它已经生成的匿名 HTML。验收模板变化前，还要在 Console 仪表盘执行“刷新页面缓存”，或使用插件提供的 Console API：

```bash
curl -X DELETE \
  -H "Authorization: Bearer $HALO_PAT" \
  "$HALO_BASE_URL/apis/console.api.cache.halo.run/v1alpha1/caches/page"
```

最后用普通浏览器新导航确认 DOM；仅看到 Reload API 返回 200，不代表浏览器一定已经离开旧的页面缓存。纯静态资源变化还要核对实际响应字节，必要时禁用浏览器缓存或更新主题版本以刷新 `?v=` 参数。

当前构建规则：

| 资源    | 规则                                                               |
| ------- | ------------------------------------------------------------------ |
| 入口 JS | `templates/assets/js/{name}.js`，模板通过 `?v=主题版本` 控制缓存   |
| 分包 JS | `templates/assets/js/chunks/{name}-{主题版本}.js`                  |
| CSS     | `templates/assets/css/{name}.css`，模板通过 `?v=主题版本` 控制缓存 |

主题版本来自 `package.json`。改完前端资源后要重新构建，避免模板引用和构建产物不一致。

## 灯箱边界

主题负责：

| 内容         | 说明                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| 保留图片容器 | 如 `.moment-media`、`#photo-grid`、`.photo-detail-viewer`、`#article-content` |
| 兼容 PJAX    | 页面切换后重新触发插件注入脚本                                                |

插件负责：

| 内容     | 说明                                |
| -------- | ----------------------------------- |
| 路由匹配 | 在 lightgallery.js 插件后台配置路径 |
| 匹配区域 | 在插件后台配置 selector             |
| 灯箱行为 | 打开、关闭、切换、缩放等交互        |

不要在主题里为每个页面硬编码灯箱初始化逻辑。

## 本地验收

改代码后按影响范围选择：

| 改动范围         | 建议验证                                    |
| ---------------- | ------------------------------------------- |
| 文档             | Markdown 格式检查、链接和内容人工检查       |
| CSS/JS           | `pnpm lint`、`pnpm build-only`              |
| 插件页           | `pnpm verify:plugins`，再浏览器打开对应页面 |
| PJAX/灯箱/评论   | 浏览器从首页进入目标页，再返回和重复进入    |
| 发布、上传、登录 | 只在明确需要时手工验证，避免误改本地数据    |

脚本通过不等于真实页面通过。涉及页面交互时，必须再用浏览器看一次。

`pnpm verify:plugins` 和 `pnpm verify:plugins:deep` 只检查 HTTP 状态、服务端标记和公开 API，不能验证 PJAX。PJAX 验收必须从真实页面点击链接，并覆盖返回、前进、重复进入和快速连续导航；灯箱、评论、筛选、无限滚动等交互也必须在这条真实导航链里操作。
