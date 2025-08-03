import { defineConfig } from "vite";
import { glob } from "glob";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";

/**
 * 复制静态资源到构建目录
 * 注意：字体等静态资源已移至 templates/static 目录，不再需要复制
 */
function copyStaticAssets() {
  // 静态资源已移至 templates/static 目录，不再需要复制
  console.log('📁 静态资源已移至 templates/static 目录，跳过复制');
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
  
  console.log(`✅ 生成 ${Object.keys(entries).length} 个入口点`);
  return entries;
}

export default defineConfig({
  build: {
    outDir: "templates/assets",
    minify: 'terser',
    rollupOptions: {
      input: generateEntries(),
      output: {
        entryFileNames: 'js/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            const name = assetInfo.name.replace('.css', '');
            if (name === 'main') {
              return 'css/main.css';
            }
            return `css/${name}.css`;
          }
          return "assets/[name][extname]";
        },
        manualChunks: undefined,
      },
    },
    assetsInlineLimit: 0,
  },
  plugins: [
    // 静态资源已移至 templates/static 目录，不再需要复制插件
    // {
    //   name: 'copy-static-assets',
    //   closeBundle() {
    //     copyStaticAssets();
    //   }
    // }
  ]
});
