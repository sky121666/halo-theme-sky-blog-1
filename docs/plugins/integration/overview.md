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
| vote                    | 正文投票块                       | 文章、页面和文档正文          | 1.1.3 主题变量；交互需实站回归                       |
| text-diagram            | Mermaid/PlantUML 文本绘图        | 文章、页面和文档正文          | 1.5.2 绘图容器与暗色 selector                        |
| PluginContactForm       | 联系表单                         | 正文、贴边按钮和页面弹窗      | 契约 1.6.3；当前 1.6.4 完整流程仍待实站回归          |
| ai-assistant            | AI 总结小部件                    | 文章顶部                      | 1.5.1 DOM/主题变量；市场 2.2.4 待实站回归            |

## lightgallery.js 灯箱

灯箱 selector 由 `PluginLightGallery` 后台配置。主题保留稳定 DOM，并在 PJAX 切换后加载插件资源、重放插件生成的初始化脚本；图库无限滚动追加内容时，主题只补齐 DOM 契约并刷新现有实例。若当前插件实例不提供 `refresh()`，主题会复制插件 settings 后销毁并单实例重建，不覆盖后台 selector。

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

| 插件组合                                   | 注意事项                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| PluginLinks + plugin-friends + link-submit | 当前 2.0.0 + 1.4.6 + 1.0.7 均已启动；Links 申请 Modal 首次/PJAX 重入通过，2.1.0～2.2.1 存在组合类加载冲突 |
| PluginPhotos                               | `2.1.2` 列表、详情、PJAX、20→40→46 张无限滚动灯箱与 46 个唯一详情路由均通过                               |
| plugin-bilibili-bangumi                    | 稳定版 `1.4.1` 已通过数值越界 404、文本参数回退及真页 PJAX；实现契约继续保持 `1.4.0`                       |
| plugin-shiki                               | 主题契约仍为 `1.3.1`；当前 `1.4.1` 已通过 26 个代码块、折叠、明暗与两轮 PJAX，记录为 `testedVersion`       |
| plugin-docsme                              | 主题当前契约为 `plugin-docsme 1.7.0`                                                                      |
| plugin-douban                              | 图片代理在插件后台配置，主题只做失败占位                                                                  |
| halo-plugin-steam                          | Steam 资料需要 API Key、SteamID 和公开隐私设置                                                            |
| Passkey                                    | 登录入口与认证 options 请求通过；未选择凭据或完成认证                                                     |
| ai-assistant                               | 只确认 `1.5.1` AI 总结契约；市场 `2.2.4` 待回归                                                           |

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

包含投票、绘图或联系表单内容时，可以指定样例页面，确认服务端输出了对应 Web Component 标记：

```bash
VOTE_PAGE_URL=/archives/{post} \
TEXT_DIAGRAM_PAGE_URL=/archives/{post} \
CONTACT_FORM_PAGE_URL=/archives/{post} \
AI_SUMMARY_PAGE_URL=/archives/{post} \
pnpm verify:plugins
```

脚本通过不等于真实页面一定没问题。重要页面仍建议用浏览器检查点击、加载、评论、灯箱和移动端布局。
