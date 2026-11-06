# 2026-10-30 图库分页跳顶修复

用户在 `/photos` 滚动加载第二页时返回顶部。本轮用实际 Halo 页面复现：图片从 20 增至 40，滚动位置从 **1151px 变成 0px**，URL 没有变化。此前图库检查覆盖加载数量和重试，但没有锁定分页前后滚动位置；本批补上这一回归。

## 原因与主题修复

位置：`src/pages/photos/photos.js` 的 `syncLightGalleryItems()`。

本地 PluginLightGallery **1.2.1** 随附的是 lightgallery.js **1.4.0**，没有 `refresh()`。主题为登记新照片调用官方 `destroy(true)` 后重新初始化，而这个版本的销毁方法会无条件把 `prevScrollTop` 写回文档。未打开过灯箱时该值未定义，页面被带到顶部；打开过时也可能回到旧位置。这是主题没有处理灯箱销毁副作用的适配缺陷，图库分页 GET 本身正常。

修复沿用官方初始化、销毁方法和 `onCloseAfter` 事件：

- 在同步销毁/重建前记录当前视口，并在同一调用中恢复；失败时也保留阅读位置。不改插件内部字段或源码。
- 灯箱打开或关闭动画尚未结束时，先保留当前实例，等官方关闭事件再更新全部图片。
- 离开图库时清理等待监听，避免旧页面迟到更新；已有 `refresh()` 分支保持原逻辑。

依据：[插件随附的实际 JS](https://github.com/halo-sigs/plugin-lightgallery/blob/v1.2.1/src/main/resources/static/js/lightgallery.min.js)、[lightgallery.js 1.4.0 原源码](https://github.com/sachinchoolur/lightgallery.js/blob/1.4.0/src/js/lightgallery.js)、[官方 1.x API](https://sachinchoolur.github.io/lightgallery.js/docs/api.html)。没有改插件、后台配置或业务数据。

## 当前组合与验证

Halo Pro **2.27.1**、PluginPhotos **2.1.2**、PluginLightGallery **1.2.1**；主题 **2.2.41 / Halo >=2.27.0**，使用 `preview-theme=theme-sky-blog-1`。Node **24.21.0** / pnpm **12.6.0**。

源码指纹：`5aeedec5207b8573acb731222147705f75a0d59a124cf1c5f54d48b0f61d1b7e`。构建后刷新模板和 Page Cache，3 份抽查资源（图库 JS/CSS、主 JS）与磁盘 SHA-256 一致；浏览器当前连接禁缓存。

| 实际浏览器场景 | 桌面 1440px | 手机 390px |
| --- | --- | --- |
| 第二页追加，20 → 40 张 | **1251 → 1251px** | **6260 → 6260px** |
| 打开、关闭新增照片灯箱，再追加第三页至 46 张 | **3236 → 3236px** | **14334 → 14334px** |
| 新增照片可打开，灯箱总数同步 | 40/40，末页 46/46 | 40/40，末页 46/46 |
| 分页响应在灯箱打开期间返回 | 原灯箱保持打开，关闭后更新到 40 张 | 同左 |
| 详情 → 浏览器返回 → 再加载第二页 | **1223 → 1223px** | **5190 → 5190px** |

默认分页使用真实照片和响应；打开灯箱期间的竞态使用实际 GET 响应配浏览器内延迟门控，没有写站点数据。当前详情跳转采用整页兼容导航，未把它称为同文档 PJAX。首次返回专项过早在导航恢复完成前滚动，修正等待条件后通过，原驱动保留。

图库专项 **21/21**，新增 5 项中 4 项在旧源码上按预期失败。`pnpm run build-only` 通过：**343 项 Node 测试通过、2 项可选导航 Java 夹具跳过、0 失败**；lint、格式及差异检查通过。未运行全站回归或重新核对全部插件发行。

本批由作者复核差异，未进行另一位审查者的独立审查。未暂存、提交、推送或发布。精确结果见[脱敏证据](./evidence/2026-10-30/photos-scroll-fix.json)，原始驱动、RED/GREEN、截图在 `/tmp/sky-photos-scroll-20261030/`。

## 人工复验

打开 [本地主题 1 图库](http://localhost:8090/photos?preview-theme=theme-sky-blog-1)，开发者工具勾选 Disable cache，保持工具打开后刷新。桌面和手机各向下滚动触发第二页，画面应停留在当前浏览位置；继续到末页，再打开新增照片、关闭灯箱，回到原位置。进入照片详情后返回，再次分页也应正常。
