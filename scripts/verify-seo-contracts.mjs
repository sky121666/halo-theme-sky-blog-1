#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const seoHeadFile = "templates/modules/seo-head.html";
const gatewayLayout = "templates/gateway_fragments/layout.html";
const docsLayout = "templates/modules/doc-layout.html";

const expectedLayouts = [
  gatewayLayout,
  "templates/modules/about/layout.html",
  "templates/modules/archives/layout.html",
  "templates/modules/author/layout.html",
  "templates/modules/bangumi/layout.html",
  "templates/modules/categories/layout.html",
  docsLayout,
  "templates/modules/douban/layout.html",
  "templates/modules/equipments/layout.html",
  "templates/modules/friends/layout.html",
  "templates/modules/index/layout.html",
  "templates/modules/links/layout.html",
  "templates/modules/moments/layout.html",
  "templates/modules/page/layout.html",
  "templates/modules/photos/layout.html",
  "templates/modules/post/layout.html",
  "templates/modules/steam/layout.html",
  "templates/modules/tags/layout.html",
];

const authPages = [
  "templates/login.html",
  "templates/logout.html",
  "templates/signup.html",
  "templates/password-reset/email/reset.html",
  "templates/password-reset/email/send.html",
];

const noindexPages = [gatewayLayout, "templates/error/error.html", "templates/maintenance.html"];

const contentFragmentsWithoutMain = [
  "templates/modules/about/content.html",
  "templates/modules/archives/content.html",
  "templates/modules/author/content.html",
  "templates/modules/bangumi/content.html",
  "templates/modules/categories/content.html",
  "templates/modules/douban/content.html",
  "templates/modules/equipments/content.html",
  "templates/modules/friends/content.html",
  "templates/modules/index/content.html",
  "templates/modules/links/content.html",
  "templates/modules/moments/content.html",
  "templates/modules/moments/detail.html",
  "templates/modules/page/content.html",
  "templates/modules/photos/content.html",
  "templates/modules/photos/detail.html",
  "templates/modules/post/content.html",
  "templates/modules/steam/content.html",
  "templates/modules/tags/content.html",
];

const headingMinimums = new Map([
  ["templates/modules/about/content.html", 1],
  ["templates/modules/archives/content.html", 1],
  ["templates/modules/author/content.html", 1],
  ["templates/modules/bangumi/content.html", 1],
  ["templates/modules/docs-content.html", 1],
  ["templates/modules/doc-content.html", 1],
  ["templates/modules/doc-catalog-content.html", 1],
  ["templates/modules/douban/content.html", 1],
  ["templates/modules/equipments/content.html", 1],
  ["templates/modules/equipments/style-simple.html", 1],
  ["templates/modules/equipments/style-tech.html", 1],
  ["templates/modules/friends/content.html", 1],
  ["templates/modules/index/layout.html", 1],
  ["templates/modules/index/header/title.html", 1],
  ["templates/modules/links/content.html", 1],
  ["templates/modules/moments/content.html", 1],
  ["templates/modules/moments/detail.html", 1],
  ["templates/modules/page/content.html", 1],
  ["templates/modules/photos/content.html", 1],
  ["templates/modules/photos/detail.html", 1],
  ["templates/modules/post/header.html", 1],
  ["templates/modules/steam/content.html", 1],
  ["templates/login.html", 1],
  ["templates/logout.html", 1],
  ["templates/signup.html", 1],
  ["templates/password-reset/email/reset.html", 1],
  ["templates/password-reset/email/send.html", 2],
  ["templates/error/error.html", 1],
  ["templates/maintenance.html", 1],
]);

const headingFragments = new Map([
  [
    "templates/modules/categories/content.html",
    [
      "category-collection",
      "category-archive",
      "category-archive-card",
      "category-archive-list",
      "category-archive-magazine",
      "category-archive-minimal",
    ],
  ],
  ["templates/modules/tags/content.html", ["tag-collection", "tag-archive"]],
]);

const failures = [];
const failureSet = new Set();
const stats = {
  headings: 0,
  images: 0,
  layouts: 0,
  paginationAnchors: 0,
};

function fail(message) {
  if (failureSet.has(message)) return;
  failureSet.add(message);
  failures.push(message);
}

