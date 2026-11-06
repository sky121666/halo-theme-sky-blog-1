#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { normalizeDoubanItem } from "../src/apps/douban/model.js";
import { themeCodeIdentity } from "./theme-code-identity.mjs";
import { previewPageUrl, renderedThemeIdentity } from "./plugin-preview.mjs";

const startedAt = new Date().toISOString();
const codeAtStart = themeCodeIdentity();
const reportPath = process.argv.find((arg) => arg.startsWith("--report="))?.slice("--report=".length);
// Official ThemeResolver preview is request-scoped; it does not activate a theme.
const previewTheme = process.argv.find((arg) => arg.startsWith("--preview-theme="))?.slice("--preview-theme=".length);
if (previewTheme != null && !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(previewTheme)) {
  throw new Error("--preview-theme must be a theme metadata.name");
}
const cacheFreshSinceArg = process.argv
  .find((arg) => arg.startsWith("--cache-fresh-since="))
  ?.slice("--cache-fresh-since=".length);
const cacheFreshSince = cacheFreshSinceArg == null ? null : Date.parse(cacheFreshSinceArg);
if (cacheFreshSinceArg != null && !Number.isFinite(cacheFreshSince)) {
  throw new Error("--cache-fresh-since must be an ISO date/time");
}

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
    plugin: "PluginLinks",
    path: "/links",
    markers: [
      "data-links-page",
      'data-plugin-links-contract="PluginLinks>=2.2.1"',
      "data-plugin-links-title",
      "data-link-group-navigation",
      "data-link-access-state",
      "links-comments",
    ],
    match: "all",
  },
  {
    name: "Photos",
    plugin: "PluginPhotos",
    path: "/photos",
    markers: ["photo-grid", "图库", "photos.js"],
    match: "all",
  },
  {
    name: "Moments",
    plugin: "PluginMoments",
    path: "/moments",
    markers: ["moments-list", "瞬间", "moments.js"],
    match: "all",
  },
  {
    name: "Links Friend Feed",
    plugin: "PluginLinks",
    path: "/links?view=friends",
    markers: ['data-links-view-panel="friends"', "data-link-feeds", "links.js"],
    match: "all",
  },
  {
    name: "Docsme",
    plugin: "plugin-docsme",
    path: "/docs",
    markers: ["文档中心", "doc.js"],
    match: "all",
  },
  {
    name: "Bangumi",
    plugin: "plugin-bilibili-bangumi",
    path: "/bangumis",
    markers: ["bangumi-page", "追番", "bangumi.js"],
    match: "all",
  },
  {
    name: "Steam",
    plugin: "steam",
    path: "/steam",
    markers: ["steam-page", "Steam", "steam.js"],
    match: "all",
  },
  {
    name: "Equipment",
    plugin: "equipment",
    path: "/equipments",
    markers: ["equipment-page", "装备", "equipment.js"],
    match: "all",
  },
  {
    name: "Douban",
    plugin: "plugin-douban",
    path: "/douban",
    markers: ["douban-page", "douban-grid", "douban.js"],
    match: "all",
  },
  {
    name: "Login",
    path: "/login",
    markers: ["halo-form"],
    match: "all",
  },
  {
    name: "Login Passkey",
    plugin: "auth-passkey",
    path: "/login",
    markers: ["login?method=passkey", "/plugins/auth-passkey/assets/static/passkey.svg"],
    match: "all",
  },
  {
    name: "Dishes External Route",
    plugin: "dishes",
    independentPage: true,
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
    plugin: "schedule-calendar",
    independentPage: true,
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
    plugin: "PluginPhotos",
    name: "Photo Detail",
    markers: ["photo-detail-page", "photo-detail-image"],
  },
  {
    env: "MOMENT_DETAIL_URL",
    plugin: "PluginMoments",
    name: "Moment Detail",
    markers: ["moment", "halo:comment", "handleMomentUpvote"],
  },
  {
    env: "DOC_DETAIL_URL",
    plugin: "plugin-docsme",
    name: "Doc Detail",
    markers: ["doc-layout", "article-content", "toc-nav"],
  },
  {
    env: "VOTE_PAGE_URL",
    plugin: "vote",
    name: "Vote Block",
    markers: ["<vote-block", "/plugins/vote/assets/static/vote.iife.js"],
    match: "all",
  },
  {
    env: "TEXT_DIAGRAM_PAGE_URL",
    plugin: "text-diagram",
    name: "Text Diagram",
    markers: ["<text-diagram"],
  },
  {
    env: "CONTACT_FORM_PAGE_URL",
    plugin: "PluginContactForm",
    name: "Contact Form",
    markers: ["<halo-contact-form"],
  },
  {
    env: "AI_SUMMARY_PAGE_URL",
    plugin: "ai-assistant",
    name: "AI Summary",
    markers: ["<ai-summary-widget"],
  },
  {
    env: "SHIKI_PAGE_URL",
    plugin: "shiki",
    name: "Shiki Code Block",
    markers: ["<shiki-code", "shiki-code.js?version="],
    match: "all",
  },
  {
    env: "HYPERLINK_CARD_PAGE_URL",
    plugin: "editor-hyperlink-card",
    resource: "/plugins/editor-hyperlink-card/assets/static/index.iife.js",
    name: "Hyperlink Card",
    markers: [
      "<hyperlink-card",
      "<hyperlink-inline-card",
      "/plugins/editor-hyperlink-card/assets/static/index.iife.js?version=",
    ],
    match: "all",
  },
  {
    env: "LOTTERY_PAGE_URL",
    plugin: "lottery",
    resource: "/plugins/lottery/assets/static/lottery-card.js",
    name: "Lottery Card",
    markers: ["<lottery-card", "/plugins/lottery/assets/static/lottery-card.js?version="],
    match: "all",
  },
  {
    env: "RESTRICTED_READING_PAGE_URL",
    plugin: "restricted-reading",
    resource: "/plugins/restricted-reading/assets/static/content-restrict-widget.iife.js",
    name: "Restricted Reading",
    markers: [
      "<content-restrict-widget",
      "/plugins/restricted-reading/assets/static/content-restrict-widget.iife.js?version=",
    ],
    match: "all",
  },
  {
    env: "MAINTENANCE_PAGE_URL",
    plugin: "maintenance",
    name: "Maintenance Theme",
    markers: ['id="maintenance-page"', 'data-plugin-contract="maintenance@1.1.0"'],
    match: "all",
  },
];

