# 主题开发与架构说明

本文档主要记录主题底层的技术架构与核心机制，供参与二次开发或排查问题的开发者参考。

## 1. PJAX (Swup) 与 Alpine.js 协作机制

为了实现无刷新页面跳转（PJAX），主题集成了 `swup` 库。但同时，为保障高交互性引入了 `Alpine.js` 进行组件状态管理。这两者存在生命周期冲突，主题采用以下机制解决：

### 1.1 生命周期解耦
在常规的页面加载中，Alpine.js 会在 DOMContentLoaded 时扫描全身节点。在 PJAX 切换时，必须销毁旧组件并重新初始化新 HTML：
- **销毁：** 监听 `swup.hooks.before('content:replace')`，调用 `Alpine.destroyTree()` 销毁旧容器内组件实例，并暂停 `MutationObserver` 避免在替换 DOM 时触发大批量无用重绘。
- **恢复：** 监听 `swup.hooks.on('content:replace')`，在 DOM 替换后，通过 `Alpine.initTree()` 重新接管新容器。

### 1.2 异步组件加载与恢复卡顿问题（已修复）
主题对各个独立页面（如归档、友链等）进行了按需拆分的 JS 进行按需加载（通常只包含 `Alpine.data()` 定义）。
**原先的问题：** 曾经采用 `notifySwupPageReady()` 机制通知脚本加载完毕并恢复 Alpine，这在首次跳转时正常；但在命中浏览器缓存时，ES 模块代码不会再执行，该信号函数未被调用，导致出现长达 5 秒的超时兜底卡顿。

**当前的解决方案（基于 load 事件）：**
不再依赖模块内同步执行的调用机制，而是通过查找加载区（`#swup-scripts`）中所有注入的 `type="module"` 脚本，针对脚本注册纯粹的 `load` / `error` 原生事件：
1. **首次导航**：脚本完整下载并解析执行（完成 `Alpine.data` 注册）后，触发 `load` 事件，恢复 Alpine。
2. **缓存命中**：浏览器不重新执行 ES Module，但因为代码已由缓存命中返回，脚本对应的 `load` 事件依旧会几乎立即触发，进而实现快速接管，解决了缓存死锁问题。
3. **内联脚本**：针对没有独立 JS 文件的页面（如 `friends`），通过页面 HTML 内联脚本注入全局变量 `__completeSwupPageInit`，作为同频同步信号，优先放行恢复控制。

---

## 2. Vite 构建产物与缓存策略

为了避免构建后每次升级主题时加载旧资源，通常会在打包文件名带上哈希值后缀（如 `xxx-[hash].js`）。

### 2.1 抛弃 Chunk 哈希后缀
在 PJAX 开启的情况下，代码中存在 `import('./chunks/xxxx.js')` 形式的动态加载。如果由于使用了强缓存导致旧版本 `main.js` 入口文件缓存残留，会导致请求不存在的已哈希（版本已经过时）JS 资源产生 404 错误。

为此，**Vite 产物被配置为不携带 `[hash]` 后缀**：
- `vite.config.ts` 中的文件配置：`chunkFileNames: 'js/chunks/[name].js'`。

### 2.2 版本号控制缓存 (Cache-Busting)
去掉 hash 后，为了在升级主题时有效清除浏览器默认缓存。主题采用**统一在入口标签附加版本查询参数**的方式处理：
后台会在向页面注入 `<script src="/templates/assets/js/main.js?v=主题版本号"></script>`。
该方式能够强行引发新的 `ETag` 或 `Last-Modified` 检查或完全跳过本地强缓存，实现了平滑的主题热变更，避免了幽灵缓存导致的 404 文件抛错。
