---
trigger: always_on
description: Sky Blog Theme 项目开发规范 - 包含技术栈、目录结构、代码风格和开发流程规范
globs:
---

# Sky Blog Theme - 项目开发规范

## 🎯 项目定位

基于 Halo 2.0 的现代博客主题，采用 Vite + Tailwind CSS v4 + DaisyUI + Alpine.js 技术栈。

## 🏗️ 核心技术栈

### 构建与类型
- **Vite 7.0.4+**: 构建工具和开发服务器
- **TypeScript 5.8.3+**: 类型安全
- **Gradle**: 主题打包工具

### 前端框架
- **Alpine.js 3.14.9+**: 轻量级响应式框架
- **Tailwind CSS 4.1.11+**: 原子化 CSS
- **DaisyUI 5.0.46+**: UI 组件库
- **@iconify/tailwind4**: 图标系统

### 后端集成
- **Halo 2.21.3+**: 博客系统
- **Thymeleaf 3.0.12+**: 模板引擎

## 📁 目录结构

```
theme-sky-blog-1/
├── src/                          # 前端源码
│   ├── common/                   # 公共资源
│   │   ├── main.js              # 入口（包含 CSS 导入）
│   │   ├── css/                 # 公共样式
│   │   │   ├── tailwind.css     # Tailwind + DaisyUI
│   │   │   ├── base.css         # 基础样式
│   │   │   └── nav-enhancements.css
│   │   └── js/                  # 公共脚本
│   │       ├── alpine-modules.js # Alpine 组件
│   │       └── base.js          # 工具函数
│   ├── pages/                    # 页面特定资源
│   │   ├── index/               # 首页
│   │   │   ├── index.js
│   │   │   └── index.css
│   │   └── post/                # 文章页
│   │       ├── post.js
│   │       └── post.css
│   └── static/                   # 静态资源（字体、图标等）
│
├── templates/                    # Halo 模板
│   ├── assets/                  # 构建产物（自动生成）
│   ├── modules/                 # 模板模块
│   ├── index.html
│   └── post.html
│
├── docs/                         # 📝 项目文档目录（必需）
│   ├── README.md                # 项目说明文档
│   ├── CHANGELOG.md             # 版本更新日志
│   └── *.md                     # 其他项目文档
│
├── vite.config.ts               # Vite 配置
├── theme.yaml                   # Halo 主题配置
└── package.json
```

### 关键规则

1. **资源组织**
   - 公共资源 → `src/common/`
   - 页面特定资源 → `src/pages/[页面名]/`
   - 构建产物 → `templates/assets/`（自动生成，不手动修改）

2. **入口点规则**
   - 公共入口：`src/common/main.js` → `templates/assets/js/main.js` + `templates/assets/css/main.css`
   - 页面入口：`src/pages/*/[页面名].js` → `templates/assets/{js,css}/[页面名].{js,css}`
   - 每个页面 JS 需导入对应 CSS：`import './页面名.css'`

3. **📝 文档存放规则（强制）**
   - ✅ **所有 Markdown 文档必须放在 `docs/` 目录下**
   - ✅ **禁止在项目根目录或其他位置创建 `.md` 文件**（`README.md` 除外）
   - ✅ **文档命名使用 `kebab-case`**，如 `api-guide.md`、`deployment.md`
   - ✅ **包括但不限于**：
     - 开发文档
     - API 文档
     - 部署文档
     - 设计文档
     - 任务记录
     - 更新日志
   - ❌ **违规示例**：
     - ❌ `./todo.md` → 应改为 `docs/todo.md`
     - ❌ `src/api-doc.md` → 应改为 `docs/api-doc.md`
     - ❌ `templates/design.md` → 应改为 `docs/design.md`
   - ⚠️ **注意**：除非用户明确要求，否则不要自动创建说明文档、更新日志等文件
   - ⚠️ **禁止**：每次完成功能后，不要自动创建更新说明、实现总结等文档

## 🎨 Alpine.js 开发规范

### 组件定义位置
- **公共组件**: `src/common/js/alpine-modules.js`
- **页面组件**: `src/pages/*/[页面名].js`

### 现有公共组件
```javascript
// 已实现的组件（与模板对应）
themeToggle        // 主题切换 (templates/modules/nav.html)
backToTop          // 回到顶部 (templates/modules/footer.html)  
headerController   // 首页头部 (templates/modules/index/header.html)
```

### 开发原则
- ✅ **按需开发**: 只实现模板实际使用的功能
- ✅ **功能单一**: 每个组件职责明确
- ✅ **先检测后开发**: 用 `grep -r "x-data\|@click" templates/` 确认使用情况