function printUsage() {
  console.log(`用法：
  node scripts/verify-seo-contracts.mjs
  node scripts/verify-seo-contracts.mjs --archive
  node scripts/verify-seo-contracts.mjs --archive=dist/theme-name-version.zip`);
}

function parseArguments(args) {
  let archive;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { help: true };

    if (argument === "--archive") {
      if (archive !== undefined) {
        fail("命令行参数 --archive 不能重复");
        continue;
      }

      const candidate = args[index + 1];
      if (candidate && !candidate.startsWith("-")) {
        archive = candidate;
        index += 1;
      } else {
        archive = true;
      }
      continue;
    }

    if (argument.startsWith("--archive=")) {
      if (archive !== undefined) {
        fail("命令行参数 --archive 不能重复");
        continue;
      }
      archive = argument.slice("--archive=".length);
      if (!archive) fail("--archive= 后必须提供 zip 路径");
      continue;
    }

    fail(`未知命令行参数：${argument}`);
  }

  return { archive, help: false };
}

function normalizePath(file) {
  return file.replaceAll(path.sep, "/").replace(/^\.\//, "");
}

function walkDirectory(relativeDirectory) {
  const absoluteDirectory = path.join(rootDir, relativeDirectory);
  if (!fs.existsSync(absoluteDirectory)) return [];

  const files = [];
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

function createSourceReader() {
  const files = walkDirectory("templates");
  return {
    files,
    has(file) {
      return fs.existsSync(path.join(rootDir, file));
    },
    label: "工作树",
    read(file) {
      return fs.readFileSync(path.join(rootDir, file), "utf8");
    },
  };
}

function parseThemeIdentity() {
  const source = fs.readFileSync(path.join(rootDir, "theme.yaml"), "utf8");
  const metadataStart = source.search(/^metadata:\s*$/m);
  const specStart = source.search(/^spec:\s*$/m);
  if (metadataStart === -1 || specStart === -1 || metadataStart > specStart) {
    throw new Error("theme.yaml 缺少 metadata/spec");
  }

  const metadata = source.slice(metadataStart, specStart);
  const spec = source.slice(specStart);
  const name = metadata.match(/^\s{2}name:\s*["']?([^\s"'#]+)["']?\s*(?:#.*)?$/m)?.[1];
  const version = spec.match(/^\s{2}version:\s*["']?([^\s"'#]+)["']?\s*(?:#.*)?$/m)?.[1];
  if (!name || !version) throw new Error("theme.yaml 缺少有效的 metadata.name/spec.version");
  return { name, version };
}

function defaultArchivePath() {
  const { name, version } = parseThemeIdentity();
  return path.join(rootDir, "dist", `${name}-${version}.zip`);
}

function unzip(args, options = {}) {
  try {
    return execFileSync("unzip", args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("系统缺少 unzip 命令", { cause: error });
    }
    const detail = String(error.stderr || error.message || "unzip 执行失败").trim();
    throw new Error(detail, { cause: error });
  }
}

function createArchiveReader(requestedPath) {
  const archivePath = requestedPath ? path.resolve(rootDir, requestedPath) : defaultArchivePath();
  if (!fs.existsSync(archivePath)) {
    throw new Error(`归档不存在：${normalizePath(path.relative(rootDir, archivePath))}`);
  }
  if (!fs.statSync(archivePath).isFile()) {
    throw new Error(`归档路径不是文件：${normalizePath(path.relative(rootDir, archivePath))}`);
  }

  unzip(["-tqq", archivePath]);
  const listed = unzip(["-Z1", archivePath]).split(/\r?\n/).map(normalizePath).filter(Boolean);
  const counts = new Map();
  for (const entry of listed) counts.set(entry, (counts.get(entry) ?? 0) + 1);
  const duplicates = [...counts].filter(([, count]) => count > 1).map(([entry]) => entry);
  if (duplicates.length > 0) {
    throw new Error(`归档包含重复成员：${duplicates.join("、")}`);
  }

  const entries = new Set(listed);
  const cache = new Map();
  return {
    files: listed.filter((entry) => !entry.endsWith("/")),
    has(file) {
      return entries.has(file);
    },
    label: `归档 ${normalizePath(path.relative(rootDir, archivePath))}`,
    read(file) {
      if (cache.has(file)) return cache.get(file);
      if (!entries.has(file)) throw new Error(`归档成员不存在：${file}`);
      const source = unzip(["-p", archivePath, file]);
      cache.set(file, source);
      return source;
    },
  };
}

function createContext(reader) {
  const cache = new Map();

  return {
    files: reader.files,
    label: reader.label,
    read(file) {
      if (cache.has(file)) return cache.get(file);
      if (!reader.has(file)) {
        fail(`文件不存在：${file}`);
        cache.set(file, null);
        return null;
      }

      try {
        const source = reader.read(file);
        cache.set(file, source);
        return source;
      } catch (error) {
        fail(`无法读取 ${file}：${error.message}`);
        cache.set(file, null);
        return null;
      }
    },
  };
}

function maskHtmlComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\r\n]/g, " "));
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function findStartTags(source, tagName) {
  const masked = maskHtmlComments(source);
  const pattern = new RegExp(`<${tagName}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, "gi");
  return [...masked.matchAll(pattern)].map((match) => ({
    index: match.index,
    tag: match[0],
  }));
}

function attributeValue(tag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function boundAttributeValue(tag, name) {
  for (const candidate of [name, `th:${name}`, `x-bind:${name}`, `:${name}`]) {
    const value = attributeValue(tag, candidate);
    if (value !== undefined) return value;
  }
  return undefined;
}

function countPattern(source, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...source.matchAll(new RegExp(pattern.source, flags))].length;
}

function extractHead(source, file) {
  const masked = maskHtmlComments(source);
  const start = masked.search(/<head\b/i);
  if (start === -1) {
    fail(`${file}：缺少 <head>`);
    return null;
  }

  const endStart = masked.toLowerCase().indexOf("</head>", start);
  if (endStart === -1) {
    fail(`${file}：缺少 </head>`);
    return null;
  }
  return { index: start, source: masked.slice(start, endStart + "</head>".length) };
}

function isLayoutCandidate(file) {
  return file === gatewayLayout || file === docsLayout || /^templates\/modules\/[^/]+\/layout\.html$/.test(file);
}

function verifySharedSeoHead(context) {
  const source = context.read(seoHeadFile);
  if (source === null) return;
  const masked = maskHtmlComments(source);

  if (
    !/th:fragment\s*=\s*["']meta\s*\(\s*title\s*,\s*description\s*,\s*canonical\s*,\s*image\s*,\s*type\s*\)["']/i.test(
      masked,
    )
  ) {
    fail(`${seoHeadFile}：缺少 meta(title, description, canonical, image, type) 片段`);
  }

  const titleTags = findStartTags(masked, "title");
  if (titleTags.length !== 1) {
    fail(`${seoHeadFile}：应恰好拥有 1 个 <title>，实际 ${titleTags.length} 个`);
  }

  if (!/pluginFinder\.available\(\s*["']seo-tools["']\s*\)/.test(masked)) {
    fail(`${seoHeadFile}：缺少 seo-tools 可用性门控`);
  }

  const fallbackMatch = /th:unless\s*=\s*["']\$\{seoPluginAvailable\}["']/i.exec(masked);
  if (!fallbackMatch) fail(`${seoHeadFile}：主题 SEO 降级输出必须由 seoPluginAvailable 的反向条件门控`);

  const canonicalTags = findStartTags(masked, "link").filter((entry) =>
    (boundAttributeValue(entry.tag, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"),
  );
  if (canonicalTags.length !== 1) {
    fail(`${seoHeadFile}：降级 canonical 应恰好 1 个，实际 ${canonicalTags.length} 个`);
  }

  const ogTags = findStartTags(masked, "meta").filter((entry) =>
    (boundAttributeValue(entry.tag, "property") ?? "").toLowerCase().startsWith("og:"),
  );
  for (const property of ["og:url", "og:site_name", "og:title", "og:type", "og:description", "og:image"]) {
    if (!ogTags.some((entry) => boundAttributeValue(entry.tag, "property")?.toLowerCase() === property)) {
      fail(`${seoHeadFile}：缺少 ${property} 降级元数据`);
    }
  }

  const jsonLdTags = findStartTags(masked, "script").filter(
    (entry) => boundAttributeValue(entry.tag, "type")?.toLowerCase() === "application/ld+json",
  );
  if (jsonLdTags.length !== 1) {
    fail(`${seoHeadFile}：JSON-LD 降级脚本应恰好 1 个，实际 ${jsonLdTags.length} 个`);
  }

  if (fallbackMatch) {
    const feedIndex = masked.search(/pluginFinder\.available\(\s*["']PluginFeed["']/);
    const fallbackEnd = feedIndex === -1 ? masked.length : feedIndex;
    for (const entry of [...canonicalTags, ...ogTags, ...jsonLdTags]) {
      if (entry.index < fallbackMatch.index || entry.index > fallbackEnd) {
        fail(`${seoHeadFile}:${lineNumber(masked, entry.index)}：canonical/OG/JSON-LD 必须位于 SEO 插件缺失降级块内`);
      }
    }
  }
}

function verifyLayouts(context, htmlSources) {
  const discovered = [];
  for (const [file, source] of htmlSources) {
    if (isLayoutCandidate(file) && /<head\b/i.test(maskHtmlComments(source))) discovered.push(file);
  }
  discovered.sort();

  const expected = [...expectedLayouts].sort();
  stats.layouts = discovered.length;
  if (expectedLayouts.length !== 18) {
    fail(`脚本内部布局清单应为 18 个，实际 ${expectedLayouts.length} 个`);
  }
  if (discovered.length !== 18) {
    fail(`真实 head 布局应为 18 个，实际 ${discovered.length} 个`);
  }
  for (const file of expected.filter((file) => !discovered.includes(file))) {
    fail(`真实 head 布局缺失：${file}`);
  }
  for (const file of discovered.filter((file) => !expected.includes(file))) {
    fail(`发现未登记的真实 head 布局：${file}`);
  }

  const seoIncludePattern = /modules\/seo-head\s*::\s*meta\s*\(/g;
  for (const file of expectedLayouts) {
    const source = context.read(file);
    if (source === null) continue;
    const masked = maskHtmlComments(source);
    const head = extractHead(masked, file);
    if (!head) continue;

    const totalIncludes = countPattern(masked, seoIncludePattern);
    const headIncludes = countPattern(head.source, seoIncludePattern);
    if (totalIncludes !== 1) {
      fail(`${file}：seo-head 接入应恰好 1 次，实际 ${totalIncludes} 次`);
    } else if (headIncludes !== 1) {
      fail(`${file}：唯一 seo-head 接入必须位于 <head> 内`);
    }

    const localTitles = findStartTags(head.source, "title");
    for (const entry of localTitles) {
      fail(`${file}:${lineNumber(masked, head.index + entry.index)}：布局 head 禁止本地 <title>`);
    }

    const localCanonicals = findStartTags(head.source, "link").filter((entry) =>
      (boundAttributeValue(entry.tag, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"),
    );
    for (const entry of localCanonicals) {
      fail(`${file}:${lineNumber(masked, head.index + entry.index)}：布局 head 禁止本地 canonical`);
    }

    const localOpenGraph = findStartTags(head.source, "meta").filter((entry) =>
      (boundAttributeValue(entry.tag, "property") ?? "").toLowerCase().startsWith("og:"),
    );
    for (const entry of localOpenGraph) {
      fail(`${file}:${lineNumber(masked, head.index + entry.index)}：布局 head 禁止本地 Open Graph 元数据`);
    }
  }
}

function verifyTemplateIds(context) {
  for (const [file, templateId] of [
    ["templates/modules/moments/layout.html", "moment"],
    ["templates/modules/photos/layout.html", "photo"],
  ]) {
    const source = context.read(file);
    if (source === null) continue;
    const masked = maskHtmlComments(source);
    const expected = new RegExp(`isDetail\\s*=\\s*\\$\\{_templateId\\s*==\\s*["']${templateId}["']\\}`);
    if (!expected.test(masked)) {
      fail(`${file}：详情判定必须使用 _templateId == '${templateId}'`);
    }
    if (/(^|[^A-Za-z0-9_])templateId\b/.test(masked)) {
      fail(`${file}：禁止使用旧模板变量 templateId，请使用 _templateId`);
    }
  }
}

function verifyNoindex(context) {
  for (const file of noindexPages) {
    const source = context.read(file);
    if (source === null) continue;
    const head = extractHead(source, file);
    if (!head) continue;
    const robotsTags = findStartTags(head.source, "meta").filter(
      (entry) => boundAttributeValue(entry.tag, "name")?.toLowerCase() === "robots",
    );
    if (robotsTags.length !== 1) {
      fail(`${file}：robots meta 应恰好 1 个，实际 ${robotsTags.length} 个`);
      continue;
    }
    const tokens = new Set(
      (boundAttributeValue(robotsTags[0].tag, "content") ?? "")
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean),
    );
    for (const token of ["noindex", "nofollow"]) {
      if (!tokens.has(token)) fail(`${file}：robots meta 缺少 ${token}`);
    }
  }

  for (const file of authPages) {
    const source = context.read(file);
    if (source === null) continue;
    if (!/gateway_fragments\/layout\s*::\s*layout\s*\(/.test(maskHtmlComments(source))) {
      fail(`${file}：认证页必须继承 gateway layout 的 noindex 契约`);
    }
  }
}

function verifyPaginationAnchors(htmlSources) {
  for (const [file, source] of htmlSources) {
    const masked = maskHtmlComments(source);
    for (const entry of findStartTags(masked, "a")) {
      const tag = entry.tag;
      const isPagination =
        /(?:hasPrevious|hasNext|prevUrl|nextUrl)/i.test(tag) ||
        /(?:^|\s)rel\s*=\s*(?:"[^"]*\b(?:prev|next)\b[^"]*"|'[^']*\b(?:prev|next)\b[^']*')/i.test(tag);
      if (!isPagination) continue;
      stats.paginationAnchors += 1;

      const reasons = [];
      if (/\b(?:pointer-events-none|cursor-not-allowed)\b/.test(tag)) {
        reasons.push("CSS 禁用类");
      }
      if (
        /(?:th:class(?:append)?|x-bind:class|:class)\s*=/.test(tag) &&
        /(?:hasPrevious|hasNext)/i.test(tag) &&
        !/(?:^|\s)th:if\s*=/.test(tag)
      ) {
        reasons.push("以动态 class 代替条件渲染");
      }
      if (
        boundAttributeValue(tag, "aria-disabled") !== undefined &&
        boundAttributeValue(tag, "href") !== undefined &&
        !/(?:preventDefault|th:if\s*=)/.test(tag)
      ) {
        reasons.push("保留 href 的 aria-disabled 锚点");
      }
      if (reasons.length > 0) {
        fail(`${file}:${lineNumber(masked, entry.index)}：分页锚点禁止 CSS-only 禁用（${reasons.join("、")}）`);
      }
    }
  }
}

function verifyImageAlternatives(htmlSources) {
  for (const [file, source] of htmlSources) {
    const masked = maskHtmlComments(source);
    for (const entry of findStartTags(masked, "img")) {
      stats.images += 1;
      if (!/(?:^|\s)(?:alt|th:alt|x-bind:alt|:alt)\s*=/i.test(entry.tag)) {
        fail(`${file}:${lineNumber(masked, entry.index)}：<img> 缺少 alt 属性`);
      }
    }
  }
}

function verifyMainOwnership(context) {
  for (const file of contentFragmentsWithoutMain) {
    const source = context.read(file);
    if (source === null) continue;
    const mainTags = findStartTags(source, "main");
    for (const entry of mainTags) {
      fail(`${file}:${lineNumber(source, entry.index)}：内容片段由布局包裹，禁止嵌套 <main>`);
    }
  }

  for (const file of expectedLayouts) {
    const source = context.read(file);
    if (source === null) continue;
    const mainCount = findStartTags(source, "main").length;
    if (file === docsLayout) {
      if (mainCount !== 0) fail(`${file}：Docs 布局应由内容片段拥有 <main>`);
    } else if (mainCount === 0) {
      fail(`${file}：布局缺少页面级 <main>`);
    }
  }

  for (const file of [
    "templates/modules/docs-content.html",
    "templates/modules/doc-content.html",
    "templates/modules/doc-catalog-content.html",
  ]) {
    const source = context.read(file);
    if (source !== null && findStartTags(source, "main").length === 0) {
      fail(`${file}：Docs 内容片段必须拥有页面级 <main>`);
    }
  }
}

function fragmentSource(source, fragmentName) {
  const masked = maskHtmlComments(source);
  const fragments = [...masked.matchAll(/th:fragment\s*=\s*(["'])([^"']+)\1/gi)];
  const index = fragments.findIndex((match) => match[2].split(/[\s(]/, 1)[0] === fragmentName);
  if (index === -1) return null;
  const start = fragments[index].index;
  const end = fragments[index + 1]?.index ?? masked.length;
  return masked.slice(start, end);
}

function verifyHeadings(context) {
  for (const [file, minimum] of headingMinimums) {
    const source = context.read(file);
    if (source === null) continue;
    const count = findStartTags(source, "h1").length;
    stats.headings += count;
    if (count < minimum) {
      fail(`${file}：关键页面至少需要 ${minimum} 个 H1，实际 ${count} 个`);
    }
  }

  for (const [file, fragmentNames] of headingFragments) {
    const source = context.read(file);
    if (source === null) continue;
    for (const fragmentName of fragmentNames) {
      const fragment = fragmentSource(source, fragmentName);
      if (fragment === null) {
        fail(`${file}：缺少关键内容片段 ${fragmentName}`);
        continue;
      }
      const count = findStartTags(fragment, "h1").length;
      stats.headings += count;
      if (count === 0) fail(`${file}：内容片段 ${fragmentName} 缺少 H1`);
    }
  }

  const indexLayout = context.read("templates/modules/index/layout.html");
  if (indexLayout !== null) {
    const fallbackHeading = findStartTags(indexLayout, "h1").some(
      (entry) =>
        /\bsr-only\b/.test(entry.tag) &&
        /background_settings\?\.enable_header\s*==\s*false/.test(entry.tag) &&
        /title_settings\?\.show_title\s*!=\s*true/.test(entry.tag),
    );
    if (!fallbackHeading) fail("templates/modules/index/layout.html：首页缺少互补条件的 sr-only H1");
  }

  const indexTitle = context.read("templates/modules/index/header/title.html");
  if (indexTitle !== null) {
    const visibleHeading = findStartTags(indexTitle, "h1").some(
      (entry) => !/\bsr-only\b/.test(entry.tag) && /show_title/.test(entry.tag),
    );
    if (!visibleHeading) fail("templates/modules/index/header/title.html：首页可见标题缺少条件 H1");
  }
}

function loadHtmlSources(context) {
  const sources = new Map();
  for (const file of context.files.filter(
    (candidate) => candidate.startsWith("templates/") && candidate.endsWith(".html"),
  )) {
    const source = context.read(file);
    if (source !== null) sources.set(file, source);
  }
  return sources;
}

function runContracts(context) {
  const htmlSources = loadHtmlSources(context);
  verifySharedSeoHead(context);
  verifyLayouts(context, htmlSources);
  verifyTemplateIds(context);
  verifyNoindex(context);
  verifyPaginationAnchors(htmlSources);
  verifyImageAlternatives(htmlSources);
  verifyMainOwnership(context);
  verifyHeadings(context);
}

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  printUsage();
} else {
  let context;
  try {
    const reader =
      options.archive === undefined
        ? createSourceReader()
        : createArchiveReader(typeof options.archive === "string" ? options.archive : undefined);
    context = createContext(reader);
    runContracts(context);
  } catch (error) {
    fail(`无法初始化校验输入：${error.message}`);
  }

  if (failures.length > 0) {
    console.error(`SEO 契约验证失败（${failures.length} 项，${context?.label ?? "输入初始化"}）：`);
    for (const failure of failures) console.error(`- ${failure}`);
  } else {
    console.log(`SEO 契约验证通过（${context.label}）：${stats.layouts} 个真实布局均由统一 seo-head 接管。`);
    console.log(
      `已校验 ${stats.images} 个静态图片 alt、${stats.headings} 个关键 H1、${stats.paginationAnchors} 个分页锚点及内容 main 所有权。`,
    );
  }

  process.exitCode = failures.length === 0 ? 0 : 1;
}
