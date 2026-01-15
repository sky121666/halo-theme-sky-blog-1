#!/usr/bin/env node
/**
 * DaisyUI 主题预览图生成脚本
 * 自动从本地 DaisyUI 包提取精确颜色，生成 SVG 预览图
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DaisyUI 主题目录
const DAISYUI_THEME_DIR = path.join(__dirname, '../node_modules/daisyui/theme');

// SVG 尺寸配置 (40x20 紧凑型)
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

// 深浅色主题分类（按推荐顺序）
const LIGHT_THEMES = [
  'light', 'cupcake', 'bumblebee', 'emerald', 'corporate', 
  'retro', 'cyberpunk', 'valentine', 'garden', 'lofi', 
  'pastel', 'fantasy', 'wireframe', 'cmyk', 'autumn', 
  'acid', 'lemonade', 'winter', 'nord', 'caramellatte', 'silk'
];

const DARK_THEMES = [
  'dark', 'synthwave', 'halloween', 'forest', 'aqua', 
  'black', 'luxury', 'dracula', 'business', 'night', 
  'coffee', 'dim', 'sunset', 'abyss'
];

/**
 * OKLCH 转 RGB
 * @param {number} L - Lightness (0-1)
 * @param {number} C - Chroma
 * @param {number} H - Hue (degrees)
 * @returns {Array} [r, g, b] (0-255)
 */
function oklchToRgb(L, C, H) {
  // OKLCH -> OKLab
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab -> Linear RGB
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bVal = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  // 线性 RGB -> sRGB
  const toSrgb = (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 255;
    return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255);
  };

  return [toSrgb(r), toSrgb(g), toSrgb(bVal)];
}

/**
 * RGB 转 HEX
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * 解析 OKLCH 字符串
 * @param {string} oklchStr - 如 "oklch(45% 0.24 277.023)"
 * @returns {string} HEX 颜色
 */
function parseOklch(oklchStr) {
  const match = oklchStr.match(/oklch\(([^)]+)\)/);
  if (!match) return '#888888';

  const parts = match[1].trim().split(/\s+/);
  if (parts.length < 3) return '#888888';

  // 解析 L (可能是百分比或小数)
  let L = parseFloat(parts[0]);
  if (parts[0].includes('%')) {
    L = L / 100;
  }

  const C = parseFloat(parts[1]);
  const H = parseFloat(parts[2]);

  const [r, g, b] = oklchToRgb(L, C, H);
  return rgbToHex(r, g, b);
}

/**
 * 从 CSS 文件提取主题颜色
 */
function extractColorsFromCSS(cssContent) {
  const colors = {};
  const colorVars = [
    '--color-base-100',
    '--color-primary',
    '--color-secondary',
    '--color-accent',
    '--color-neutral',
  ];

  colorVars.forEach((varName) => {
    const regex = new RegExp(`${varName.replace(/[-]/g, '[-]')}:\\s*([^;]+);`);
    const match = cssContent.match(regex);
    if (match) {
      const value = match[1].trim();
      if (value.startsWith('oklch')) {
        colors[varName] = parseOklch(value);
      } else {
        colors[varName] = value;
      }
    }
  });

  return colors;
}

/**
 * 获取所有主题名称
 */
function getThemeNames() {
  const files = fs.readdirSync(DAISYUI_THEME_DIR);
  return files.filter((f) => f.endsWith('.css') && !f.includes('index')).map((f) => f.replace('.css', ''));
}

/**
 * 判断颜色是否为浅色
 */
function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // 使用相对亮度公式
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/**
 * 生成单个主题的 SVG
 */
function generateSVG(themeName, colors) {
  const { width, height, badgeWidth, badgeHeight, gap, padding, borderRadius, outerRadius } = SVG_CONFIG;

  const bgColor = colors['--color-base-100'] || '#ffffff';
  const colorList = [
    colors['--color-primary'] || '#570df8',
    colors['--color-secondary'] || '#f000b8',
    colors['--color-accent'] || '#1ECEBC',
    colors['--color-neutral'] || '#1f2937',
  ];

  const startX = padding;
  const startY = (height - badgeHeight) / 2;

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect fill="${bgColor}" width="${width}" height="${height}" rx="${outerRadius}"/>
  ${colorList
    .map((color, i) => {
      const x = startX + i * (badgeWidth + gap);
      return `<rect x="${x}" y="${startY}" width="${badgeWidth}" height="${badgeHeight}" rx="${borderRadius}" fill="${color}"/>`;
    })
    .join('\n  ')}
</svg>`;
}

/**
 * 主函数
 */
function main() {
  const outputDir = path.join(__dirname, '../src/static/previews');

  // 创建输出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🎨 DaisyUI 主题预览图生成器\n');
  console.log(`📦 DaisyUI 主题目录: ${DAISYUI_THEME_DIR}`);
  console.log(`📁 输出目录: ${outputDir}\n`);

  // 获取所有主题
  const themeNames = getThemeNames();
  console.log(`🔍 发现 ${themeNames.length} 个主题\n`);

  let count = 0;
  const errors = [];

  themeNames.forEach((themeName) => {
    try {
      // 读取 CSS 文件
      const cssPath = path.join(DAISYUI_THEME_DIR, `${themeName}.css`);
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      // 提取颜色
      const colors = extractColorsFromCSS(cssContent);

      // 生成 SVG
      const svg = generateSVG(themeName, colors);
      const svgPath = path.join(outputDir, `${themeName}.svg`);
      fs.writeFileSync(svgPath, svg);

      count++;
      const bgColor = colors['--color-base-100'] || '?';
      console.log(`✅ ${String(count).padStart(2)} ${themeName.padEnd(14)} bg: ${bgColor}`);
    } catch (err) {
      errors.push({ theme: themeName, error: err.message });
      console.log(`❌ ${themeName}: ${err.message}`);
    }
  });

  console.log(`\n✅ 成功生成 ${count} 个主题预览图！`);

  if (errors.length > 0) {
    console.log(`\n⚠️ 有 ${errors.length} 个主题生成失败`);
  }

  console.log(`\n📊 主题分类:`);
  console.log(`   浅色主题: ${LIGHT_THEMES.length} 个`);
  console.log(`   深色主题: ${DARK_THEMES.length} 个\n`);

  // 显示尺寸信息
  console.log('📐 SVG 规格:');
  console.log(`   尺寸: ${SVG_CONFIG.width}×${SVG_CONFIG.height} px`);
  console.log(`   色块: ${SVG_CONFIG.badgeWidth}×${SVG_CONFIG.badgeHeight} px`);
  console.log(`   间距: ${SVG_CONFIG.gap} px\n`);

  console.log('💡 使用方法:');
  console.log('   1. 运行 npm run build 构建主题');
  console.log('   2. 上传主题到 Halo 查看效果\n');
}

main();
