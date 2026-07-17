#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const logicalEntries = [
  "main",
  "about",
  "archives",
  "author",
  "bangumi",
  "categories",
  "doc",
  "douban",
  "equipment",
  "index",
  "links",
  "moments",
  "page",
  "photos",
  "post",
  "steam",
  "auth-default",
  "auth-split",
  "auth-centered",
];

const logicalChunks = [
  "article-content",
  "auth-common",
  "debug",
  "page-runtime",
  "toc-utils",
];

const copiedTopLevelCss = [
  "index-effects.css",
  "index-subtitle-effects.css",
  "index-title-effects.css",
  "index-weather-effects.css",
];

const failures = [];

function absolutePath(relativePath) {
  return path.join(rootDir, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(absolutePath(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(absolutePath(relativePath), "utf8");
}

function walk(relativeDir) {
  const baseDir = absolutePath(relativeDir);
  if (!fs.existsSync(baseDir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

function recordMissing(relativePath, label) {
  if (!exists(relativePath)) {
    failures.push(`${label}不存在：${relativePath}`);
  }
}

function relativeToRoot(targetPath) {
  return path.relative(rootDir, targetPath).split(path.sep).join("/");
}

function loadVersions() {
  let packageVersion;
  let themeVersion;

  try {
    packageVersion = JSON.parse(read("package.json")).version;
    if (!packageVersion || typeof packageVersion !== "string") {
      failures.push("package.json 缺少有效的 version");
      packageVersion = undefined;
    }
  } catch (error) {
    failures.push(`无法读取 package.json 版本：${error.message}`);
  }

  try {
    const match = read("theme.yaml").match(/^\s{2}version:\s*["']?([^\s"'#]+)["']?\s*(?:#.*)?$/m);
    if (match) {
      themeVersion = match[1];
    } else {
      failures.push("theme.yaml 的 spec.version 不存在或格式无效");
    }
  } catch (error) {
    failures.push(`无法读取 theme.yaml 版本：${error.message}`);
  }

  if (packageVersion && themeVersion && packageVersion !== themeVersion) {
    failures.push(`版本不一致：package.json=${packageVersion}，theme.yaml=${themeVersion}`);
  }

  return { packageVersion, themeVersion };
}

function verifyEntries() {
  for (const entry of logicalEntries) {
    recordMissing(`templates/assets/js/${entry}.js`, `入口 JS ${entry}`);
    recordMissing(`templates/assets/css/${entry}.css`, `入口 CSS ${entry}`);
  }

  const allowedTopLevelJs = new Set(logicalEntries.map((entry) => `${entry}.js`));
  const topLevelJsDir = absolutePath("templates/assets/js");
  if (fs.existsSync(topLevelJsDir)) {
    for (const entry of fs.readdirSync(topLevelJsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".js") && !allowedTopLevelJs.has(entry.name)) {
        failures.push(`发现未登记的顶层 JS 产物：templates/assets/js/${entry.name}`);
      }
    }
  }

  const allowedTopLevelCss = new Set([
    ...logicalEntries.map((entry) => `${entry}.css`),
    ...copiedTopLevelCss,
  ]);
  const topLevelCssDir = absolutePath("templates/assets/css");
  if (fs.existsSync(topLevelCssDir)) {
    for (const entry of fs.readdirSync(topLevelCssDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".css") && !allowedTopLevelCss.has(entry.name)) {
        failures.push(`发现未登记的顶层 CSS 产物：templates/assets/css/${entry.name}`);
      }
    }
  }
}

function verifyChunks(packageVersion) {
  const chunkDir = "templates/assets/js/chunks";
  const actualChunks = walk(chunkDir)
    .filter((file) => path.extname(file) === ".js")
    .map((file) => path.basename(file));

  if (!packageVersion) return { expectedChunkFiles: [], actualChunks };

  const expectedChunkNames = logicalChunks.map((chunk) => `${chunk}-${packageVersion}.js`);
  const expectedChunkSet = new Set(expectedChunkNames);

  for (const chunkName of expectedChunkNames) {
    recordMissing(`${chunkDir}/${chunkName}`, `版本化 chunk ${chunkName}`);
  }

  for (const chunkName of actualChunks) {
    if (!expectedChunkSet.has(chunkName)) {
      failures.push(`发现旧版本或未允许的 chunk：${chunkDir}/${chunkName}`);
    }
  }

  return {
    expectedChunkFiles: expectedChunkNames.map((name) => `${chunkDir}/${name}`),
    actualChunks,
  };
}

function collectTemplateAssetReferences() {
  const references = new Map();
  const templateFiles = walk("templates").filter(
    (file) => file.endsWith(".html") && !file.startsWith("templates/assets/"),
  );
  const assetPattern = /\/assets\/[A-Za-z0-9_./-]+/g;

  for (const templateFile of templateFiles) {
    const source = read(templateFile);
    for (const match of source.matchAll(assetPattern)) {
      const previousCharacter = match.index > 0 ? source[match.index - 1] : "";
      if (/[A-Za-z0-9_.-]/.test(previousCharacter)) continue;

      const assetPath = match[0];
      if (!path.posix.extname(assetPath)) continue;

      const target = `templates${assetPath}`;
      if (!references.has(target)) references.set(target, new Set());
      references.get(target).add(templateFile);
    }
  }

  for (const [target, sourceFiles] of references) {
    if (!exists(target)) {
      failures.push(
        `模板静态资源不存在：${target}（引用自 ${[...sourceFiles].join("、")}）`,
      );
    }
  }

  return references;
}

function verifyRelativeChunkImports(expectedChunkFiles) {
  const entryFiles = logicalEntries.map((entry) => `templates/assets/js/${entry}.js`);
  const filesToScan = [...entryFiles, ...expectedChunkFiles].filter(exists);
  const jsRoot = absolutePath("templates/assets/js");
  const expectedChunkSet = new Set(expectedChunkFiles);
  const chunkReferenceCounts = new Map(expectedChunkFiles.map((file) => [file, 0]));
  let referenceCount = 0;

  for (const sourceFile of filesToScan) {
    const source = read(sourceFile);
    const importPattern = /["'](\.{1,2}\/[^"'?#]+\.js)(?:\?[^"']*)?["']/g;
    for (const match of source.matchAll(importPattern)) {
      referenceCount += 1;
      const resolvedPath = path.resolve(path.dirname(absolutePath(sourceFile)), match[1]);
      const target = relativeToRoot(resolvedPath);

      if (resolvedPath !== jsRoot && !resolvedPath.startsWith(`${jsRoot}${path.sep}`)) {
        failures.push(`JS 相对导入越出构建目录：${sourceFile} -> ${match[1]}`);
        continue;
      }

      if (!fs.existsSync(resolvedPath)) {
        failures.push(`JS 相对 chunk 导入不存在：${sourceFile} -> ${match[1]}`);
        continue;
      }

      if (expectedChunkSet.has(target)) {
        chunkReferenceCounts.set(target, (chunkReferenceCounts.get(target) ?? 0) + 1);
      }
    }
  }

  for (const [chunkFile, count] of chunkReferenceCounts) {
    if (exists(chunkFile) && count === 0) {
      failures.push(`版本化 chunk 未被入口或其他 chunk 引用：${chunkFile}`);
    }
  }

  return referenceCount;
}

function verifyNoSourceMaps() {
  const assetFiles = walk("templates/assets");
  for (const assetFile of assetFiles) {
    if (assetFile.endsWith(".map")) {
      failures.push(`发现 sourcemap 文件：${assetFile}`);
      continue;
    }

    if (!/\.(?:js|css|html)$/.test(assetFile)) continue;
    const source = read(assetFile);
    if (/sourceMappingURL\s*=/.test(source)) {
      failures.push(`发现 sourceMappingURL：${assetFile}`);
    }
  }
}

function verifyCacheContracts(packageVersion) {
  const templateFiles = walk("templates").filter(
    (file) => file.endsWith(".html") && !file.startsWith("templates/assets/"),
  );

  for (const templateFile of templateFiles) {
    const lines = read(templateFile).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/[@][{]\/assets\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+/.test(line) && !line.includes("?v=")) {
        failures.push(`模板静态资源缺少主题版本缓存参数：${templateFile}:${index + 1}`);
      }
    });
  }

  const qrcodeSource = read("src/static/qrcode/qrcode-share.html");
  if (!qrcodeSource.includes("qrcode.min.js?v=__THEME_ASSET_VERSION__")) {
    failures.push("二维码源码未使用主题版本占位符加载 qrcode.min.js");
  }

  const builtQrcode = "templates/assets/qrcode/qrcode-share.html";
  if (exists(builtQrcode)) {
    const builtSource = read(builtQrcode);
    if (builtSource.includes("__THEME_ASSET_VERSION__")) {
      failures.push("二维码构建产物仍包含未替换的主题版本占位符");
    }
    if (packageVersion && !builtSource.includes(`qrcode.min.js?v=${packageVersion}`)) {
      failures.push(`二维码子资源版本与主题不一致：期望 ${packageVersion}`);
    }
  }
}

function printReport(packageVersion, templateReferenceCount, jsReferenceCount) {
  if (failures.length > 0) {
    console.error(`构建产物验证失败（${failures.length} 项）：`);
    for (const failure of failures) console.error(`- ${failure}`);
  } else {
    console.log(
      `构建产物验证通过：${logicalEntries.length} 个入口及 CSS、${logicalChunks.length} 个版本化 chunk（${packageVersion}）。`,
    );
    console.log(
      `已校验 ${templateReferenceCount} 个模板静态资源、${jsReferenceCount} 个 JS 相对导入；无旧 chunk、sourcemap 或 sourceMappingURL。`,
    );
  }

}

const { packageVersion } = loadVersions();
verifyEntries();
const { expectedChunkFiles } = verifyChunks(packageVersion);
const templateAssetReferences = collectTemplateAssetReferences();
const jsReferenceCount = verifyRelativeChunkImports(expectedChunkFiles);
verifyNoSourceMaps();
verifyCacheContracts(packageVersion);
printReport(packageVersion ?? "未知版本", templateAssetReferences.size, jsReferenceCount);

process.exitCode = failures.length === 0 ? 0 : 1;