const deepChecks = [
  {
    name: "Home Docs Widget",
    plugin: "plugin-docsme",
    path: envPath("HOME_URL", "/"),
    markers: ["文档中心"],
    match: "all",
  },
  {
    name: "Home Links Widget",
    plugin: "PluginLinks",
    path: envPath("HOME_URL", "/"),
    markers: ["友情链接"],
    match: "all",
  },
  {
    name: "Home Moments Widget",
    plugin: "PluginMoments",
    path: envPath("HOME_URL", "/"),
    markers: ["瞬间说说"],
    match: "all",
  },
  {
    name: "Docsme Catalog",
    plugin: "plugin-docsme",
    path: envPath("DOC_CATALOG_URL", "/docs/halo-theme-sky-blog-1/theme-settings"),
    markers: ["doc-layout", "主题配置功能详解", "var docsme = { disableThemeFunction: true }"],
    match: "all",
  },
  {
    name: "Shiki Loader",
    plugin: "shiki",
    path: envPath("ARTICLE_CODE_URL", "/archives/editor-feature-demo"),
    markers: ["plugin-shiki", "shiki-code.js?version="],
    match: "all",
  },
  {
    name: "Comment Widget",
    plugin: "PluginCommentWidget",
    resource: "/plugins/PluginCommentWidget/assets/static/comment-widget.js",
    path: envPath("COMMENT_PAGE_URL", process.env.DOC_DETAIL_URL || "/archives/editor-feature-demo"),
    commentMount: true,
    markers: ["plugin-comment-widget", "comment-widget.js?version=", "评论交流"],
    match: "all",
  },
  {
    name: "Search Widget",
    plugin: "PluginSearchWidget",
    path: envPath("SEARCH_PAGE_URL", "/"),
    markers: ["PluginSearchWidget", "SearchWidget.open()"],
    match: "all",
  },
  {
    name: "Contact Form Loader Reference",
    plugin: "PluginContactForm",
    contactFormBootstrap: true,
    path: envPath("CONTACT_FORM_LOADER_URL", "/"),
    markerGroups: [
      ["/contact-form/embed.js", "/plugins/PluginContactForm/assets/static/contact-form-loader.iife.js?version="],
    ],
    markers: [],
    match: "all",
  },
  {
    name: "Moments Media Binding",
    plugin: "PluginMoments",
    path: envPath("LIGHTGALLERY_PAGE_URL", "/moments"),
    markers: ["moment-media", "data-src"],
    match: "all",
  },
  {
    name: "Author Moments Gate",
    plugin: "PluginMoments",
    path: envPath("AUTHOR_URL", "/authors/sky0821"),
    markers: ["author_tab", 'data-plugin-moments-contract="PluginMoments>=1.16.1"', "data-plugin-moments-available="],
    match: "all",
  },
  {
    name: "Feed XML",
    plugin: "PluginFeed",
    path: envPath("FEED_URL", "/feed.xml"),
    markers: ["<rss", "<channel"],
    match: "all",
  },
  {
    name: "Sitemap XML",
    plugin: "PluginSitemap",
    path: envPath("SITEMAP_URL", "/sitemap.xml"),
    markers: ["<urlset", "<loc"],
    match: "all",
  },
  {
    name: "Robots Sitemap",
    plugin: "PluginSitemap",
    path: envPath("ROBOTS_URL", "/robots.txt"),
    markers: ["Sitemap:"],
    match: "all",
  },
];

