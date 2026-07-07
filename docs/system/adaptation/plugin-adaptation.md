# 插件适配状态

这份文档记录主题和 Halo 插件的适配边界、版本基线和本地验收方式。它不是安装教程，具体配置请看各功能文档。

## 适配原则

| 原则               | 说明                                                       |
| ------------------ | ---------------------------------------------------------- |
| 优先使用插件路由   | 主题消费插件已经提供的页面模型、Finder、片段或公开 API     |
| 不重写插件后端     | 同步、抓取、管理、权限由插件负责                           |
| 保持 PJAX 合约     | 插件页必须有 `#swup`、`#swup-scripts`、`#swup-page-extras` |
| 页面脚本可重复进入 | PJAX 切换后要能重新初始化，离开时要能清理                  |
| 工具插件只做集成   | 搜索、评论、灯箱、代码高亮等不在主题里重造                 |
| 配置放插件后台     | 灯箱 selector、豆瓣图片代理、Steam API 等交给插件配置      |

## 当前适配矩阵

| 插件                            | 主题用途                     | 适配状态                        | 主要入口                      |
| ------------------------------- | ---------------------------- | ------------------------------- | ----------------------------- |
| `PluginLinks v2.0.0`            | 友链页面、首页友链、友链申请 | 已适配                          | `/links`                      |
| `PluginPhotos v2.1.1`           | 图库列表、照片详情           | 已适配                          | `/photos`、`/photos/{name}`   |
| `PluginMoments v1.16.0`         | 瞬间列表、详情、前端发布     | 已适配                          | `/moments`、`/moments/{name}` |
| `plugin-friends v1.4.6`         | 朋友圈 RSS 动态              | 已适配                          | `/friends`                    |
| `plugin-docsme v1.7.0`          | 文档中心、目录、正文         | 已适配                          | `/docs`、`/docs/**`           |
| `plugin-bilibili-bangumi 1.4.0` | 追番页面和侧边栏卡片         | 已适配                          | `/bangumis`                   |
| `halo-plugin-steam v0.4.0`      | Steam 页面和侧边栏卡片       | 已适配                          | `/steam`                      |
| `plugin-equipment v1.1.1`       | 装备页面                     | 已适配                          | `/equipments`                 |
| `plugin-douban v1.2.5`          | 豆瓣海报网格                 | 已适配                          | `/douban`                     |
| `PluginSearchWidget v1.7.1`     | 导航搜索入口                 | 已适配                          | 导航搜索按钮                  |
| `PluginCommentWidget v3.1.2`    | 文章、页面、插件页评论       | 已适配                          | 评论区                        |
| `plugin-shiki v1.3.1`           | 文章和文档代码高亮           | 已适配                          | 正文代码块                    |
| `PluginLightGallery v1.2.1`     | 图片灯箱                     | 主题保留 DOM，插件配置 selector | 文章、图库、瞬间、文档        |
| `Passkey v1.0.4`                | 登录页认证入口               | 保留兼容结构                    | `/login`                      |
| `link-submit v1.0.7`            | 友链申请                     | 依赖 `PluginLinks v2.0.0`       | `/links`                      |

## 重点兼容点

| 功能            | 注意事项                                                                      |
| --------------- | ----------------------------------------------------------------------------- |
| Links + Friends | 当前本地建议 `PluginLinks v2.0.0`，避免与朋友圈和友链申请插件发生类加载冲突   |
| Photos          | 列表页使用 `#photo-grid`，详情页使用 `.photo-detail-viewer` 给灯箱插件匹配    |
| Moments         | 媒体区域保留 `.moment-media` 和 `data-src`，发布上传建议使用本地存储或 S3     |
| Docsme          | 文档正文容器是 `#article-content`，适合给灯箱插件扫描                         |
| Douban          | 列表走公开 API，图片代理在插件后台配置，主题只做失败占位                      |
| Steam           | 当前运行态优先兼容 `/apis/api.steam.timxs.com/v1alpha1`，并保留旧命名空间兜底 |
| Passkey         | 登录表单必须保留 `.halo-form` 和插件认证片段                                  |
| Alist 存储      | 不作为瞬间前端发布后端，避免上传成功但发布链路失败                            |

## 推荐灯箱配置

在 lightgallery.js 插件后台配置，不需要主题逐页主动初始化：

| 路径匹配      | 匹配区域               |
| ------------- | ---------------------- |
| `/photos`     | `#photo-grid`          |
| `/photos/**`  | `.photo-detail-viewer` |
| `/moments`    | `.moment-media`        |
| `/moments/**` | `.moment-media`        |
| `/docs/**`    | `#article-content`     |

文章详情页如果也需要灯箱，可按站点文章路由额外添加 `#article-content`。

## 本地验证

基础检查：

```bash
pnpm lint
pnpm build-only
pnpm verify:plugins
```

深度检查：

```bash
pnpm verify:plugins:deep
```

指定详情页：

```bash
PHOTO_DETAIL_URL=/photos/{photoName} \
MOMENT_DETAIL_URL=/moments/{momentName} \
DOC_DETAIL_URL=/docs/{project}/{doc} \
pnpm verify:plugins
```

## 人工验收清单

| 场景           | 要看什么                                 |
| -------------- | ---------------------------------------- |
| 桌面端         | 页面布局、侧边栏、卡片、分页、空态       |
| 移动端         | 是否横向溢出，按钮和卡片是否拥挤         |
| PJAX           | 首页进入插件页，再返回和重复进入         |
| 暗色模式       | 搜索、评论、代码块、灯箱颜色是否正常     |
| 灯箱           | 点击图库、瞬间、文档图片是否打开插件灯箱 |
| 评论           | 评论组件是否只初始化一次                 |
| 发布/上传/登录 | 只有改到对应模板时再做真实操作           |

## 已知风险

| 风险               | 处理方式                                  |
| ------------------ | ----------------------------------------- |
| 搜索结果指向旧文章 | 属于本地搜索索引数据问题，需要重建索引    |
| 天气接口偶发失败   | 属于外部数据源问题，不阻塞插件页适配      |
| 豆瓣封面被远端拦截 | 在 `plugin-douban` 配置图片代理           |
| Steam API 不稳定   | 检查服务器网络、API Key 和 Steam 隐私设置 |
| 朋友圈为空         | 检查 RSS 抓取、友链数据和插件任务         |