## 🖌️ 代码风格规范

### JavaScript/TypeScript
```javascript
/**
 * 组件描述
 * 模板位置：templates/modules/xxx.html
 */
function createComponent() {
  return {
    // 使用 ES6+ 语法
    init() { },
    handleEvent() { }
  };
}
```

- 使用 ESLint + Prettier 自动格式化
- 文件名：`kebab-case`（如 `alpine-modules.js`）
- 添加 JSDoc 注释，标注模板使用位置

### HTML/Thymeleaf
```html
<!-- 语义化标签 -->
<article class="prose">
  <!-- Thymeleaf 片段 -->
  <div th:fragment="post-content">
    <!-- 内容 -->
  </div>
</article>
```

- 使用语义化标签：`<header>`, `<main>`, `<article>`, `<footer>`
- Thymeleaf 片段命名：`kebab-case`
- 缩进：2 空格

### CSS/Tailwind
```css
/* 优先使用 Tailwind 原子类 */
/* 自定义样式使用 BEM 命名 */
.block__element--modifier { }
```

- 优先级：Tailwind 原子类 > DaisyUI 组件 > 自定义 CSS
- 自定义样式：BEM 命名规范
- 公共样式 → `src/common/css/`
- 页面样式 → `src/pages/[页面名]/`

### Markdown 文档
```markdown
# 文档标题

## 章节标题

### 小节标题

- 列表项 1
- 列表项 2

**强调文本** 和 *斜体文本*

`代码片段`
```

- **强制要求**：所有 `.md` 文件必须放在 `docs/` 目录下
- 文件命名：`kebab-case`（如 `api-guide.md`）
- 使用中文标点符号（中文文档）
- 代码块必须指定语言：````markdown```javascript````
- 缩进：2 空格（列表）

## 🔧 构建与开发

### 开发命令
```bash
npm run dev      # 开发服务器 + 热更新
npm run build    # 构建主题包 → dist/theme-sky-blog-1-*.zip
npm run lint     # ESLint 检查
npm run prettier # 代码格式化
```

### 新增页面流程
1. 创建 `src/pages/[页面名]/` 目录
2. 创建 `[页面名].js` 和 `[页面名].css`
3. 在 JS 中导入 CSS: `import './[页面名].css'`
4. 运行 `npm run build` 自动构建

### 构建产物
```
src/common/main.js → templates/assets/js/main.js (46KB)
                  → templates/assets/css/main.css (271KB)
src/pages/index/* → templates/assets/{js,css}/index.{js,css}
src/pages/post/*  → templates/assets/{js,css}/post.{js,css}
```

## 📦 Git 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<类型>(<范围>): <描述>

feat(post): 添加代码高亮功能
fix(nav): 修复移动端菜单显示问题
refactor(alpine): 重构主题切换组件
```

### 类型说明
- `feat`: 新功能
- `fix`: 缺陷修复
- `refactor`: 代码重构
- `style`: 代码风格调整
- `perf`: 性能优化
- `docs`: 文档更新
- `build`: 构建系统相关
- `chore`: 其他修改

## 🎯 性能目标

- 首屏加载 < 2s
- 完全加载 < 3s
- JavaScript < 100ms
- CSS 解析 < 50ms

### 优化策略
- 代码分割（公共 vs 页面）
- 按需加载
- 资源压缩（自动）
- 合理缓存

## 🐛 常见问题

| 问题 | 排查方法 |
|------|---------|
| 构建失败 | 检查 Node.js 版本 (20+) 和依赖安装 |
| 样式不生效 | 确认 CSS 已在对应 JS 中导入 |
| 组件不工作 | 检查 Alpine 组件是否在 `alpine-modules.js` 中注册 |
| 模板报错 | 确认模板使用的组件已定义 |

### 调试命令
```bash
# 检测 Alpine 组件使用情况
grep -r "x-data\|@click\|Alpine" templates/

# 检测特定组件
grep -r "themeToggle\|backToTop" templates/

# 查看构建日志
npm run build -- --debug
```

## 📚 环境要求

- **Java**: 21+ (Halo 运行环境)
- **Node.js**: 20+ (前端开发)
- **npm**: 10+ (包管理)
- **Halo**: 2.21+ (博客系统)

## 🔗 相关文档

- [Halo 文档](https://docs.halo.run/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [DaisyUI 5](https://daisyui.com/) - 参考 `daisyui.mdc` 规则
- [Alpine.js](https://alpinejs.dev/)
- [Vite](https://vitejs.dev/)
