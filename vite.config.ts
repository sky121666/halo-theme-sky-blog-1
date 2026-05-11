import { defineConfig } from "vite";
import { glob } from "glob";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * 复制静态资源到构建目录
 */
function copyStaticAssets() {
  const srcStaticDir = "src/static";
  const destAssetsDir = "templates/assets";

  if (!existsSync(srcStaticDir)) {
    return;
  }

  function copyRecursive(src: string, dest: string) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    const items = readdirSync(src);
    items.forEach((item) => {
      const srcPath = join(src, item);
      const destPath = join(dest, item);

      if (statSync(srcPath).isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else {
        // 跳过 README.md
        if (item === "README.md") {
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
  entries["main"] = "src/common/main.js";

  // 扫描页面JS文件
  const jsFiles = glob.sync("src/pages/**/*.js");
  jsFiles.forEach((file) => {
    const normalized = normalizePath(file);
    const matches = normalized.match(/src\/pages\/([^\/]+)\/\1\.js$/);
    if (matches) {
      const pageName = matches[1];
      entries[pageName] = file;
      console.log(`📄 ${pageName}: ${file}`);
    }
  });

  // Auth 布局入口
  const authLayouts = ["default", "split", "centered"];
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

const isWatchMode = process.argv.includes("--watch");
const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));
const assetVersion = packageJson.version;

export default defineConfig({
  build: {
    outDir: "templates/assets",
    minify: "esbuild", // esbuild 压缩更快且不会产生变量名冲突
    rollupOptions: {
      input: generateEntries(),
      output: {
        format: "es", // 使用 ES Module 格式，支持代码分割
        entryFileNames: "js/[name].js",
        // 入口文件通过模板中的 ?v=version 控制缓存，分包文件名追加版本，避免新入口命中旧 chunk
        chunkFileNames: `js/chunks/[name]-${assetVersion}.js`,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            const name = assetInfo.name.replace(".css", "");
            if (name === "main") {
              return "css/main.css";
            }
            return `css/${name}.css`;
          }
          // 其他资源（图片、字体等）
          return "assets/[name][extname]";
        },
      },
    },
    assetsInlineLimit: 0,
    // watch 模式下排除输出目录，防止 closeBundle 的文件复制触发无限重建
    ...(isWatchMode ? { watch: { exclude: ["templates/assets/**"] } } : {}),
  },
  plugins: [
    {
      name: "copy-static-assets",
      closeBundle() {
        copyStaticAssets();
      },
    },
  ],
});
