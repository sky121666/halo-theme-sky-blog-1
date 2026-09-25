# DaisyUI 主题预览图生成脚本

## 📋 功能说明

自动从本地 DaisyUI 包提取精确配色，生成所有 35 个内置主题的 SVG 预览图。

## 🎨 生成的主题

包含以下 35 个主题的配色方案：

**浅色系**: light, cupcake, emerald, corporate, retro, pastel, fantasy, wireframe, lemonade, winter, sunset, caramellatte, silk

**深色系**: dark, synthwave, halloween, forest, aqua, luxury, dracula, business, night, coffee, dim, nord, abyss

**特色系**: bumblebee, cyberpunk, valentine, garden, lofi, black, cmyk, autumn, acid

## 🚀 使用方法

### 1. 生成预览图

```bash
node scripts/generate-theme-previews.js
```

这将：
- 从 `node_modules/daisyui/theme/*.css` 读取精确 OKLCH 配色
- 转换为 HEX 并在 `src/static/previews/` 生成 35 个 SVG 文件

### 2. 构建主题

```bash
pnpm run build
```

这将：
- 复制 SVG 到 `templates/assets/previews/`
- 打包到 `dist/theme-sky-blog-1-*.zip`

### 3. 配置说明

主题配置已集成到 `settings.yaml` 中，按深浅色分组排列：

```yaml
settings.yaml
  └─ general (通用全局)
      └─ daisyui_theme_selector (🎨 DaisyUI 主题风格)
          └─ daisyui_theme (主题风格预览)
              ├─ 浅色主题 (21个): light, cupcake, bumblebee...
              └─ 深色主题 (14个): dark, synthwave, halloween...
```

## 📏 SVG 规格

- **尺寸**: 40×20 px（紧凑型，一行可显示 6-7 个）
- **文件大小**: 约 392 字节/个
- **总大小**: 约 14 KB (35 个文件)
- **背景圆角**: 4px
- **配色按钮**: 4 个（primary, secondary, accent, neutral）
- **按钮尺寸**: 7×12 px
- **按钮圆角**: 2px
- **按钮间距**: 2px

## 🎯 预览效果

每个主题 SVG 包含：
- **主题背景色**: 代表该主题的基础背景 (base-100)
- **4 个配色方块**: 简洁的圆角矩形，展示主要配色
  - 方块 1: Primary（主色）
  - 方块 2: Secondary（辅助色）
  - 方块 3: Accent（强调色）
  - 方块 4: Neutral（中性色）

## 🔧 自定义修改

如需修改 SVG 样式，编辑 `scripts/generate-theme-previews.js` 中的 `SVG_CONFIG`：

```javascript
const SVG_CONFIG = {
  width: 40,
  height: 20,
  badgeWidth: 7,
  badgeHeight: 12,
  gap: 2,
  padding: 3,
  borderRadius: 2,
  outerRadius: 4,
};
```

修改后重新运行生成脚本即可。

## 📦 配色数据来源

颜色自动从本地 DaisyUI 包提取：
- 路径: `node_modules/daisyui/theme/*.css`
- 格式: OKLCH → 自动转换为 HEX
- 更新 DaisyUI 版本后重新运行脚本即可获取最新配色

## ⚠️ 注意事项

1. **不要手动修改** `src/static/previews/` 和 `templates/assets/previews/` 中的 SVG 文件
2. **修改后必须重新构建**: 运行 `pnpm run build`
3. **主题包大小**: 添加 35 个 SVG 后，主题包增加约 14 KB
4. **配色准确性**: 颜色直接从 DaisyUI 源文件提取，确保 100% 准确

## 🐛 故障排除

### SVG 不显示

1. 检查构建是否成功：`pnpm run build`
2. 检查文件是否存在：`ls templates/assets/previews/`
3. 检查 zip 包内容：`unzip -l dist/theme-*.zip | grep previews`

### YAML 配置错误

运行语法检查：
```bash
ruby -ryaml -e "YAML.load_file('settings.yaml'); puts 'YAML OK'"
```

## 📝 更新日志

- **2026-01-15 v3**: 紧凑型优化版本
  - ✅ 尺寸优化：从 80×36 缩小到 40×20（一行 6-7 个）
  - ✅ 配色来源：自动从本地 DaisyUI 包提取 OKLCH 颜色
  - ✅ 转换准确：OKLCH → HEX 精确转换
  - ✅ 文件大小：约 392 字节/个（优化 60%）

- **2026-01-15 v2**: 按钮风格版本
  - 尺寸：80×36 px
  - 带 "A" 文字的按钮样式

- **2026-01-15 v1**: 初始版本
  - 基础圆点样式，100×50 px