const deepApiChecks = [
  {
    name: "Links 2.2.1 Public API",
    plugin: "PluginLinks",
    path: "/apis/api.link.halo.run/v1alpha1/links",
    validate(data) {
      const items = Array.isArray(data?.items) ? data.items : [];
      const accessStates = new Set(["CHECKING", "ACCESSIBLE", "INACCESSIBLE"]);
      const backlinkStates = new Set(["CHECKING", "FOUND", "MISSING", "NOT_CONFIGURED", "FAILED"]);
      const valid = items.every((link) => {
        const access = link?.status?.verification?.access?.state;
        const backlink = link?.status?.verification?.backlink?.state;
        return (
          link?.metadata?.name &&
          link?.spec?.url &&
          (!access || accessStates.has(access)) &&
          (!backlink || backlinkStates.has(backlink))
        );
      });
      return {
        ok: items.length > 0 && valid,
        marker: `links=${items.length}, status-enums`,
        error: "PluginLinks public link/status schema is invalid",
      };
    },
  },
  {
    name: "Links 2.2.1 Groups API",
    plugin: "PluginLinks",
    path: "/apis/api.link.halo.run/v1alpha1/linkgroups",
    validate(data) {
      const groups = Array.isArray(data) ? data : [];
      const valid = groups.every((group) => group?.metadata?.name && group?.spec?.displayName);
      return {
        ok: groups.length > 0 && valid,
        marker: `groups=${groups.length}`,
        error: "PluginLinks public group schema is invalid",
      };
    },
  },
  {
    name: "Links 2.2.1 Feed API",
    plugin: "PluginLinks",
    path: "/apis/api.link.halo.run/v1alpha1/linkfeeds?limit=20",
    validate(data) {
      const items = Array.isArray(data?.items) ? data.items : null;
      const valid = items?.every((feed) => feed?.id && feed?.url && feed?.title && !feed?.feedUrls);
      return {
        ok: items != null && valid,
        marker: items?.length ? `public-feeds=${items.length}` : "public-feed-disabled",
        error: "PluginLinks public feed schema is invalid",
      };
    },
  },
  {
    name: "Douban Items API",
    plugin: "plugin-douban",
    path: "/apis/api.douban.moony.la/v1alpha1/doubanmovies?page=1&size=20&status=done",
    validate(data) {
      const items = Array.isArray(data?.items) ? data.items : null;
      const valid = items?.every((item) => {
        const entry = normalizeDoubanItem(item);
        return typeof entry.name === "string" && /^https?:\/\//.test(entry.link);
      });
      return {
        ok: items != null && valid,
        marker: `readable-items=${items?.length ?? 0}`,
        error: "Douban item title/link contract is invalid",
      };
    },
  },
  {
    name: "Douban Types API",
    plugin: "plugin-douban",
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
    plugin: "plugin-douban",
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
    plugin: "online",
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
    { name: "Bangumi Page Boundary", plugin: "plugin-bilibili-bangumi", path: "/bangumis?page=0", expectedStatus: 404, statusOnly: true },
    { name: "Bangumi Size Boundary", plugin: "plugin-bilibili-bangumi", path: "/bangumis?size=0", expectedStatus: 404, statusOnly: true },
    { name: "Bangumi Type Boundary", plugin: "plugin-bilibili-bangumi", path: "/bangumis?typeNum=3", expectedStatus: 404, statusOnly: true },
    { name: "Bangumi Status Boundary", plugin: "plugin-bilibili-bangumi", path: "/bangumis?status=4", expectedStatus: 404, statusOnly: true },
    // 1.4.1 使用 NumberUtils 默认值处理非数字字符串；这是 200 回退行为，不是 404 契约。
    { name: "Bangumi Page Text Fallback", plugin: "plugin-bilibili-bangumi", path: "/bangumis?page=invalid", expectedStatus: 200, statusOnly: true },
    { name: "Bangumi Size Text Fallback", plugin: "plugin-bilibili-bangumi", path: "/bangumis?size=invalid", expectedStatus: 200, statusOnly: true },
    { name: "Bangumi Type Text Fallback", plugin: "plugin-bilibili-bangumi", path: "/bangumis?typeNum=invalid", expectedStatus: 200, statusOnly: true },
    { name: "Bangumi Status Text Fallback", plugin: "plugin-bilibili-bangumi", path: "/bangumis?status=invalid", expectedStatus: 200, statusOnly: true },
  );
}

