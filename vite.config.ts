import { defineConfig } from "vite";
import { glob } from "glob";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";

/**
 * 复制静态资源到构建目录
 * 排除已通过 import 集成的文件
 */
function copyStaticAssets() {
  const srcStaticDir = 'src/static';
  const destAssetsDir = 'templates/assets';

  // 排除列表：这些文件已通过 import 集成到构建中
  const excludeFiles = new Set([
    'css/article-content.css',  // 已通过 @import 集成到各页面 CSS
    'js/article-content.js',     // 已通过 import 集成到各页面 JS
  ]);

  if (!existsSync(srcStaticDir)) {
    return;
  }

  function getRelativePath(fullPath: string, basePath: string): string {
    return fullPath.substring(basePath.length + 1);
  }

  function copyRecursive(src: string, dest: string, basePath: string = srcStaticDir) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    const items = readdirSync(src);
    items.forEach(item => {
      const srcPath = join(src, item);
      const destPath = join(dest, item);
      const relativePath = getRelativePath(srcPath, basePath);

      if (statSync(srcPath).isDirectory()) {
        copyRecursive(srcPath, destPath, basePath);
      } else {
        // 跳过 README.md 和排除列表中的文件
        if (item === 'README.md') {
          return;
        }

        if (excludeFiles.has(relativePath)) {
          console.log(`⏭️  跳过: ${relativePath} (通过构建系统处理)`);
          return;
        }

        copyFileSync(srcPath, destPath);
      }
    });
  }

  copyRecursive(srcStaticDir, destAssetsDir);
}

/**
 * 极简构建配置
 * 只处理JS入口，CSS通过JS导入处理
 */
function generateEntries() {
  const entries: Record<string, string> = {};

  // 公共资源入口
  entries['main'] = 'src/common/main.js';

  // 扫描页面JS文件
  const jsFiles = glob.sync("src/pages/**/*.js");
  jsFiles.forEach((file) => {
    const matches = file.match(/src\/pages\/([^\/]+)\/\1\.js$/);
    if (matches) {
      const pageName = matches[1];
      entries[pageName] = file;
      console.log(`📄 ${pageName}: ${file}`);
    }
  });

  // Auth 布局入口
  const authLayouts = ['default', 'split', 'centered'];
  authLayouts.forEach((layout) => {
    const jsFile = `src/pages/auth/themes/${layout}.js`;
    if (existsSync(jsFile)) {
      entries[`auth-${layout}`] = jsFile;
      console.log(`🔐 auth-${layout}: ${jsFile}`);
    }
  });

  console.log(`✅ 生成 ${Object.keys(entries).length} 个入口点`);
  return entries;
}

export default defineConfig({
  build: {
    outDir: "templates/assets",
    minify: 'esbuild',  // esbuild 压缩更快且不会产生变量名冲突
    rollupOptions: {
      input: generateEntries(),
      output: {
        format: 'es', // 使用 ES Module 格式，支持代码分割
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/chunks/[name]-[hash].js', // 共享 chunk 的命名
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            const name = assetInfo.name.replace('.css', '');
            if (name === 'main') {
              return 'css/main.css';
            }
            return `css/${name}.css`;
          }
          // 其他资源（图片、字体等）
          return "assets/[name][extname]";
        },
      },
    },
    assetsInlineLimit: 0,
  },
  plugins: [
    {
      name: 'copy-static-assets',
      closeBundle() {
        copyStaticAssets();
      }
    }
  ]
});
