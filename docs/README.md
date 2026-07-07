# Sky Blog 全量功能文档

这套文档按二级、三级目录分类维护，覆盖主题和插件的完整配置、使用方式、依赖关系和验收方法。

## 文档结构

| 一级目录  | 二级分类                                         | 说明                                     | 入口                            |
| --------- | ------------------------------------------------ | ---------------------------------------- | ------------------------------- |
| `theme`   | `base`、`enhancements`                           | 全站基础设置和全站增强功能               | [主题设置](./theme/README.md)   |
| `content` | `core`、`taxonomy`                               | 主题自带内容页面和内容列表页面           | [内容页面](./content/README.md) |
| `plugins` | `integration`、`pages`、`content`、`collections` | 插件协作、独立页面、内容插件、收藏类插件 | [插件功能](./plugins/README.md) |
| `system`  | `auth`、`development`、`adaptation`              | 登录认证、开发维护、插件适配状态         | [系统维护](./system/README.md)  |

## 配置顺序

| 顺序 | 要做的事                             | 原因                                         |
| ---- | ------------------------------------ | -------------------------------------------- |
| 1    | 配置通用、顶部导航、页脚             | 这些影响全站基础展示                         |
| 2    | 配置首页和文章页                     | 这是访问最多的主流程                         |
| 3    | 配置分类、标签、归档、作者页         | 保证内容浏览链路完整                         |
| 4    | 安装并配置需要的插件                 | 图库、瞬间、友链、文档等都依赖插件           |
| 5    | 配置灯箱、搜索、评论、音乐、在线统计 | 这些属于全站增强功能                         |
| 6    | 做前台验收                           | 检查桌面端、移动端、PJAX、插件页面和 Console |

## 全量配置原则

| 原则               | 说明                                                          |
| ------------------ | ------------------------------------------------------------- |
| 覆盖完整配置       | 每个功能都要说明设置项、数据来源、依赖、验证和常见问题        |
| 主题和插件分清边界 | 主题负责展示和 DOM 结构，插件负责数据、同步、灯箱、评论等能力 |
| 用目录承载复杂度   | 新功能放到对应二级目录，不继续堆在 `docs` 根目录              |
| 页面和插件分开看   | 内容页看 `content`，插件页和独立功能看 `plugins`              |
| 验证必须写清楚     | 重要功能要说明页面入口、依赖插件、常见问题和检查方式          |

## 快速索引

### 主题设置

| 功能       | 所属目录             | 文档                                             |
| ---------- | -------------------- | ------------------------------------------------ |
| 通用设置   | `theme/base`         | [通用设置](./theme/base/general.md)              |
| 顶部导航   | `theme/base`         | [顶部导航](./theme/base/nav.md)                  |
| 页脚       | `theme/base`         | [页脚设置](./theme/base/footer.md)               |
| 音乐播放器 | `theme/enhancements` | [音乐播放器](./theme/enhancements/music.md)      |
| 在线统计   | `theme/enhancements` | [在线统计](./theme/enhancements/online-stats.md) |

### 内容页面

| 功能   | 所属目录           | 文档                                         |
| ------ | ------------------ | -------------------------------------------- |
| 首页   | `content/core`     | [首页设置](./content/core/index.md)          |
| 文章页 | `content/core`     | [文章页设置](./content/core/article.md)      |
| 分类页 | `content/taxonomy` | [分类页设置](./content/taxonomy/category.md) |
| 标签页 | `content/taxonomy` | [标签页设置](./content/taxonomy/tag.md)      |
| 归档页 | `content/taxonomy` | [归档页设置](./content/taxonomy/archive.md)  |
| 作者页 | `content/taxonomy` | [作者页设置](./content/taxonomy/author.md)   |

### 插件与独立功能

| 功能     | 所属目录              | 文档                                           |
| -------- | --------------------- | ---------------------------------------------- |
| 插件总览 | `plugins/integration` | [插件总览](./plugins/integration/overview.md)  |
| 关于页面 | `plugins/pages`       | [关于页面](./plugins/pages/about.md)           |
| 友情链接 | `plugins/content`     | [友情链接](./plugins/content/links.md)         |
| 图库     | `plugins/content`     | [图库页面](./plugins/content/photos.md)        |
| 瞬间     | `plugins/content`     | [瞬间页面](./plugins/content/moments.md)       |
| 朋友圈   | `plugins/content`     | [朋友圈页面](./plugins/content/friends.md)     |
| 文档中心 | `plugins/content`     | [文档页面](./plugins/content/docsme.md)        |
| 豆瓣     | `plugins/collections` | [豆瓣页面](./plugins/collections/douban.md)    |
| 追番     | `plugins/collections` | [追番页面](./plugins/collections/bangumi.md)   |
| Steam    | `plugins/collections` | [Steam 页面](./plugins/collections/steam.md)   |
| 装备     | `plugins/collections` | [装备页面](./plugins/collections/equipment.md) |

### 系统与维护

| 功能         | 所属目录             | 文档                                                     |
| ------------ | -------------------- | -------------------------------------------------------- |
| 登录认证     | `system/auth`        | [登录认证](./system/auth/auth.md)                        |
| 开发说明     | `system/development` | [开发说明](./system/development/dev.md)                  |
| 插件适配状态 | `system/adaptation`  | [插件适配状态](./system/adaptation/plugin-adaptation.md) |

## 常见判断

| 问题           | 建议                                                  |
| -------------- | ----------------------------------------------------- |
| 只想快速上线   | 仍然要按全量文档检查，只是可先关闭不用的插件功能      |
| 图片很多       | 重点看图库、瞬间、文档正文和 lightgallery.js 灯箱配置 |
| 经常发动态     | 重点看瞬间、附件存储、前端发布权限和灯箱配置          |
| 要写产品文档   | 重点看 Docsme、文档页 Dock、文档正文灯箱和评论        |
| 要展示豆瓣收藏 | 重点看 Douban 同步、图片代理和筛选接口                |
| 插件页面打不开 | 先确认插件安装、启用、版本和路由，再看主题适配状态    |
