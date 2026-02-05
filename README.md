# Sky Blog Theme

> 基于 Vite + Tailwind CSS v4 + DaisyUI + Alpine.js 构建的现代化 Halo 2.0 博客主题

[![Halo](https://img.shields.io/badge/Halo-2.22.9+-blue)](https://halo.run)
[![License](https://img.shields.io/badge/License-GPL--3.0-green)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20+-brightgreen)](https://nodejs.org)

## 📖 简介

Sky Blog Theme 是一款功能丰富、高度可定制的 Halo 2.0 主题，采用现代前端技术栈开发。

**核心特点**：
- 🎨 35+ DaisyUI 主题，可视化预览切换
- 📱 完美的响应式设计
- ⚡ 极致的性能优化
- 🔧 灵活的后台配置
- 🧩 丰富的插件适配

## 🌐 演示

| 链接 | 说明 |
|------|------|
| [在线演示](https://5ee.net) | 5ee 博客 |
| [完整文档](https://5ee.net/docs/halo-theme-sky-blog-1/jianjie) | 配置指南和使用说明 |
| [应用市场](https://www.halo.run/store/apps/app-squauk4h) | Halo 官方应用市场 |

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🎨 35+ 主题 | DaisyUI 预设主题，可视化预览选择 |
| 🌓 明暗切换 | 浅色/深色主题独立配置 |
| 📱 响应式 | 完美适配移动端和桌面端 |
| ⚡ 加载动画 | 多种动画样式，避免闪烁 |
| 🎯 悬浮控制栏 | 多种样式可选 |
| 📝 列表风格 | 卡片/列表/杂志/极简 |
| 🌐 背景定制 | 网格背景效果 |
| 📊 GitHub 热力图 | 贡献统计展示 |
| 🖼️ 图库灯箱 | lightgallery 效果 |
| 👤 作者主页 | 独立模板，支持文章/瞬间/动态展示 |
| 💻 极客终端 | 独家终端风格认证界面 |
| 🧊 玻璃拟态 | 全局磨砂质感设计 |
| 🏷️ 丰富短代码 | 提示块/折叠/标签页/时间轴等 |
| 🔍 全局搜索 | 支持文章/页面/瞬间/分类搜索 |
| 🎭 Iconify 图标 | 菜单/分类/标签支持自定义图标选择器 |
| 📸 瞬间上传 | 前端发布瞬间，支持图片/视频/音频上传 |

---

## 📄 模板适配

### 核心页面

| 模板 | 文件 | 说明 |
|------|------|------|
| 首页 | `index.html` | 文章列表、瞬间、朋友动态 Tab 切换 |
| 文章 | `post.html` | 文章详情、目录、评论、SEO 优化 |
| 页面 | `page.html` | 独立页面 |
| 作者 | `author.html` | 作者主页、文章/瞬间列表 |
| 归档 | `archives.html` | 按年月归档 |
| 分类 | `categories.html` / `category.html` | 分类列表/分类文章 |
| 标签 | `tags.html` / `tag.html` | 标签云/标签文章 |

### 自定义模板

| 模板 | 文件 | 说明 |
|------|------|------|
| 关于页 | `page_about.html` | 个人介绍、技术栈、GitHub 统计 |
| 卡片风格 | `category-card.html` | 分类文章卡片布局 |
| 列表风格 | `category-list.html` | 分类文章列表布局 |
| 杂志风格 | `category-magazine.html` | 分类文章杂志布局 |
| 极简风格 | `category-minimal.html` | 分类文章极简布局 |

### 插件模板

| 模板 | 文件 | 依赖插件 | 说明 |
|------|------|------|------|
| 友链 | `links.html` | plugin-links | 友情链接展示 |
| 图库 | `photos.html` | plugin-photos | 瀑布流图库 |
| 瞬间 | `moments.html` / `moment.html` | plugin-moments | 瞬间列表/详情 |
| 朋友圈 | `friends.html` | plugin-friends | RSS 聚合 |
| 文档 | `docs.html` / `doc.html` / `doc-catalog.html` | plugin-docsme | 知识库文档 |
| 追番 | `bangumis.html` | plugin-bangumi | Bilibili 追番 |
| Steam | `steam.html` | plugin-steam | Steam 游戏库 |

### 侧边栏小工具

| 组件 | 说明 | 依赖 |
|------|------|------|
| 作者卡片 | 头像、名称、简介、社交链接 | 无 |
| 欢迎卡片 | 天气信息、问候语、日期显示 | 无 |
| 最新文章 | 最新发布的文章列表 | 无 |
| 热门文章 | 访问量最高的文章列表 | 无 |
| 分类列表 | 文章分类导航 | 无 |
| 标签云 | 文章标签聚合 | 无 |
| 博客统计 | 文章数、分类数、标签数、最后更新 | 无 |
| 追番卡片 | Bilibili 追番轮播展示 | plugin-bangumi |
| Steam 卡片 | Steam 游戏信息展示 | plugin-steam |
| 广告位 | 自定义图片链接 | 无 |

---

## 🛠️ 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Vite | 7.x | 构建工具 |
| Tailwind CSS | 4.x | 原子化 CSS |
| DaisyUI | 5.x | UI 组件库 |
| Alpine.js | 3.x | 响应式框架 |
| Thymeleaf | 3.x | 模板引擎 |
| TypeScript | 5.x | 类型安全 |

---

## 🔌 插件适配

主题已适配以下插件，开箱即用：

### 内容类

| 插件 | 应用市场 | GitHub | 主题支持 |
|------|---------|--------|---------|
| 瞬间管理 | [app-SnwWD](https://www.halo.run/store/apps/app-SnwWD) | [plugin-moments](https://github.com/halo-sigs/plugin-moments) | ✅ 前端发布、媒体上传 |
| 朋友圈 | [app-yISsV](https://www.halo.run/store/apps/app-yISsV) | [plugin-friends](https://github.com/halo-sigs/plugin-friends) | ✅ RSS 聚合展示 |
| Docsme 文档 | [app-yffxw](https://www.halo.run/store/apps/app-yffxw) | - | ✅ 知识库文档 |
| 图库管理 | [app-BmQJW](https://www.halo.run/store/apps/app-BmQJW) | [plugin-photos](https://github.com/halo-sigs/plugin-photos) | ✅ 瀑布流相册 |
| 链接管理 | [app-hfbQg](https://www.halo.run/store/apps/app-hfbQg) | [plugin-links](https://github.com/halo-sigs/plugin-links) | ✅ 友链书签 |
| 友链提交 | [app-glejqzwk](https://www.halo.run/store/apps/app-glejqzwk) | [plugin-link-submit](https://github.com/jiangqizheng/plugin-link-submit) | ✅ 自助申请 |

### 扩展类

| 插件 | 应用市场 | GitHub | 主题支持 |
|------|---------|--------|---------|
| Bilibili 追番 | [app-OTFPN](https://www.halo.run/store/apps/app-OTFPN) | [plugin-bilibili-bangumi](https://github.com/Roozenlz/plugin-bilibili-bangumi) | ✅ 追番列表、轮播卡片 |
| Steam 游戏库 | [app-0ojqyzfh](https://www.halo.run/store/apps/app-0ojqyzfh) | [plugin-steam](https://github.com/Tim0x0/halo-plugin-steam) | ✅ 游戏库展示、侧边栏卡片 |
| 投票管理 | [app-veyvzyhv](https://www.halo.run/store/apps/app-veyvzyhv) | [plugin-vote](https://github.com/chengzhongxue/plugin-vote) | ✅ CSS 变量适配 |
| 装备管理 | [app-ytygyqml](https://www.halo.run/store/apps/app-ytygyqml) | [plugin-equipment](https://github.com/chengzhongxue/plugin-equipment) | ✅ 装备展示/我的装备 |

### 工具类

| 插件 | 应用市场 | GitHub | 主题支持 |
|------|---------|--------|---------|
| Shiki 代码高亮 | [app-kzloktzn](https://www.halo.run/store/apps/app-kzloktzn) | [plugin-shiki](https://github.com/halo-sigs/plugin-shiki) | ✅ 代码块美化 |
| 搜索组件 | [app-DlacW](https://www.halo.run/store/apps/app-DlacW) | [plugin-search-widget](https://github.com/halo-sigs/plugin-search-widget) | ✅ 全局搜索 |
| 评论组件 | [app-YXyaD](https://www.halo.run/store/apps/app-YXyaD) | [plugin-comment-widget](https://github.com/halo-sigs/plugin-comment-widget) | ✅ 评论系统 |
| 文本绘图 | [app-ahBRi](https://www.halo.run/store/apps/app-ahBRi) | [plugin-text-diagram](https://github.com/halo-sigs/plugin-text-diagram) | ✅ Mermaid/PlantUML |
| lightgallery | [app-OoggD](https://www.halo.run/store/apps/app-OoggD) | [plugin-lightgallery](https://github.com/halo-sigs/plugin-lightgallery) | ✅ 图片灯箱 |
| Passkey 认证 | [app-g7tggrco](https://www.halo.run/store/apps/app-g7tggrco) | [plugin-auth-passkey](https://github.com/iLay1678/halo-plugin-auth-passkey) | ✅ 无密码登录/指纹/面部识别 |

### 存储类

> 瞬间前端发布功能需要配置存储策略

| 存储插件 | 图片 | 视频 | 音频 | 状态 | 说明 |
|---------|------|------|------|------|------|
| 本地存储 | ✅ | ✅ | ✅ | 推荐 | 内置，无需配置 |
| S3/OSS | ✅ | ✅ | ✅ | 推荐 | 云存储，支持 CDN |
| Lsky 图床 | ✅ | ❌ | ❌ | 可用 | 仅支持图片，有压缩 |
| Alist | ❌ | ❌ | ❌ | 暂不可用 | 等待官方修复 |

> **Alist 说明**：Halo 2.22.12 + Alist 插件存在已知 bug，已提交问题报告。临时方案：使用本地存储或 S3。

---

## 🚀 快速开始

### 安装主题

**方式 1：应用市场（推荐）**

1. Halo 后台 → 外观 → 主题
2. 点击右上角 "安装主题" → "从应用市场安装"
3. 搜索 "Sky Blog" 并安装

**方式 2：手动安装**

1. 从 [Releases](https://github.com/sky121666/halo-theme-sky-blog-1/releases) 下载最新版本
2. Halo 后台 → 外观 → 主题 → 安装主题
3. 上传 `.zip` 文件并启用

### 配置主题

1. 启用主题后，点击主题卡片的 "主题设置"
2. 根据需要配置各个模块（参考 [完整文档](https://5ee.net/docs/halo-theme-sky-blog-1/jianjie)）
3. 建议配置项：
   - 通用设置 → 选择主题和颜色
   - 首页设置 → 配置头部背景
   - 导航设置 → 配置菜单和 Logo

### 推荐插件

安装以下插件以获得完整体验：

- **必装**：搜索组件、评论组件
- **推荐**：瞬间、图库、友链提交、装备管理
- **可选**：Docsme 文档、朋友圈、追番、Steam、Passkey 认证

---

## 🔧 开发指南

### 环境要求

- Node.js 20+
- pnpm 8+
- Java 21+ (运行 Halo)

### 开发命令

```bash
pnpm install    # 安装依赖
pnpm dev        # 开发模式（热更新）
pnpm build      # 构建主题包
pnpm lint       # 代码检查
pnpm format     # 代码格式化
```

### 目录结构

```
theme-sky-blog-1/
├── src/              # 前端源码
│   ├── common/       # 公共资源（main.js, CSS, Alpine 组件）
│   ├── pages/        # 页面特定资源
│   └── static/       # 静态资源
├── templates/        # Halo 模板文件
│   ├── assets/       # 构建产物（自动生成）
│   └── modules/      # 模板模块
├── docs/             # 主题配置文档
├── theme.yaml        # 主题元数据
├── settings.yaml     # 后台配置表单
└── vite.config.ts    # Vite 构建配置
```

---

## 📚 文档

完整的配置文档请访问：

- **在线文档**：[https://5ee.net/docs/halo-theme-sky-blog-1/jianjie](https://5ee.net/docs/halo-theme-sky-blog-1/jianjie)
- **本地文档**：[docs/README.md](./docs/README.md)

### 主要章节

- [通用设置](./docs/general.md) - 主题、背景、侧边栏
- [首页设置](./docs/index.md) - 头部、模块、布局
- [文章页设置](./docs/article.md) - 文章展示和交互
- [瞬间设置](./docs/moments.md) - 瞬间展示和前端发布
- [插件适配](./docs/plugins.md) - 插件配置和兼容性

---

## 🐛 问题反馈

如果你遇到问题或有功能建议：

1. **GitHub Issues**：[提交 Issue](https://github.com/sky121666/halo-theme-sky-blog-1/issues)
2. **加入社群**：与其他用户交流

| 企业微信（备注进群） | QQ 群 |
|:---:|:---:|
| <img width="200" src="https://api.minio.yyds.pink/kunkunyu/files/2025/02/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250212142105-pbceif.jpg" /> | <img width="200" src="https://api.minio.yyds.pink/kunkunyu/files/2025/05/qq-708998089-iqowsh.webp" /> |

> ⚠️ 卖服务器的广告人，就不要加了。

---

## 🤝 贡献

欢迎提交 PR 和 Issue！

**贡献指南**：
- Fork 项目并创建分支
- 遵循项目代码规范（ESLint + Prettier）
- 提交前运行 `pnpm lint` 和 `pnpm format`
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)

---

## ⭐ Star History

如果这个主题对你有帮助，欢迎 Star 支持！

---

## 📄 许可证

[GPL-3.0](LICENSE)

---

## 💖 鸣谢

感谢以下开源项目：

- [Halo](https://github.com/halo-dev/halo) - 强大的博客系统
- [Tailwind CSS](https://tailwindcss.com/) - 原子化 CSS 框架
- [DaisyUI](https://daisyui.com/) - Tailwind CSS 组件库
- [Alpine.js](https://alpinejs.dev/) - 轻量级 JS 框架
- [Vite](https://vitejs.dev/) - 快速的构建工具