for (const optional of optionalChecks) {
  checks.push({ ...optional, path: process.env[optional.env] || null });
}

if (deepMode) {
  checks.push(...deepChecks);
}

async function addDiscoveredLinksGroupChecks() {
  try {
    const headers = { Accept: "application/json" };
    const [groupsResponse, linksResponse] = await Promise.all([
      fetchWithTimeout(resolveUrl("/apis/api.link.halo.run/v1alpha1/linkgroups"), { headers }),
      fetchWithTimeout(resolveUrl("/apis/api.link.halo.run/v1alpha1/links"), { headers }),
    ]);
    if (!groupsResponse.ok || !linksResponse.ok) return;
    const [groups, linksPage] = await Promise.all([groupsResponse.json(), linksResponse.json()]);
    const links = Array.isArray(linksPage?.items) ? linksPage.items : [];
    if (!Array.isArray(groups)) return;

    const hasLinks = (group) => links.some((link) => link?.spec?.groupName === group?.metadata?.name);
    const populatedGroup = groups.find(hasLinks);
    const emptyGroup = groups.find((group) => !hasLinks(group));

    if (populatedGroup?.metadata?.name) {
      const name = populatedGroup.metadata.name;
      checks.push({
        name: "Links Populated Group Route",
        plugin: "PluginLinks",
        path: `/links?group=${encodeURIComponent(name)}`,
        markers: [`data-link-group-section="${name}"`, 'aria-current="page"'],
        match: "all",
      });
    }
    if (emptyGroup?.metadata?.name) {
      checks.push({
        name: "Links Empty Group Route",
        plugin: "PluginLinks",
        path: `/links?group=${encodeURIComponent(emptyGroup.metadata.name)}`,
        markers: ['data-links-empty-state="group-empty"', "该分组暂无友情链接"],
        match: "all",
      });
    }
    checks.push({
      name: "Links Missing Group Route",
      plugin: "PluginLinks",
      path: "/links?group=theme-contract-missing-group",
      markers: ['data-links-empty-state="group-missing"', "未找到该友链分组"],
      match: "all",
    });
  } catch {
    // Public group API validation below will report the actual endpoint failure.
  }
}

function resolveUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function expectsHtml(path) {
  return !/\.(?:xml|rss|txt)$/i.test(new URL(resolveUrl(path)).pathname);
}

function isStalePageCache(cacheAt, path) {
  if (cacheFreshSince == null || !expectsHtml(path) || !cacheAt) return false;
  const cachedAt = Date.parse(cacheAt);
  // HTTP dates have second precision; a refresh within the same second is valid.
  return !Number.isFinite(cachedAt) || cachedAt + 1000 < cacheFreshSince;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
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

function findCommentMount(html) {
  const markup = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<template\b[^>]*>[\s\S]*?<\/template\s*>/gi, "");
  const rendered = stripNonRenderedMarkup(markup);
  const containers = new Set(
    [...rendered.matchAll(/<div\b[^>]*\sid\s*=\s*(["'])(comment-[A-Za-z0-9_-]+)\1[^>]*>/gi)].map((match) => match[2]),
  );
  // Halo emits one module per comment subject: import the official init, then bind its container.
  const initializer =
    /^\s*import\s*\{\s*init\s*\}\s*from\s*(["'])\/plugins\/PluginCommentWidget\/assets\/static\/comment-widget\.js\?version=[^"']+\1\s*;\s*init\s*\(\s*(["'])#(comment-[A-Za-z0-9_-]+)\2\s*,\s*\{[\s\S]*\}\s*\)\s*;?\s*$/;
  for (const script of markup.matchAll(
    /<script\b(?=[^>]*\stype\s*=\s*["']module["'])[^>]*>([\s\S]*?)<\/script\s*>/gi,
  )) {
    const id = script[1].match(initializer)?.[3];
    if (id && containers.has(id)) return id;
  }
  return null;
}

function evaluateMarkers(html, check) {
  if (check.statusOnly) return { foundMarkers: [], ok: true };
  const foundMarkers = findMarkers(html, check.markers || []);
  const baseMarkersOk = check.match === "all" ? foundMarkers.length === check.markers.length : foundMarkers.length > 0;
  const foundMarkerGroups = (check.markerGroups || []).map((group) => findMarkers(html, group));
  const markerGroupsOk = foundMarkerGroups.every((group) => group.length > 0);
  const commentMount = check.commentMount ? findCommentMount(html) : null;
  const commentMountOk = !check.commentMount || commentMount != null;

  return {
    foundMarkers: [...foundMarkers, ...foundMarkerGroups.flat(), ...(commentMount ? [`comment-mount:#${commentMount}`] : [])],
    ok: baseMarkersOk && markerGroupsOk && commentMountOk,
    error: commentMountOk ? "" : "comment container and official initialization are missing or mismatched",
  };
}

async function loadPluginStates() {
  const token = process.env.HALO_PAT || process.env.HALO_TOKEN || process.env.HALO_API_TOKEN;
  if (!token) return { states: null, error: "plugin inventory unavailable: missing HALO_PAT/HALO_TOKEN/HALO_API_TOKEN" };

  try {
    const response = await fetchWithTimeout(`${baseUrl}/apis/api.console.halo.run/v1alpha1/plugins?size=200`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return { states: null, error: `plugin inventory unavailable: HTTP ${response.status}` };

    const payload = await response.json();
    if (!Array.isArray(payload.items) || payload.items.some((plugin) => !plugin?.metadata?.name)) {
      return { states: null, error: "plugin inventory unavailable: invalid plugin items" };
    }
    const states = new Map(
      payload.items.map((plugin) => [
        plugin.metadata?.name,
        {
          phase: plugin.status?.phase || "UNKNOWN",
          version: plugin.spec?.version,
          enabled: plugin.spec?.enabled,
          requiresHalo: plugin.spec?.requires,
          artifactName: plugin.metadata?.annotations?.["plugin.halo.run/plugin-path"],
        },
      ]),
    );
    return { states, error: "" };
  } catch (error) {
    return {
      states: null,
      error: `plugin inventory unavailable: ${error?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : error.message}`,
    };
  }
}

function pluginCoverage(check) {
  if (!check.plugin) return null;
  if (!pluginStates) {
    return { outcome: "not-covered", error: pluginInventory.error, runtimeIdentityMissing: true };
  }
  const state = pluginStates.get(check.plugin);
  if (!state) return { outcome: "not-applicable", error: `plugin ${check.plugin} is not installed` };
  if (state.enabled === false) {
    return { outcome: "not-applicable", error: `plugin ${check.plugin} is disabled` };
  }
  const phase = state.phase.toUpperCase();
  if (phase === "UNKNOWN") {
    return {
      outcome: "not-covered",
      error: `plugin ${check.plugin} runtime phase is unknown`,
      runtimeIdentityMissing: true,
    };
  }
  if (phase !== "STARTED") return { outcome: "not-applicable", error: `plugin ${check.plugin} phase=${phase}` };
  return null;
}

function addUnexecutedResult(check, url, coverage) {
  results.push({
    ...check,
    url,
    status: "-",
    marker: "-",
    ok: null,
    skipped: coverage.outcome === "not-applicable",
    ...coverage,
  });
}

const results = [];
const pluginInventory = await loadPluginStates();
const pluginStates = pluginInventory.states;
if (deepMode && !pluginCoverage({ plugin: "PluginLinks" })) {
  await addDiscoveredLinksGroupChecks();
}

async function verifyResource(html, check) {
  if (check.contactFormBootstrap) {
    const bootstrap = html.match(/<script\b[^>]*src=["']([^"']*\/contact-form\/embed\.js[^"']*)["']/);
    const legacyLoader = html.match(
      /<script\b[^>]*src=["']([^"']*\/plugins\/PluginContactForm\/assets\/static\/contact-form-loader\.iife\.js[^"']*)["']/,
    );
    const reference = bootstrap?.[1] || legacyLoader?.[1];
    if (!reference) return { ok: false, error: "contact form bootstrap is absent" };
    const resourceUrl = new URL(reference.replaceAll("&amp;", "&"), baseUrl);
    if (resourceUrl.origin !== new URL(baseUrl).origin)
      return { ok: false, error: "unexpected contact form resource origin" };
    const response = await fetchWithTimeout(resourceUrl);
    const source = await response.text();
    if (!response.ok || !/javascript/.test(response.headers.get("content-type") || "")) {
      return { ok: false, error: "contact form bootstrap is unavailable" };
    }
    if (!bootstrap) return { ok: true, error: "" };
    const loader = source.match(/new URL\(["']([^"']+contact-form-loader\.iife\.js[^"']*)["']/)?.[1];
    if (!loader) return { ok: false, error: "contact form bootstrap does not reference its loader" };
    const loaderUrl = new URL(loader, resourceUrl);
    if (loaderUrl.origin !== new URL(baseUrl).origin)
      return { ok: false, error: "unexpected contact form loader origin" };
    const loaded = await fetchWithTimeout(loaderUrl);
    const ok = loaded.ok && /javascript/.test(loaded.headers.get("content-type") || "");
    await loaded.body?.cancel();
    return { ok, error: ok ? "" : "contact form loader is unavailable" };
  }
  if (!check.resource) return { ok: true, error: "" };
  const references = [...html.matchAll(new RegExp(`${escapeRegExp(check.resource)}\\?version=([^\\s"'<>]+)`, "g"))];
  const expectedVersion = pluginStates?.get(check.plugin)?.version;
  const versions = new Set(references.map((match) => match[1]));
  if (versions.size !== 1 || (expectedVersion && !versions.has(expectedVersion))) {
    return { ok: false, error: "plugin resources are missing, mixed, or differ from the installed version" };
  }
  // Halo's plugin asset handler serves GET; it may return 404 for HEAD.
  const response = await fetchWithTimeout(resolveUrl(references[0][0]));
  const ok = response.ok && /javascript/.test(response.headers.get("content-type") || "");
  await response.body?.cancel();
  return { ok, error: ok ? "" : "plugin JavaScript resource is unavailable" };
}

for (const check of checks) {
  const url = check.path ? previewPageUrl(check.path, baseUrl, previewTheme) : null;
  const coverage = pluginCoverage(check);
  if (coverage) {
    addUnexecutedResult(check, url, coverage);
    continue;
  }
  if (!check.path) {
    addUnexecutedResult(check, url, { outcome: "not-covered", error: `target URL is not configured: ${check.env}` });
    continue;
  }

  try {
    const response = await fetchWithTimeout(url, {
      headers: { Accept: expectsHtml(check.path) ? "text/html" : "*/*" },
    });
    const html = await response.text();
    const themeIdentity =
      expectsHtml(check.path) && !check.independentPage
        ? renderedThemeIdentity(html, previewTheme || "theme-sky-blog-1")
        : { ok: true, themes: [], notApplicable: true };
    const markers = evaluateMarkers(html, check);
    const resource = await verifyResource(html, check);
    const expectedStatus = check.expectedStatus || 200;
    const cacheAt = response.headers.get("x-halo-cache-at");
    const stalePageCache = isStalePageCache(cacheAt, check.path);
    const ok = response.status === expectedStatus && markers.ok && resource.ok && !stalePageCache && themeIdentity.ok;
    results.push({
      ...check,
      url,
      responseUrl: response.url,
      themeIdentity,
      status: response.status,
      cacheAt,
      marker: markers.foundMarkers.join(", ") || "-",
      ok,
      outcome: ok ? "passed" : "failed",
      error: ok
        ? ""
        : !themeIdentity.ok
          ? `wrong or absent theme assets: ${themeIdentity.themes.join(", ") || "none"}`
          : stalePageCache
            ? `page cache predates ${cacheFreshSinceArg}: ${cacheAt}`
            : !resource.ok
              ? resource.error
              : markers.ok
                ? `unexpected status ${response.status}; expected ${expectedStatus}`
                : check.match === "all"
                  ? markers.error || "required markers not found"
                  : "marker not found",
    });
  } catch (error) {
    results.push({
      ...check,
      url,
      status: "-",
      marker: "-",
      ok: false,
      outcome: "failed",
      error: error?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : error.message,
    });
  }
}

if (deepMode) {
  for (const check of deepApiChecks) {
    const url = resolveUrl(check.path);
    const coverage = pluginCoverage(check);
    if (coverage) {
      addUnexecutedResult(check, url, coverage);
      continue;
    }
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
        outcome: ok ? "passed" : "failed",
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
        outcome: "failed",
        error: error?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : error.message,
      });
    }
  }
}

const width = Math.max(...results.map((result) => result.name.length), 10);
const summary = {
  passed: results.filter((result) => result.outcome === "passed").length,
  failed: results.filter((result) => result.outcome === "failed").length,
  notApplicable: results.filter((result) => result.outcome === "not-applicable").length,
  notCovered: results.filter((result) => result.outcome === "not-covered").length,
  complete: !results.some((result) => result.outcome === "not-covered"),
};

if (reportPath) {
  let haloVersion = null;
  try {
    const response = await fetchWithTimeout(`${baseUrl}/v3/api-docs`);
    if (response.ok) haloVersion = (await response.json()).info?.version || null;
  } catch {
    /* Unknown remains unknown; never infer core version from a plugin. */
  }
  const codeAtEnd = themeCodeIdentity();
  const report = {
    schemaVersion: 2,
    startedAt,
    finishedAt: new Date().toISOString(),
    environment: { baseUrl, haloVersion, haloVersionSource: `${baseUrl}/v3/api-docs#/info/version` },
    theme: { ...codeAtEnd, unchangedDuringRun: codeAtStart.codeHash === codeAtEnd.codeHash },
    plugins: pluginStates ? [...pluginStates].map(([id, state]) => ({ id, ...state })) : null,
    pluginInventory: { verified: pluginStates != null, error: pluginInventory.error },
    scope:
      "Browser-like HTML Accept, Page Cache age, HTTP/API reads and rendered markers; not browser interaction or write workflows",
    deepMode,
    previewTheme: previewTheme || null,
    cacheFreshSince: cacheFreshSinceArg || null,
    summary,
    results: results.map(
      ({
        name,
        plugin,
        env,
        path,
        url,
        responseUrl,
        themeIdentity,
        status,
        ok,
        outcome,
        skipped = false,
        cacheAt = null,
        marker,
        error,
      }) => ({
        name,
        plugin: plugin || null,
        targetUrlEnv: env || null,
        path,
        requestedUrl: url,
        responseUrl,
        themeIdentity,
        status,
        ok,
        outcome,
        skipped,
        cacheAt,
        marker,
        error,
      }),
    ),
  };
  const destination = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`);
  if (!report.theme.unchangedDuringRun) {
    console.error("Theme code changed during smoke testing; rerun before using this evidence.");
    process.exit(1);
  }
}

console.log(`Plugin smoke base: ${baseUrl}`);
if (previewTheme) console.log(`Request-scoped theme preview: ${previewTheme}`);
console.log(
  "Plugin smoke scope: browser-like HTML response and rendered markers; PJAX requires real browser navigation",
);
if (cacheFreshSinceArg) console.log(`Page Cache must be refreshed since: ${cacheFreshSinceArg}`);
if (deepMode) {
  console.log("Plugin smoke mode: deep");
}
for (const result of results) {
  const icon = { "not-applicable": "SKIP", "not-covered": "NOT-COVERED", passed: "OK", failed: "FAIL" }[result.outcome];
  const name = result.name.padEnd(width, " ");
  const details = result.ok == null
    ? result.error
    : result.ok
      ? `status=${result.status} cacheAt=${result.cacheAt || "uncached"} marker=${result.marker}`
      : `status=${result.status} ${result.error}`;
  console.log(`${icon} ${name} ${result.path || `[${result.env}]`} ${details}`);
}

console.log(
  `Plugin smoke completed: passed=${summary.passed}; failed=${summary.failed}; not-applicable=${summary.notApplicable}; not-covered=${summary.notCovered}`,
);
if (summary.notCovered > 0) {
  console.log("Coverage is incomplete; not-covered checks are not passes or runtime compatibility evidence.");
}
if (summary.failed > 0) {
  console.error(`Plugin smoke failed: ${summary.failed}/${results.length}`);
  process.exit(1);
}
if (results.some((result) => result.runtimeIdentityMissing)) {
  console.error("Plugin runtime identity could not be verified; plugin checks remain not covered.");
  process.exit(2);
}
