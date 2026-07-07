# 系统与插件配置

这页说明主题和外部插件怎么配合。具体页面怎么设置，请进入对应功能文档。

## Halo 基础设置

| 设置位置         | 配置项       | 作用                             |
| ---------------- | ------------ | -------------------------------- |
| 设置 -> 基本设置 | 站点标题     | 页面标题、导航和 SEO 的回退名称  |
| 设置 -> 基本设置 | 站点副标题   | 自动追加到页面 `<title>` 后面    |
| 设置 -> 基本设置 | 站点 Logo    | 导航栏和页脚的回退 Logo          |
| 设置 -> 基本设置 | Favicon      | 浏览器标签图标                   |
| 设置 -> 文章设置 | 每页文章数量 | 影响首页、分类、标签、归档等列表 |

## 图标配置

| 位置                     | 字段   | 用途               |
| ------------------------ | ------ | ------------------ |
| 菜单 -> 菜单项 -> 元数据 | `icon` | 导航、Dock、页脚   |
| 文章 -> 分类 -> 元数据   | `icon` | 分类卡片、分类列表 |
| 文章 -> 标签 -> 元数据   | `icon` | 标签卡片、标签列表 |

建议使用 Iconify 名称，例如 `heroicons:home`。不建议直接写大段 SVG。

## 插件总览

| 插件                    | 用途                             | 入口                          | 说明                                                 |
| ----------------------- | -------------------------------- | ----------------------------- | ---------------------------------------------------- |
| PluginLinks             | 友情链接、分组、申请入口         | `/links`                      | [友情链接](../content/links.md)                      |
| PluginPhotos            | 图库列表、照片详情、EXIF         | `/photos`、`/photos/{name}`   | [图库页面](../content/photos.md)                     |
| PluginMoments           | 瞬间、媒体、点赞、评论、前端发布 | `/moments`、`/moments/{name}` | [瞬间页面](../content/moments.md)                    |
| plugin-docsme           | 文档中心、目录、正文             | `/docs`、`/docs/**`           | [文档页面](../content/docsme.md)                     |
| plugin-friends          | 朋友圈 RSS 动态                  | `/friends`                    | [朋友圈页面](../content/friends.md)                  |
| plugin-douban           | 豆瓣收藏记录                     | `/douban`                     | [豆瓣页面](../collections/douban.md)                 |
| plugin-bilibili-bangumi | Bilibili 追番记录                | `/bangumis`                   | [追番页面](../collections/bangumi.md)                |
| halo-plugin-steam       | Steam 资料、游戏库、热力图       | `/steam`                      | [Steam 页面](../collections/steam.md)                |
| plugin-equipment        | 装备、工具、好物展示             | `/equipments`                 | [装备页面](../collections/equipment.md)              |
| PluginLightGallery      | 图片灯箱                         | 文章、图库、瞬间、文档正文    | 本页下方说明                                         |
| PluginCommentWidget     | 评论组件                         | 文章、页面、插件页评论区      | 插件后台配置                                         |
| PluginSearchWidget      | 搜索组件                         | 导航搜索入口                  | [顶部导航](../../theme/base/nav.md)                  |
| plugin-online           | 在线访客统计                     | 侧边栏小工具                  | [在线统计](../../theme/enhancements/online-stats.md) |

## lightgallery.js 灯箱

灯箱由 `PluginLightGallery` 后台配置。主题只保留稳定 DOM，不逐页主动初始化。

推荐配置：

| 页面     | 路由匹配       | 匹配区域               |
| -------- | -------------- | ---------------------- |
| 瞬间列表 | `/moments`     | `.moment-media`        |
| 瞬间详情 | `/moments/**`  | `.moment-media`        |
| 图库列表 | `/photos`      | `#photo-grid`          |
| 图库详情 | `/photos/**`   | `.photo-detail-viewer` |
| 文档正文 | `/docs/**`     | `#article-content`     |
| 文章正文 | `/archives/**` | `#article-content`     |

不建议配置：

| 页面          | 原因                       |
| ------------- | -------------------------- |
| `/links`      | 主要是站点 Logo 或头像     |
| `/douban`     | 海报点击通常应进入条目     |
| `/bangumis`   | 封面是条目卡片             |
| `/steam`      | 图片是头像、徽章或游戏封面 |
| `/equipments` | 图片是设备卡片             |

灯箱不生效时，优先检查：

1. 路由是否匹配，详情页通常需要 `/**`。
2. selector 是否存在，例如图库详情是 `.photo-detail-viewer`，不是 `#photo-grid`。
3. 图片是否在匹配区域内。
4. 插件配置是否保存并生效。

## 附件存储策略

瞬间前端发布需要附件上传能力：

| 存储策略  | 图片   | 视频   | 音频   | 建议               |
| --------- | ------ | ------ | ------ | ------------------ |
| 本地存储  | 支持   | 支持   | 支持   | 小站点首选         |
| S3/OSS    | 支持   | 支持   | 支持   | 生产环境推荐       |
| Lsky 图床 | 支持   | 不支持 | 不支持 | 只适合图片         |
| Alist     | 不建议 | 不建议 | 不建议 | 不作为瞬间发布后端 |

如果需要发视频或音频，优先使用本地存储或 S3/OSS。

## 版本注意

| 插件组合                                   | 注意事项                                       |
| ------------------------------------------ | ---------------------------------------------- |
| PluginLinks + plugin-friends + link-submit | 当前本地建议使用 `PluginLinks v2.0.0`          |
| plugin-docsme                              | 首页文档中心需要 `plugin-docsme >= 1.4.0`      |
| plugin-douban                              | 图片代理在插件后台配置，主题只做失败占位       |
| halo-plugin-steam                          | Steam 资料需要 API Key、SteamID 和公开隐私设置 |
| Passkey                                    | 登录页必须保留 Halo 表单结构                   |

更完整的版本基线见 [插件适配状态](../../system/adaptation/plugin-adaptation.md)。

## 验证命令

本地 Halo 在 `http://localhost:8090` 启动后：

```bash
pnpm verify:plugins
```

需要复查首页插件组件、Docsme、评论、搜索、灯箱和作者页 Moments 时：

```bash
pnpm verify:plugins:deep
```

脚本通过不等于真实页面一定没问题。重要页面仍建议用浏览器检查点击、加载、评论、灯箱和移动端布局。
