#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const envFileArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--env-file="))
  ?.slice("--env-file=".length);

for (const file of [envFileArg, ".env.local", ".env"].filter(Boolean)) {
  loadEnvFile(file);
}

const baseUrl = (process.env.HALO_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:8090").replace(
  /\/+$/,
  "",
);
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10);
const deepMode = /^(1|true|yes|on)$/i.test(process.env.VERIFY_PLUGIN_DEEP || "");

const checks = [
  {
    name: "Links",
    path: "/links",
    markers: [
      "友情链接",
      "site-info-modal",
      "links-comments",
      "data-link-submit-trigger",
      "/plugins/link-submit/assets/static/link-submit-widget.iife.js?version=1.0.7",
      "data-link-submit-fallback",
    ],
    match: "all",
  },
  {
    name: "Photos",
    path: "/photos",
    markers: ["photo-grid", "图库", "photos.js"],
    match: "all",
  },
  {
    name: "Moments",
    path: "/moments",
    markers: ["moments-list", "瞬间", "moments.js"],
    match: "all",
  },
  {
    name: "Friends",
    path: "/friends",
    markers: ["朋友圈", "plugin-friends-rss", "__completeSwupPageInit"],
    match: "all",
  },
  {
    name: "Docsme",
    path: "/docs",
    markers: ["文档中心", "doc.js"],
    match: "all",
  },
  {
    name: "Bangumi",
    path: "/bangumis",
    markers: ["bangumi-page", "追番", "bangumi.js"],
    match: "all",
  },
  {
    name: "Steam",
    path: "/steam",
    markers: ["steam-page", "Steam", "steam.js"],
    match: "all",
  },
  {
    name: "Equipment",
    path: "/equipments",
    markers: ["equipment-page", "装备", "equipment.js"],
    match: "all",
  },
  {
    name: "Douban",
    path: "/douban",
    markers: ["douban-page", "douban-grid", "douban.js"],
    match: "all",
  },
  {
    name: "Login",
    path: "/login",
    markers: ["halo-form", "login?method=passkey", "/plugins/auth-passkey/assets/static/passkey.svg"],
    match: "all",
  },
  {
    name: "Dishes External Route",
    path: "/dishes",
    markers: [
      'id="app"',
      "data-dishes-site-title",
      "dishes-csrf-header",
      "window.__DISHES_CSRF__",
      "window.__DISHES_PUBLIC_BASE__",
      "/plugins/dishes/assets/dishes-frontend/assets/index.css",
      "/plugins/dishes/assets/dishes-frontend/app.js",
    ],
    match: "all",
  },
  {
    name: "Schedule External Route",
    path: "/schedule-calendar",
    markers: ['id="calendar-view"', 'id="agenda-view"', "/apis/api.schedule.calendar.sunny.dev/v1alpha1/summary"],
    match: "all",
  },
];

function envPath(name, fallback) {
  return process.env[name] || fallback;
}

