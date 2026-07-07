# 开发说明

这份文档给二次开发和本地排查使用。普通配置请先看功能文档。

## 常用命令

| 命令                       | 作用                                |
| -------------------------- | ----------------------------------- |
| `pnpm dev`                 | 监听构建主题资源                    |
| `pnpm lint`                | 检查 `src` 里的 JS/TS 代码          |
| `pnpm build-only`          | 运行 TypeScript 检查并构建前端资源  |
| `pnpm build`               | 构建前端资源并打包主题              |
| `pnpm verify:plugins`      | 检查本地 Halo 核心插件页是否可访问  |
| `pnpm verify:plugins:deep` | 做更完整的插件页面和接口 smoke 检查 |

默认 smoke 目标是 `http://localhost:8090`。如果本地端口不同：

```bash
SMOKE_BASE_URL=http://localhost:8091 pnpm verify:plugins
```

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

| 方法                             | 用途                            |
| -------------------------------- | ------------------------------- |
| `runPageInit()`                  | 首屏和 DOM 已加载场景统一初始化 |
| `registerAlpinePageComponents()` | 注册页面级 Alpine 组件          |
| `notifySwupPageReady()`          | 通知 PJAX 页面脚本已就绪        |

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

## 资源缓存

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
