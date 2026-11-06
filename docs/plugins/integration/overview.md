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

| 插件                    | 用途                             | 入口                           | 说明                                                 |
| ----------------------- | -------------------------------- | ------------------------------ | ---------------------------------------------------- |
| PluginLinks             | 友情链接、RSS 动态、申请入口     | `/links`、`/links?view=friends` | [友情链接](../content/links.md)                      |
| PluginPhotos            | 图库列表、照片详情、EXIF         | `/photos`、`/photos/{name}`    | [图库页面](../content/photos.md)                     |
| PluginMoments           | 瞬间、媒体、点赞、评论、前端发布 | `/moments`、`/moments/{name}`  | [瞬间页面](../content/moments.md)                    |
| plugin-docsme           | 文档中心、目录、正文             | `/docs`、`/docs/**`            | [文档页面](../content/docsme.md)                     |
| plugin-douban           | 豆瓣收藏记录                     | `/douban`                      | [豆瓣页面](../collections/douban.md)                 |
| plugin-bilibili-bangumi | Bilibili 追番记录                | `/bangumis`                    | [追番页面](../collections/bangumi.md)                |
| halo-plugin-steam       | Steam 资料、游戏库、热力图       | `/steam`                       | [Steam 页面](../collections/steam.md)                |
| plugin-equipment        | 装备、工具、好物展示             | `/equipments`                  | [装备页面](../collections/equipment.md)              |
| PluginLightGallery      | 图片灯箱                         | 文章、图库、瞬间、文档正文     | 本页下方说明                                         |
| PluginCommentWidget     | 评论组件                         | 文章、页面、插件页评论区       | 插件后台配置                                         |
| PluginSearchWidget      | 搜索组件                         | 导航搜索入口                   | [顶部导航](../../theme/base/nav.md)                  |
| plugin-online           | 在线访客统计                     | 侧边栏小工具                   | [在线统计](../../theme/enhancements/online-stats.md) |
| vote                    | 正文投票块                       | 文章、页面和文档正文           | 1.1.3 主题变量；交互需实站回归                       |
| text-diagram            | Mermaid/PlantUML 文本绘图        | 文章、页面和文档正文           | 1.5.2 绘图容器与暗色 selector                        |
| PluginContactForm       | 联系表单                         | 正文、单页、贴边按钮和页面弹窗 | 已适配 2.1.0 的 embed/trigger/自动展示与 PJAX 清理；提交、上传和通知未验，见[当前结果](../../system/adaptation/current-plugin-results.md) |
| ai-assistant            | AI 总结小部件                    | 文章顶部                       | 当前版本与验证范围见插件适配状态                     |
| seo-tools               | canonical、社交标签及结构化数据 | 全站 Head                     | 插件拥有输出；主题仅按明确设置或插件不可用时兜底      |
| PluginFeed              | RSS 自动发现与订阅              | Head、`/feed.xml`             | RSS 内容由插件提供                                  |
| shiki                   | 代码高亮、折叠与主题切换        | 文章、文档代码块              | 沿用官方组件与插件配置，处理 PJAX 生命周期           |
| auth-passkey            | 通行密钥登录入口                | `/login`                      | 交由官方认证流程；用户手测与自动验收证据分开记录      |
| editor-hyperlink-card   | 块级及行内超链接卡片            | 正文内容                      | 消费官方宿主，约束布局并保留插件配色                 |
| plugin-katex            | 行内和块级数学公式              | 文章、单页、文档正文          | 保留官方 HTML/MathML；仅在必要的 PJAX 环节补渲染      |
| lottery                 | 抽奖卡片展示                    | 正文内容                      | 目前只验实际空态，参与与开奖不计作通过               |
| restricted-reading      | 受限内容提示及官方弹窗接入      | 文章、单页正文                | answer 样本已验，mp 仅隔离回归；不代替服务端解锁      |
| dishes                  | 在线点菜独立页面                | `/dishes`                     | 沿用插件完整页面，主题只绕过 PJAX                    |
| schedule-calendar       | 日程独立页面                    | `/schedule-calendar`          | 沿用插件完整页面；未覆盖主题模板不等于不兼容          |
| maintenance             | 独立维护模板                    | `/maintenance`                | 展示已验；全站维护接管开关未切换                     |

以上27项对应[主题适配矩阵](../../system/adaptation/plugin-adaptation.md)，是已有接入点清单，不代表27项全部业务或全部最新版本均通过。[当前逐插件结果](../../system/adaptation/current-plugin-results.md)分别记录实际安装、官方稳定目标和测试范围；编辑器、后台管理及存储插件按其对主题的实际影响另行说明。

`plugin-friends` 已退出当前主题集成；历史说明见[朋友圈退役记录](../content/friends.md)。

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

| 插件组合                | 注意事项                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| PluginLinks             | 当前实装和稳定目标 `2.5.0`，主题保留 `2.3.0` 的分组、公开 RSS、访客申请契约；申请/审核写入仍待验证 |
| PluginPhotos            | `2.1.2` 列表、详情、PJAX、20→40→46 张无限滚动灯箱与 46 个唯一详情路由均通过                             |
| plugin-bilibili-bangumi | 稳定版 `1.4.1` 已通过数值越界 404、文本参数回退及真页 PJAX；实现契约继续保持 `1.4.0`                    |
| plugin-shiki            | 当前实装 `1.5.1`；主题代码块换行与 26 个代码块的代表文章已验证，完整插件结果见适配状态                 |
| plugin-docsme           | 当前实装与目标版本、验证范围见适配状态；主题保留文档中心模板契约                                      |
| plugin-douban           | 图片代理在插件后台配置，主题只做失败占位                                                                |
| halo-plugin-steam       | Steam 资料需要 API Key、SteamID 和公开隐私设置                                                          |
| Passkey                 | 主题负责登录入口；认证完成情况与用户手动验收记录见适配状态                                               |
| ai-assistant            | 当前实装 `3.1.0` + Foundation `1.3.0`，主题采用 `3.0.0` 摘要宿主契约；前阶段既有摘要读取、390px 展示及 PJAX 离页清理已验，模型生成与自动注入未验，精确组合见[适配状态](../../system/adaptation/plugin-adaptation.md) |

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