function loadEnvFile(file) {
  const resolved = path.resolve(process.cwd(), file);
  if (!fs.existsSync(resolved)) return;

  const content = fs.readFileSync(resolved, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

const optionalChecks = [
  {
    env: "PHOTO_DETAIL_URL",
    name: "Photo Detail",
    markers: ["photo-detail-page", "photo-detail-image"],
  },
  {
    env: "MOMENT_DETAIL_URL",
    name: "Moment Detail",
    markers: ["moment", "halo:comment", "handleMomentUpvote"],
  },
  {
    env: "DOC_DETAIL_URL",
    name: "Doc Detail",
    markers: ["doc-layout", "article-content", "toc-nav"],
  },
  {
    env: "VOTE_PAGE_URL",
    name: "Vote Block",
    markers: ["<vote-block", "/plugins/vote/assets/static/vote.iife.js"],
    match: "all",
  },
  {
    env: "TEXT_DIAGRAM_PAGE_URL",
    name: "Text Diagram",
    markers: ["<text-diagram"],
  },
  {
    env: "CONTACT_FORM_PAGE_URL",
    name: "Contact Form",
    markers: ["<halo-contact-form"],
  },
  {
    env: "AI_SUMMARY_PAGE_URL",
    name: "AI Summary",
    markers: ["<ai-summary-widget"],
  },
  {
    env: "SHIKI_PAGE_URL",
    name: "Shiki Code Block",
    markers: ["<shiki-code", "shiki-code.js?version="],
    match: "all",
  },
  {
    env: "HYPERLINK_CARD_PAGE_URL",
    name: "Hyperlink Card",
    markers: [
      "<hyperlink-card",
      "<hyperlink-inline-card",
      "/plugins/editor-hyperlink-card/assets/static/index.iife.js?version=1.9.2",
    ],
    match: "all",
  },
  {
    env: "LOTTERY_PAGE_URL",
    name: "Lottery Card",
    markers: ["<lottery-card", "/plugins/lottery/assets/static/lottery-card.js?version=1.0.2"],
    match: "all",
  },
  {
    env: "RESTRICTED_READING_PAGE_URL",
    name: "Restricted Reading",
    markers: [
      "<content-restrict-widget",
      "/plugins/restricted-reading/assets/static/content-restrict-widget.iife.js?version=1.8.1",
    ],
    match: "all",
  },
  {
    env: "MAINTENANCE_PAGE_URL",
    name: "Maintenance Theme",
    markers: ['id="maintenance-page"', 'data-plugin-contract="maintenance@1.1.0"'],
    match: "all",
  },
];

const deepChecks = [
  {
    name: "Home Plugin Widgets",
    path: envPath("HOME_URL", "/"),
    markers: ["文档中心", "友情链接", "瞬间说说"],
    match: "all",
  },
  {
    name: "Docsme Catalog",
    path: envPath("DOC_CATALOG_URL", "/docs/halo-theme-sky-blog-1/theme-settings"),
    markers: ["doc-layout", "主题配置功能详解", "var docsme = { disableThemeFunction: true }"],
    match: "all",
  },
  {
    name: "Shiki Loader",
    path: envPath("ARTICLE_CODE_URL", "/archives/editor-feature-demo"),
    markers: ["plugin-shiki", "shiki-code.js?version="],
    match: "all",
  },
  {
    name: "Comment Widget",
    path: envPath("COMMENT_PAGE_URL", process.env.DOC_DETAIL_URL || "/archives/editor-feature-demo"),
    markers: ["plugin-comment-widget", "comment-widget.js?version=3.1.2", "评论交流"],
    match: "all",
  },
  {
    name: "Search Widget",
    path: envPath("SEARCH_PAGE_URL", "/"),
    markers: ["PluginSearchWidget", "SearchWidget.open()"],
    match: "all",
  },
  {
    name: "Contact Form Loader Reference",
    path: envPath("CONTACT_FORM_LOADER_URL", "/"),
    markers: ["/plugins/PluginContactForm/assets/static/contact-form-loader.iife.js?version="],
    match: "all",
  },
  {
    name: "Link Submit Widget Script",
    path: "/plugins/link-submit/assets/static/link-submit-widget.iife.js?version=1.0.7",
    markers: ["LinkSubmitWidget", "link-submit-modal"],
    match: "all",
  },
  {
    name: "Link Submit Widget Style",
    path: "/plugins/link-submit/assets/static/var.css?version=1.0.7",
    markers: ["--link-submit-widget-base-bg-color", "--link-submit-widget-form-button-bg-color"],
    match: "all",
  },
  {
    name: "Moments Media Binding",
    path: envPath("LIGHTGALLERY_PAGE_URL", "/moments"),
    markers: ["moment-media", "data-src"],
    match: "all",
  },
  {
    name: "Author Moments Gate",
    path: envPath("AUTHOR_URL", "/authors/sky0821"),
    markers: ["author_tab", 'data-plugin-moments-contract="PluginMoments>=1.16.1"', "data-plugin-moments-available="],
    match: "all",
  },
  {
    name: "Feed XML",
    path: envPath("FEED_URL", "/feed.xml"),
    markers: ["<rss", "<channel"],
    match: "all",
  },
  {
    name: "Sitemap XML",
    path: envPath("SITEMAP_URL", "/sitemap.xml"),
    markers: ["<urlset", "<loc"],
    match: "all",
  },
  {
    name: "Robots Sitemap",
    path: envPath("ROBOTS_URL", "/robots.txt"),
    markers: ["Sitemap:"],
    match: "all",
  },
];

const deepApiChecks = [
  {
    name: "Douban Types API",
    path: "/apis/api.douban.moony.la/v1alpha1/doubanmovies/-/types",
    validate(data) {
      const types = Array.isArray(data) ? data.filter((type) => type?.key && type?.name) : [];
      return {
        ok: types.length > 0,
        marker:
          types
            .slice(0, 6)
            .map((type) => type.key)
            .join(", ") || "-",
        error: "type data not found",
      };
    },
  },
  {
    name: "Douban Genres API",
    path: "/apis/api.douban.moony.la/v1alpha1/doubanmovies/-/genres",
    validate(data) {
      const genres = Array.isArray(data)
        ? data.map((genre) => (typeof genre === "string" ? genre : genre?.name)).filter(Boolean)
        : [];

      return {
        ok: genres.length > 0,
        marker: genres.slice(0, 6).join(", ") || "-",
        error: "genre data not found",
      };
    },
  },
  {
    name: "Online Summary API",
    path: "/apis/online-user.zyx2012.cn/v1alpha1/stats/summary",
    validate(data) {
      const summary = data?.data || data;
      const hasCount = ["online", "onlineCount", "total", "totalOnline"].some((key) =>
        Number.isFinite(Number(summary?.[key])),
      );
      return {
        ok: hasCount,
        marker: hasCount ? "online-count" : "-",
        error: "online summary count not found",
      };
    },
  },
];

if (/^(1|true|yes|on)$/i.test(process.env.BANGUMI_VALIDATE_INVALID || "")) {
  deepChecks.push(
    { name: "Bangumi Page Boundary", path: "/bangumis?page=0", expectedStatus: 404, statusOnly: true },
    { name: "Bangumi Size Boundary", path: "/bangumis?size=0", expectedStatus: 404, statusOnly: true },
    { name: "Bangumi Type Boundary", path: "/bangumis?typeNum=3", expectedStatus: 404, statusOnly: true },
    { name: "Bangumi Status Boundary", path: "/bangumis?status=4", expectedStatus: 404, statusOnly: true },
    // 1.4.1 使用 NumberUtils 默认值处理非数字字符串；这是 200 回退行为，不是 404 契约。
    { name: "Bangumi Page Text Fallback", path: "/bangumis?page=invalid", expectedStatus: 200, statusOnly: true },
    { name: "Bangumi Size Text Fallback", path: "/bangumis?size=invalid", expectedStatus: 200, statusOnly: true },
    { name: "Bangumi Type Text Fallback", path: "/bangumis?typeNum=invalid", expectedStatus: 200, statusOnly: true },
    { name: "Bangumi Status Text Fallback", path: "/bangumis?status=invalid", expectedStatus: 200, statusOnly: true },
  );
}

for (const optional of optionalChecks) {
  const path = process.env[optional.env];
  if (path) {
    checks.push({
      name: optional.name,
      path,
      markers: optional.markers,
      match: optional.match,
    });
  }
}

if (deepMode) {
  checks.push(...deepChecks);
}

function resolveUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    const data = await response.json();
    return {
      response,
      data,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function findMarkers(html, markers) {
  const renderedHtml = stripNonRenderedMarkup(html);
  return markers.filter((marker) => {
    if (!marker.startsWith("<")) return html.includes(marker);
    const tagName = marker.slice(1);
    return new RegExp(`<${escapeRegExp(tagName)}(?:\\s|/?>)`, "i").test(renderedHtml);
  });
}

function stripNonRenderedMarkup(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function evaluateMarkers(html, check) {
  if (check.statusOnly) return { foundMarkers: [], ok: true };
  const foundMarkers = findMarkers(html, check.markers || []);
  const ok = check.match === "all" ? foundMarkers.length === check.markers.length : foundMarkers.length > 0;

  return {
    foundMarkers,
    ok,
  };
}

const results = [];

for (const check of checks) {
  const url = resolveUrl(check.path);
  try {
    const response = await fetchWithTimeout(url);
    const html = await response.text();
    const markers = evaluateMarkers(html, check);
    const expectedStatus = check.expectedStatus || 200;
    const ok = response.status === expectedStatus && markers.ok;
    results.push({
      ...check,
      url,
      status: response.status,
      marker: markers.foundMarkers.join(", ") || "-",
      ok,
      error: ok
        ? ""
        : markers.ok
          ? `unexpected status ${response.status}; expected ${expectedStatus}`
          : check.match === "all"
            ? "required markers not found"
            : "marker not found",
    });
  } catch (error) {
    results.push({
      ...check,
      url,
      status: "-",
      marker: "-",
      ok: false,
      error: error?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : error.message,
    });
  }
}

if (deepMode) {
  for (const check of deepApiChecks) {
    const url = resolveUrl(check.path);
    try {
      const { response, data } = await fetchJsonWithTimeout(url);
      const validation = check.validate(data);
      const expectedStatus = check.expectedStatus || 200;
      const ok = response.status === expectedStatus && validation.ok;
      results.push({
        ...check,
        url,
        status: response.status,
        marker: validation.marker || "-",
        ok,
        error: ok
          ? ""
          : validation.ok
            ? `unexpected status ${response.status}; expected ${expectedStatus}`
            : validation.error,
      });
    } catch (error) {
      results.push({
        ...check,
        url,
        status: "-",
        marker: "-",
        ok: false,
        error: error?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : error.message,
      });
    }
  }
}

const width = Math.max(...results.map((result) => result.name.length), 10);

console.log(`Plugin smoke base: ${baseUrl}`);
console.log("Plugin smoke scope: HTTP status and rendered markers only; PJAX requires real browser navigation");
if (deepMode) {
  console.log("Plugin smoke mode: deep");
}
for (const result of results) {
  const icon = result.ok ? "OK" : "FAIL";
  const name = result.name.padEnd(width, " ");
  const details = result.ok
    ? `status=${result.status} marker=${result.marker}`
    : `status=${result.status} ${result.error}`;
  console.log(`${icon} ${name} ${result.path} ${details}`);
}

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(`Plugin smoke failed: ${failures.length}/${results.length}`);
  process.exit(1);
}

console.log(`Plugin smoke passed: ${results.length}/${results.length}`);
