const MANAGED_QUERY_KEYS = ["view", "scope", "groupName", "linkName", "itemId", "group", "link"];
const VALID_VIEWS = new Set(["friends", "apply", "board"]);
const VALID_SCOPES = new Set(["all", "unread", "favorite", "later"]);
const SAVED_SCOPES = new Set(["favorite", "later"]);
const PAGE_SIZE = 20;

export const LINK_FEED_API = "/apis/api.link.halo.run/v1alpha1/linkfeeds";
export const LINK_FEED_CONSOLE_API = "/apis/console.api.link.halo.run/v1alpha1/rss/items";
export const LINK_FEED_UNREAD_SUMMARY_API = `${LINK_FEED_CONSOLE_API}/-/unread-summary`;
export const LINK_DETAIL_API = "/apis/console.api.link.halo.run/v1alpha1/links/-/detail";
export const LINK_FEED_DISCOVERY_API = "/apis/console.api.link.halo.run/v1alpha1/rss/discovery";
export const LINK_CORE_API = "/apis/core.halo.run/v1alpha1/links";
export const CURRENT_USER_API = "/apis/api.console.halo.run/v1alpha1/users/-";
export const USER_PERMISSIONS_API = "/apis/api.console.halo.run/v1alpha1/users";
export { MANAGED_QUERY_KEYS, PAGE_SIZE };

function stringValue(value) {
  return String(value ?? "").trim();
}

function orderedState(source) {
  const state = {};
  for (const key of MANAGED_QUERY_KEYS) {
    const value = stringValue(source?.[key]);
    if (value) state[key] = value;
  }
  return state;
}

function catalogSet(value) {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value.map(stringValue).filter(Boolean));
  return new Set();
}

function linkCatalog(value) {
  if (value instanceof Map) return value;
  if (!Array.isArray(value)) return new Map();
  return new Map(
    value
      .map((item) => [stringValue(item?.key ?? item?.name), stringValue(item?.groupKey ?? item?.groupName)])
      .filter(([key]) => key),
  );
}

export function parseLinksState(source) {
  const base = globalThis.location?.origin || "https://theme.local";
  const url = source instanceof URL ? source : new URL(String(source || "/links"), base);
  const state = {};
  for (const key of MANAGED_QUERY_KEYS) {
    const value = stringValue(url.searchParams.get(key));
    if (value) state[key] = value;
  }
  return orderedState(state);
}

/**
 * 规范化 Links 管理的 7 个查询参数。context 中的目录来自 SSR DOM，
 * 因而可以在不猜测 Halo 资源名的前提下清理失效深链。
 */
export function normalizeLinksState(rawState = {}, context = {}) {
  const state = orderedState(rawState);
  const notes = [];
  const groups = catalogSet(context.groups);
  const links = linkCatalog(context.links);
  const feedGroups = catalogSet(context.feedGroups);
  const feedLinks = catalogSet(context.feedLinks);
  const validateGroups = context.groups !== undefined;
  const validateLinks = context.links !== undefined;
  const validateFeedGroups = context.feedGroups !== undefined;
  const validateFeedLinks = context.feedLinks !== undefined;

  if (state.view === "links") {
    delete state.view;
    notes.push("view=links 已还原为默认友链视图");
  } else if (state.view && !VALID_VIEWS.has(state.view)) {
    notes.push(`未知 view=${state.view} 已移除`);
    delete state.view;
  }

  const view = state.view || "links";
  if (view === "apply" || view === "board") {
    for (const key of MANAGED_QUERY_KEYS.slice(1)) {
      if (!state[key]) continue;
      notes.push(`${key} 不适用于 view=${view}，已移除`);
      delete state[key];
    }
    return { state: orderedState(state), notes };
  }

  if (view === "links") {
    for (const key of ["scope", "groupName", "linkName", "itemId"]) {
      if (!state[key]) continue;
      notes.push(`${key} 仅适用于 RSS 视图，已移除`);
      delete state[key];
    }
    if (state.group && validateGroups && !groups.has(state.group)) {
      notes.push(`分组 ${state.group} 不存在，已移除`);
      delete state.group;
    }
    if (state.link && validateLinks && !links.has(state.link)) {
      notes.push(`友链 ${state.link} 不存在，已移除`);
      delete state.link;
    }
    if (state.group && state.link && links.get(state.link) !== state.group) {
      notes.push(`友链不属于分组 ${state.group}，已保留 link 并移除 group`);
      delete state.group;
    }
    return { state: orderedState(state), notes };
  }

  for (const key of ["group", "link"]) {
    if (!state[key]) continue;
    notes.push(`${key} 不适用于 RSS 视图，已移除`);
    delete state[key];
  }
  if (state.scope && !VALID_SCOPES.has(state.scope)) {
    notes.push(`未知 scope=${state.scope} 已移除`);
    delete state.scope;
  }
  if (state.groupName && validateFeedGroups && !feedGroups.has(state.groupName)) {
    notes.push(`RSS 分组 ${state.groupName} 不存在，已移除`);
    delete state.groupName;
  }
  if (state.linkName && validateFeedLinks && !feedLinks.has(state.linkName)) {
    notes.push(`RSS 来源 ${state.linkName} 不存在，已移除`);
    delete state.linkName;
  }
  if (state.groupName && state.linkName) {
    notes.push("groupName 与 linkName 互斥，已保留 groupName");
    delete state.linkName;
  }
  if (state.groupName || state.linkName) {
    if (state.scope) notes.push("来源筛选与 scope 互斥，已移除 scope");
    delete state.scope;
  }
  if (state.itemId && !state.scope && !state.groupName && !state.linkName) {
    notes.push("孤立的 itemId 已移除");
    delete state.itemId;
  }
  if (context.canReadFeed === false) {
    if (SAVED_SCOPES.has(state.scope)) {
      notes.push(`scope=${state.scope} 需要 RSS 查看权限，已回退到全部动态`);
      state.scope = "all";
    }
    if (state.itemId) {
      notes.push("RSS 内部详情需要 RSS 查看权限，已移除 itemId");
      delete state.itemId;
    }
  }
  return { state: orderedState(state), notes };
}

export function applyLinksStateToUrl(source, state) {
  const base = globalThis.location?.origin || "https://theme.local";
  const url = source instanceof URL ? new URL(source.href) : new URL(String(source || "/links"), base);
  for (const key of MANAGED_QUERY_KEYS) url.searchParams.delete(key);
  const normalized = orderedState(state);
  for (const key of MANAGED_QUERY_KEYS) {
    if (normalized[key]) url.searchParams.set(key, normalized[key]);
  }
  return url;
}

export function normalizeLinksUrl(source, context = {}) {
  const base = globalThis.location?.origin || "https://theme.local";
  const input = source instanceof URL ? new URL(source.href) : new URL(String(source || "/links"), base);
  const result = normalizeLinksState(parseLinksState(input), context);
  return { ...result, url: applyLinksStateToUrl(input, result.state) };
}

export function historyPath(url) {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function normalizeHttpUrl(value) {
  try {
    const url = new URL(stringValue(value));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function decodeEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return String(value ?? "")
    .replace(/&#(x[\da-f]+|\d+);/gi, (match, code) => {
      const hex = String(code).toLowerCase().startsWith("x");
      const point = Number.parseInt(hex ? String(code).slice(1) : String(code), hex ? 16 : 10);
      if (!Number.isFinite(point) || point < 0 || point > 0x10ffff) return match;
      try {
        return String.fromCodePoint(point);
      } catch {
        return match;
      }
    })
    .replace(/&(amp|apos|gt|lt|nbsp|quot);/gi, (match, name) => named[name.toLowerCase()] || match);
}

export function sanitizePlainText(value, maxLength = 0) {
  const text = decodeEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
  return maxLength > 0 ? text.slice(0, maxLength) : text;
}

export function buildCsrfHeaders(cookie = globalThis.document?.cookie || "") {
  const match = String(cookie).match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  if (!match?.[1]) return {};
  let token = match[1];
  try {
    token = decodeURIComponent(token);
  } catch {
    // 异常值交给 Halo 的 CSRF 校验拒绝。
  }
  return { "X-XSRF-TOKEN": token };
}

export function buildLinkFeedApiUrl(
  {
    groupName = "",
    linkName = "",
    scope = "all",
    protectedMode = false,
    beforePublishedAt = "",
    beforeId = "",
    limit = PAGE_SIZE,
  } = {},
  baseUrl = globalThis.location?.origin || "http://localhost",
) {
  const url = new URL(protectedMode ? LINK_FEED_CONSOLE_API : LINK_FEED_API, baseUrl);
  const resolvedGroup = stringValue(groupName);
  const resolvedLink = resolvedGroup ? "" : stringValue(linkName);
  const resolvedScope = VALID_SCOPES.has(scope) ? scope : "all";
  const resolvedLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || PAGE_SIZE));
  if (resolvedGroup) url.searchParams.set("groupName", resolvedGroup);
  if (resolvedLink) url.searchParams.set("linkName", resolvedLink);
  if (protectedMode && resolvedScope === "unread") url.searchParams.set("read", "false");
  if (protectedMode && resolvedScope === "favorite") url.searchParams.set("favorite", "true");
  if (protectedMode && resolvedScope === "later") url.searchParams.set("readLater", "true");
  if (beforePublishedAt) url.searchParams.set("beforePublishedAt", stringValue(beforePublishedAt));
  if (beforeId) url.searchParams.set("beforeId", stringValue(beforeId));
  url.searchParams.set("limit", String(resolvedLimit));
  return url;
}

export function normalizeLinkFeedPage(payload = {}) {
  const items = (Array.isArray(payload.items) ? payload.items : [])
    .map((item) => ({
      id: stringValue(item?.id),
      linkName: stringValue(item?.linkName),
      url: normalizeHttpUrl(item?.url),
      title: sanitizePlainText(item?.title, 300),
      summary: sanitizePlainText(item?.summary, 2000),
      author: sanitizePlainText(item?.author, 160),
      authorUrl: normalizeHttpUrl(item?.authorUrl),
      authorLogo: normalizeHttpUrl(item?.authorLogo),
      publishedAt: stringValue(item?.publishedAt),
      fetchedAt: stringValue(item?.fetchedAt),
      updatedAt: stringValue(item?.updatedAt),
      read: item?.read === true,
      favorite: item?.favorite === true,
      readLater: item?.readLater === true,
    }))
    .filter((item) => item.id && item.url);
  const nextBeforePublishedAt = stringValue(payload.nextBeforePublishedAt);
  const nextBeforeId = stringValue(payload.nextBeforeId);
  return {
    items,
    nextBeforePublishedAt,
    nextBeforeId,
    hasNext: payload.hasNext === true && Boolean(nextBeforePublishedAt || nextBeforeId),
  };
}

export function normalizeLinkCapabilities(payload = {}, user = null) {
  const uiPermissions = new Set(
    (Array.isArray(payload.uiPermissions) ? payload.uiPermissions : []).map(stringValue).filter(Boolean),
  );
  const roles = new Set(
    (Array.isArray(payload.permissions) ? payload.permissions : [])
      .map((role) => stringValue(role?.metadata?.name ?? role?.name))
      .filter(Boolean),
  );
  const canManage = uiPermissions.has("plugin:links:manage") || roles.has("role-template-link-manage");
  return {
    authenticated: Boolean(user),
    username: stringValue(user?.metadata?.name),
    canReadFeed: canManage || uiPermissions.has("plugin:links:view") || roles.has("role-template-link-view"),
    canManage,
  };
}

export function buildPluginLinkPayload(form = {}) {
  const spec = {
    url: normalizeHttpUrl(form.url),
    displayName: sanitizePlainText(form.displayName, 120),
    description: sanitizePlainText(form.description, 500),
  };
  const logo = normalizeHttpUrl(form.logo);
  const rssUrl = normalizeHttpUrl(form.rssUrl);
  const groupName = stringValue(form.groupName);
  if (logo) spec.logo = logo;
  if (groupName) spec.groupName = groupName;
  if (rssUrl) spec.rss = { enabled: true, feedUrls: [rssUrl] };
  return {
    apiVersion: "core.halo.run/v1alpha1",
    kind: "Link",
    metadata: { name: "", generateName: "link-", annotations: {} },
    spec,
  };
}

function feedKey({ groupName = "", linkName = "", scope = "all", protectedMode = false } = {}) {
  const mode = protectedMode ? "console" : "public";
  if (groupName) return `${mode}:group:${groupName}`;
  if (linkName) return `${mode}:link:${linkName}`;
  return `${mode}:${VALID_SCOPES.has(scope) ? scope : "all"}`;
}

function safeJsonResponse(response) {
  return String(response?.headers?.get?.("content-type") || "")
    .toLowerCase()
    .includes("json");
}

async function responseMessage(response) {
  try {
    const value = await response.clone().json();
    return stringValue(value?.detail || value?.message || value?.title);
  } catch {
    try {
      return stringValue(await response.text());
    } catch {
      return "";
    }
  }
}

function httpError(response, message = "") {
  const error = new Error(message || `HTTP ${response?.status || 0}`);
  error.status = Number(response?.status || 0);
  return error;
}

function formatFeedFailure(error) {
  const status = Number(error?.status || 0);
  if (status === 404) return "站点尚未在 PluginLinks 中开启公开 RSS 订阅动态。";
  if (status === 429) return "动态请求过于频繁，请稍后重试。";
  if (status >= 500) return "动态服务暂时不可用，请稍后重试。";
  return sanitizePlainText(error?.message) || "动态加载失败，请检查网络后重试。";
}

function timeoutController(timeoutMs, parentSignal) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(new DOMException("请求超时", "TimeoutError")),
    timeoutMs,
  );
  parentSignal?.addEventListener("abort", () => controller.abort(parentSignal.reason), { once: true });
  return { controller, dispose: () => globalThis.clearTimeout(timeout) };
}

function metadataValue(documentNode, selectors) {
  for (const selector of selectors) {
    const node = documentNode.querySelector(selector);
    const raw = node?.getAttribute?.("content") || node?.getAttribute?.("href") || node?.textContent || "";
    const value = sanitizePlainText(raw);
    if (value) return value;
  }
  return "";
}

function resolveMetadataUrl(value, baseUrl) {
  try {
    const url = new URL(stringValue(value), baseUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function parseSiteMetadata(html, baseUrl) {
  if (typeof DOMParser === "undefined") throw new Error("当前浏览器不支持网页元数据解析");
  const documentNode = new DOMParser().parseFromString(String(html || ""), "text/html");
  const generator = metadataValue(documentNode, ['meta[name="generator"]']);
  const normalizedGenerator = generator.toLowerCase();
  const platforms = ["Halo", "WordPress", "Typecho", "Hexo", "Hugo", "Ghost"];
  const platform = platforms.find((name) => normalizedGenerator.includes(name.toLowerCase())) || generator.slice(0, 80);
  return {
    title: metadataValue(documentNode, ['meta[property="og:title"]', 'meta[name="twitter:title"]', "title"]).slice(
      0,
      120,
    ),
    description: metadataValue(documentNode, [
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]',
    ]).slice(0, 500),
    logo: resolveMetadataUrl(
      metadataValue(documentNode, [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'link[rel~="apple-touch-icon"]',
        'link[rel~="icon"]',
      ]),
      baseUrl,
    ),
    rssUrl: resolveMetadataUrl(
      metadataValue(documentNode, [
        'link[rel="alternate"][type="application/rss+xml"]',
        'link[rel="alternate"][type="application/atom+xml"]',
      ]),
      baseUrl,
    ),
    platform,
  };
}

async function fetchPublicSiteMetadata(url, signal) {
  const target = new URL(url);
  if (globalThis.location?.protocol === "https:" && target.protocol === "http:") {
    const error = new Error("mixed-content");
    error.code = "mixed-content";
    throw error;
  }
  const response = await fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    redirect: "follow",
    referrerPolicy: "no-referrer",
    headers: { Accept: "text/html,application/xhtml+xml" },
    signal,
  });
  if (!response.ok || response.type === "opaque" || response.status === 0) {
    const error = httpError(response);
    error.code = "request-failed";
    throw error;
  }
  const type = String(response.headers.get("content-type") || "").toLowerCase();
  if (type && !type.includes("text/html") && !type.includes("application/xhtml+xml")) {
    const error = new Error("目标地址没有返回 HTML");
    error.code = "not-html";
    throw error;
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > 1_500_000) {
    const error = new Error("目标网页内容过大");
    error.code = "too-large";
    throw error;
  }
  const html = await response.text();
  if (new Blob([html]).size > 1_500_000) {
    const error = new Error("目标网页内容过大");
    error.code = "too-large";
    throw error;
  }
  const metadata = parseSiteMetadata(html, normalizeHttpUrl(response.url) || url);
  if (!metadata.title && !metadata.description && !metadata.logo && !metadata.rssUrl && !metadata.platform) {
    const error = new Error("没有找到可识别的站点信息");
    error.code = "empty";
    throw error;
  }
  return metadata;
}

async function fetchOfficialSiteMetadata(url, signal) {
  const detailUrl = new URL(LINK_DETAIL_API, window.location.origin);
  detailUrl.searchParams.set("url", url);
  const discoveryUrl = new URL(LINK_FEED_DISCOVERY_API, window.location.origin);
  discoveryUrl.searchParams.set("url", url);
  const request = async (requestUrl) => {
    const response = await fetch(requestUrl, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) throw httpError(response, await responseMessage(response));
    if (!safeJsonResponse(response)) throw httpError(response, "官方识别接口没有返回 JSON");
    return response.json();
  };
  const [detailResult, discoveryResult] = await Promise.allSettled([request(detailUrl), request(discoveryUrl)]);
  if (detailResult.status === "rejected") throw detailResult.reason;
  const detail = detailResult.value || {};
  const feeds =
    discoveryResult.status === "fulfilled" && Array.isArray(discoveryResult.value?.feedUrls)
      ? discoveryResult.value.feedUrls.map(normalizeHttpUrl).filter(Boolean)
      : [];
  return {
    title: sanitizePlainText(detail.title, 120),
    description: sanitizePlainText(detail.description, 500),
    logo: normalizeHttpUrl(detail.icon) || normalizeHttpUrl(detail.image),
    rssUrl: feeds[0] || "",
    platform: "PluginLinks 官方识别",
    discoveryFailed: discoveryResult.status === "rejected",
  };
}

function formatMetadataFailure(error) {
  if (error?.code === "mixed-content") return "HTTPS 页面不能读取 HTTP 站点";
  if (error?.code === "not-html") return "目标地址没有返回可识别的网页";
  if (error?.code === "too-large") return "目标网页内容过大，已停止识别";
  if (error?.name === "TimeoutError" || error?.code === "timeout") return "目标站点响应超时";
  return "目标站点的跨域或访问策略阻止了浏览器识别";
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.insetInlineStart = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function gatherRouteContext(root, canReadFeed) {
  const groups = new Set(
    Array.from(root.querySelectorAll("[data-link-group-section]"), (node) => node.dataset.linkGroupSection).filter(
      Boolean,
    ),
  );
  const links = new Map(
    Array.from(root.querySelectorAll("[data-link-card]"), (node) => [
      node.dataset.linkKey,
      node.dataset.linkGroup,
    ]).filter(([key]) => key),
  );
  const feedGroups = new Set(
    Array.from(root.querySelectorAll("[data-feed-group-key]"), (node) => node.dataset.feedGroupKey).filter(Boolean),
  );
  const feedLinks = new Set(
    Array.from(root.querySelectorAll("[data-feed-source]"), (node) => node.dataset.feedLinkKey).filter(Boolean),
  );
  return { groups, links, feedGroups, feedLinks, canReadFeed };
}

function readLinkCatalog(root) {
  return new Map(
    Array.from(root.querySelectorAll("[data-link-card]"), (node) => [
      node.dataset.linkKey,
      {
        key: node.dataset.linkKey,
        groupKey: node.dataset.linkGroup,
        groupLabel: sanitizePlainText(node.dataset.linkGroupLabel),
        name: sanitizePlainText(node.dataset.linkName),
        description: sanitizePlainText(node.dataset.linkDescription),
        url: normalizeHttpUrl(node.dataset.linkUrl),
        logo: normalizeHttpUrl(node.dataset.linkLogo),
        rssUrl: normalizeHttpUrl(node.dataset.linkRss),
        accessState: stringValue(node.dataset.linkAccessState),
        backlinkState: stringValue(node.dataset.linkBacklinkState),
      },
    ]).filter(([key]) => key),
  );
}

function readFeedSources(root) {
  return new Map(
    Array.from(root.querySelectorAll("[data-feed-source]"), (node) => [
      node.dataset.feedLinkKey,
      {
        key: node.dataset.feedLinkKey,
        groupKey: node.dataset.feedGroup,
        groupLabel: sanitizePlainText(node.dataset.feedGroupLabel),
        name: sanitizePlainText(node.dataset.feedLinkLabel),
        description: sanitizePlainText(node.dataset.feedLinkDescription),
        url: normalizeHttpUrl(node.dataset.feedLinkUrl),
        logo: normalizeHttpUrl(node.dataset.feedLinkLogo),
      },
    ]).filter(([key]) => key),
  );
}

function readPrefetchedFeed(root) {
  const items = Array.from(root.querySelectorAll("[data-feed-prefetch-item]"), (node) => ({
    id: stringValue(node.dataset.feedId),
    linkName: stringValue(node.dataset.feedLinkName),
    url: normalizeHttpUrl(node.dataset.feedUrl),
    title: sanitizePlainText(node.dataset.feedTitle, 300),
    summary: sanitizePlainText(node.dataset.feedSummary, 2000),
    author: sanitizePlainText(node.dataset.feedAuthor, 160),
    authorUrl: normalizeHttpUrl(node.dataset.feedAuthorUrl),
    authorLogo: normalizeHttpUrl(node.dataset.feedAuthorLogo),
    publishedAt: stringValue(node.dataset.feedPublishedAt),
    fetchedAt: stringValue(node.dataset.feedFetchedAt),
    updatedAt: stringValue(node.dataset.feedUpdatedAt),
    read: node.dataset.feedRead === "true",
    favorite: node.dataset.feedFavorite === "true",
    readLater: node.dataset.feedReadLater === "true",
  })).filter((item) => item.id && item.url);
  return {
    key: stringValue(root.dataset.feedPrefetchKey),
    items,
    hasNext: root.dataset.feedPrefetchHasNext === "true",
    nextBeforePublishedAt: stringValue(root.dataset.feedPrefetchNextPublishedAt),
    nextBeforeId: stringValue(root.dataset.feedPrefetchNextId),
  };
}

function routeFeedRequest(state, capabilities) {
  if (state.view !== "friends") return null;
  const protectedMode = capabilities.canReadFeed === true;
  const requestedScope = state.scope || "all";
  const fallbackUnread = requestedScope === "unread" && !protectedMode;
  return {
    groupName: state.groupName || "",
    linkName: state.linkName || "",
    scope: fallbackUnread ? "all" : requestedScope,
    protectedMode,
    fallbackUnread,
  };
}

function icon(className) {
  const node = document.createElement("span");
  node.className = className;
  node.setAttribute("aria-hidden", "true");
  return node;
}

function externalLink(href, className = "") {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = className;
  return link;
}

export function mountLinksApp() {
  const root = document.querySelector("[data-links-page]");
  if (!root) return undefined;

  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const links = readLinkCatalog(root);
  const feedSources = readFeedSources(root);
  const prefetched = readPrefetchedFeed(root);
  const panels = Array.from(root.querySelectorAll("[data-links-view-panel]"));
  const tabs = Array.from(root.querySelectorAll("[data-links-view-link]"));
  const pageTitle = root.querySelector("[data-links-page-title]");
  const pageDescription = root.querySelector("[data-links-page-description]");
  const defaultTitle = pageTitle?.textContent?.trim() || "友情链接";
  const defaultDescription = pageDescription?.textContent?.trim() || "感谢这些优秀的网站与博客";
  const titles = {
    links: defaultTitle,
    friends: "友链动态",
    apply: "申请友链",
  };
  const descriptions = {
    links: defaultDescription,
    friends: "来自友链接阅的最新内容，支持未读、收藏与稍后阅读",
    apply: "提交站点信息，管理员审核后将出现在友链列表中",
  };
  const feed = {
    key: prefetched.key,
    items: prefetched.items,
    hasNext: prefetched.hasNext,
    nextBeforePublishedAt: prefetched.nextBeforePublishedAt,
    nextBeforeId: prefetched.nextBeforeId,
    status: prefetched.key ? (prefetched.items.length ? "ready" : "empty") : "idle",
    message: "",
    replacing: false,
    controller: null,
    generation: 0,
  };
  const capabilities = {
    status: "checking",
    authenticated: false,
    canReadFeed: false,
    canManage: false,
    username: "",
    error: "",
  };
  const state = {
    route: {},
    capabilityPromise: null,
    unreadCount: 0,
    feedActionBusy: new Set(),
    autoMarked: new Set(),
    identifyController: null,
    dialogSync: false,
    boardFocusTimer: 0,
  };

  const routeContext = () =>
    gatherRouteContext(root, capabilities.status === "checking" ? undefined : capabilities.canReadFeed);

  function toast(message, type = "info") {
    const container = root.querySelector("[data-links-toast]");
    if (!container || !message) return;
    const alert = document.createElement("div");
    alert.className = `links-toast alert ${type === "error" ? "alert-error" : type === "success" ? "alert-success" : "alert-info"}`;
    alert.setAttribute("role", type === "error" ? "alert" : "status");
    alert.textContent = message;
    container.appendChild(alert);
    globalThis.setTimeout(() => {
      alert.classList.add("is-leaving");
      globalThis.setTimeout(() => alert.remove(), 240);
    }, 3600);
  }

  function normalizeLocation({ announce = false } = {}) {
    const current = new URL(window.location.href);
    const result = normalizeLinksUrl(current, routeContext());
    if (historyPath(current) !== historyPath(result.url)) {
      window.history.replaceState(window.history.state, "", historyPath(result.url));
    }
    state.route = result.state;
    if (announce) result.notes.forEach((note) => toast(note));
    return result;
  }

  function focusBoard({ smooth = false } = {}) {
    const board = root.querySelector("#links-comments");
    if (!board) return;
    requestAnimationFrame(() => {
      board.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      board.classList.add("links-board-focus");
      globalThis.clearTimeout(state.boardFocusTimer);
      state.boardFocusTimer = globalThis.setTimeout(() => board.classList.remove("links-board-focus"), 1600);
    });
  }

  function commitRoute(nextState, { replace = false, scroll = false, announce = true } = {}) {
    const result = normalizeLinksState(nextState, routeContext());
    const url = applyLinksStateToUrl(new URL(window.location.href), result.state);
    const nextPath = historyPath(url);
    const currentPath = historyPath(new URL(window.location.href));
    if (nextPath !== currentPath) {
      window.history[replace ? "replaceState" : "pushState"](window.history.state, "", nextPath);
    }
    state.route = result.state;
    if (announce) result.notes.forEach((note) => toast(note));
    render();
    if (scroll) {
      if (result.state.view === "board") focusBoard({ smooth: true });
      else requestAnimationFrame(() => root.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function navigate(patch, options = {}) {
    const next = { ...state.route };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === null || value === "") delete next[key];
      else next[key] = String(value);
    }
    commitRoute(next, options);
  }

  function renderPanels() {
    const view = state.route.view === "board" ? "links" : state.route.view || "links";
    root.dataset.linksActiveView = view;
    for (const panel of panels) panel.hidden = panel.dataset.linksViewPanel !== view;
    for (const tab of tabs) {
      const active = tab.dataset.linksViewLink === view;
      tab.classList.toggle("links-filter-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    }
    if (pageTitle) pageTitle.textContent = titles[view] || defaultTitle;
    if (pageDescription) pageDescription.textContent = descriptions[view];
  }

  function renderLinksView() {
    const selectedGroup = state.route.group || "";
    const selectedLink = state.route.link || "";
    for (const filter of root.querySelectorAll("[data-link-group-filter]")) {
      const key = filter.dataset.linkGroupFilter === "all" ? "" : filter.dataset.linkGroupFilter;
      const active = key === selectedGroup;
      filter.classList.toggle("links-filter-active", active);
      if (active) filter.setAttribute("aria-current", "page");
      else filter.removeAttribute("aria-current");
    }
    for (const section of root.querySelectorAll("[data-link-group-section]")) {
      section.hidden = Boolean(selectedGroup && section.dataset.linkGroupSection !== selectedGroup);
    }
    for (const card of root.querySelectorAll("[data-link-card]")) {
      card.classList.toggle("links-card-active", card.dataset.linkKey === selectedLink);
    }
    const dynamicEmpty = root.querySelector("[data-links-filter-empty]");
    if (dynamicEmpty) {
      const hasSelectedSection = !selectedGroup || routeContext().groups.has(selectedGroup);
      dynamicEmpty.hidden = hasSelectedSection;
    }
    syncLinkDialog();
  }

  function activeFeedRequest() {
    return routeFeedRequest(state.route, capabilities);
  }

  function renderCapability() {
    const status = root.querySelector("[data-links-capability-status]");
    const statusCopy = status?.querySelector("[data-links-capability-copy]");
    const protectedControls = root.querySelectorAll("[data-links-protected-control]");
    for (const control of protectedControls) control.hidden = !capabilities.canReadFeed;
    if (!status) return;
    status.className =
      "links-capability btn btn-sm border-base-content/10 text-base-content/40 shrink-0 cursor-default rounded-full border-dashed";
    if (capabilities.status === "checking") {
      status.hidden = false;
      if (statusCopy) statusCopy.textContent = "正在确认登录状态…";
    } else if (capabilities.canReadFeed) {
      status.hidden = true;
    } else if (capabilities.status === "error") {
      status.hidden = false;
      if (statusCopy) statusCopy.textContent = "权限检查失败，当前仅浏览公开动态";
    } else {
      status.hidden = false;
      if (statusCopy) statusCopy.textContent = "登录后可用未读 / 收藏 / 稍后阅读";
    }
  }

  function renderFeedView() {
    const request = activeFeedRequest();
    renderCapability();
    const activeScope = state.route.scope || (!state.route.groupName && !state.route.linkName ? "all" : "");
    for (const button of root.querySelectorAll("[data-feed-scope]")) {
      button.classList.toggle("links-filter-active", button.dataset.feedScope === activeScope);
    }
    for (const node of root.querySelectorAll("[data-feed-group-action]")) {
      node.classList.toggle("links-filter-active", node.dataset.feedGroupAction === state.route.groupName);
    }
    for (const node of root.querySelectorAll("[data-feed-source]")) {
      node.classList.toggle("links-card-active", node.dataset.feedLinkKey === state.route.linkName);
    }
    const unreadBadge = root.querySelector("[data-feed-unread-count]");
    if (unreadBadge) {
      unreadBadge.hidden = !capabilities.canReadFeed || state.unreadCount < 1;
      unreadBadge.textContent = state.unreadCount > 99 ? "99+" : String(state.unreadCount);
    }
    const groupSelect = root.querySelector("[data-feed-filter-group]");
    const sourceSelect = root.querySelector("[data-feed-filter-source]");
    if (groupSelect) groupSelect.value = state.route.groupName || "";
    if (sourceSelect) sourceSelect.value = state.route.linkName || "";
    renderFeedResults(request);
    ensureFeed(request);
  }

  function renderApplyCapability() {
    const capability = root.querySelector("[data-apply-capability]");
    const form = root.querySelector("[data-link-apply-form]");
    const primaryLabel = form?.querySelector("[data-apply-submit-label]");
    const actionHint = form?.querySelector("[data-apply-action-hint]");
    const type = form ? new FormData(form).get("type") || "add" : "add";
    if (capability) {
      capability.textContent =
        capabilities.status === "checking"
          ? "正在确认可用的识别与提交方式…"
          : capabilities.canManage && type === "add"
            ? "管理员模式：使用官方识别接口辅助填充，提交后直接创建 Link 资源。"
            : type === "update"
              ? "更新申请：生成 Markdown 后到留言板提交，由管理员审核修改。"
              : "公开识别（降级方案）：匿名跨域 GET 识别站点信息，最长 8 秒、最大 1.5MB、仅支持 HTML/XHTML；识别失败时可手动填写。提交后生成 Markdown，复制到留言板完成申请。";
    }
    if (primaryLabel)
      primaryLabel.textContent = capabilities.canManage && type === "add" ? "直接创建 Link" : "生成申请 Markdown";
    if (actionHint)
      actionHint.textContent =
        capabilities.canManage && type === "add"
          ? "plugin:links:manage · 直接写入 Link 资源"
          : "生成 Markdown 后到留言板提交，等待管理员审核";
    const updateField = form?.querySelector("[data-apply-update-field]");
    if (updateField) updateField.hidden = type !== "update";
  }

  function render() {
    renderPanels();
    const view = state.route.view === "board" ? "links" : state.route.view || "links";
    if (view === "links") renderLinksView();
    else if (view === "friends") renderFeedView();
    else {
      syncLinkDialog();
      syncFeedDialog(null);
    }
    renderApplyCapability();
  }

  async function resolveCapabilities() {
    if (state.capabilityPromise) return state.capabilityPromise;
    state.capabilityPromise = (async () => {
      const task = timeoutController(6000, signal);
      try {
        const userResponse = await fetch(CURRENT_USER_API, {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: task.controller.signal,
        });
        if (userResponse.status === 401 || userResponse.status === 403 || userResponse.redirected) return null;
        if (!userResponse.ok) throw httpError(userResponse, await responseMessage(userResponse));
        if (!safeJsonResponse(userResponse)) throw httpError(userResponse, "当前用户接口没有返回 JSON");
        const payload = await userResponse.json();
        const user = payload?.user || payload;
        const username = stringValue(user?.metadata?.name);
        if (!username || username === "anonymousUser" || user?.spec?.disabled === true) return null;
        const permissionUrl = new URL(
          `${USER_PERMISSIONS_API}/${encodeURIComponent(username)}/permissions`,
          window.location.origin,
        );
        const permissionResponse = await fetch(permissionUrl, {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: task.controller.signal,
        });
        if (!permissionResponse.ok) throw httpError(permissionResponse, await responseMessage(permissionResponse));
        if (!safeJsonResponse(permissionResponse)) throw httpError(permissionResponse, "权限接口没有返回 JSON");
        return normalizeLinkCapabilities(await permissionResponse.json(), user);
      } finally {
        task.dispose();
      }
    })();
    try {
      const result = await state.capabilityPromise;
      if (signal.aborted) return;
      Object.assign(capabilities, result || normalizeLinkCapabilities({}, null), {
        status: result?.authenticated ? "ready" : "guest",
        error: "",
      });
      const normalized = normalizeLinksState(state.route, routeContext());
      if (JSON.stringify(normalized.state) !== JSON.stringify(state.route)) {
        commitRoute(normalized.state, { replace: true });
      } else {
        render();
      }
      if (capabilities.canReadFeed) refreshUnreadCount();
      const request = activeFeedRequest();
      if (request && (capabilities.canReadFeed || feed.key !== feedKey(request))) {
        loadFeed(request, { replace: true, force: true });
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      Object.assign(capabilities, {
        status: Number(error?.status || 0) === 403 ? "denied" : "error",
        authenticated: Number(error?.status || 0) !== 401,
        canReadFeed: false,
        canManage: false,
        error: error?.message || String(error),
      });
      const normalized = normalizeLinksState(state.route, routeContext());
      commitRoute(normalized.state, { replace: true, announce: false });
      const request = activeFeedRequest();
      if (request) loadFeed(request, { replace: true, force: true });
    } finally {
      state.capabilityPromise = null;
    }
  }

  async function refreshUnreadCount() {
    if (!capabilities.canReadFeed) return;
    try {
      const response = await fetch(LINK_FEED_UNREAD_SUMMARY_API, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) throw httpError(response, await responseMessage(response));
      const payload = await response.json();
      state.unreadCount = Math.max(0, Number(payload?.totalUnreadCount || 0));
      render();
    } catch (error) {
      if (error?.name !== "AbortError" && [401, 403].includes(Number(error?.status || 0))) {
        capabilities.canReadFeed = false;
        capabilities.canManage = false;
      }
    }
  }

  function ensureFeed(request) {
    if (capabilities.status === "checking" && ["unread", "favorite", "later"].includes(state.route.scope)) {
      feed.status = "permission";
      renderFeedResults(request);
      return;
    }
    const key = feedKey(request);
    if (feed.key === key && ["ready", "empty", "loading", "disabled"].includes(feed.status)) return;
    loadFeed(request, { replace: true });
  }

  async function loadFeed(request, { replace = true, force = false } = {}) {
    const key = feedKey(request);
    if (!force && feed.key === key && feed.status === "loading") return;
    feed.controller?.abort();
    const controller = new AbortController();
    signal.addEventListener("abort", () => controller.abort(), { once: true });
    feed.controller = controller;
    const generation = ++feed.generation;
    const append = !replace;
    feed.replacing = replace;
    feed.status = "loading";
    feed.message = "";
    if (replace) {
      feed.key = key;
      feed.items = [];
      feed.hasNext = false;
      feed.nextBeforePublishedAt = "";
      feed.nextBeforeId = "";
    }
    renderFeedResults(request);
    const url = buildLinkFeedApiUrl({
      ...request,
      beforePublishedAt: append ? feed.nextBeforePublishedAt : "",
      beforeId: append ? feed.nextBeforeId : "",
      limit: PAGE_SIZE,
    });
    try {
      const response = await fetch(url, {
        credentials: request.protectedMode ? "same-origin" : "omit",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw httpError(response, await responseMessage(response));
      if (!safeJsonResponse(response)) throw httpError(response, "动态接口没有返回 JSON");
      const page = normalizeLinkFeedPage(await response.json());
      if (generation !== feed.generation || signal.aborted) return;
      const seen = new Set(append ? feed.items.map((item) => item.id) : []);
      feed.items = append ? feed.items.concat(page.items.filter((item) => !seen.has(item.id))) : page.items;
      feed.hasNext = page.hasNext;
      feed.nextBeforePublishedAt = page.nextBeforePublishedAt;
      feed.nextBeforeId = page.nextBeforeId;
      feed.status = feed.items.length ? "ready" : "empty";
      feed.message = "";
      if (state.route.itemId && !feed.items.some((item) => item.id === state.route.itemId)) {
        navigate({ itemId: null }, { replace: true, announce: false });
        toast("目标动态不在当前加载结果中，已关闭内部详情");
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (generation !== feed.generation) return;
      feed.status = Number(error?.status || 0) === 404 ? "disabled" : "error";
      feed.message = formatFeedFailure(error);
      if (request.protectedMode && [401, 403].includes(Number(error?.status || 0))) {
        capabilities.canReadFeed = false;
        capabilities.canManage = false;
        capabilities.status = Number(error.status) === 401 ? "guest" : "denied";
        normalizeLocation();
        const fallback = activeFeedRequest();
        if (fallback) return loadFeed(fallback, { replace: true, force: true });
      }
    } finally {
      if (generation === feed.generation) {
        feed.replacing = false;
        if (feed.controller === controller) feed.controller = null;
        renderFeedResults(activeFeedRequest());
      }
    }
  }

  function renderFeedResults(request) {
    const list = root.querySelector("[data-feed-list]");
    const statePanel = root.querySelector("[data-feed-state]");
    const stateTitle = statePanel?.querySelector("[data-feed-state-title]");
    const stateDescription = statePanel?.querySelector("[data-feed-state-description]");
    const retry = statePanel?.querySelector("[data-feed-retry]");
    const title = root.querySelector("[data-feed-results-title]");
    const subtitle = root.querySelector("[data-feed-results-description]");
    const loadMore = root.querySelector("[data-feed-load-more]");
    if (!request) {
      if (list) list.replaceChildren();
      syncFeedDialog(null);
      return;
    }

    if (title) title.textContent = "友链动态";
    if (subtitle) subtitle.textContent = "来自友链公开订阅的最近更新";

    const showState =
      ["permission", "error", "disabled", "empty"].includes(feed.status) ||
      (feed.status === "loading" && feed.replacing && feed.items.length === 0);
    if (statePanel) statePanel.hidden = !showState;
    if (list) list.hidden = showState && feed.items.length === 0;
    if (showState) {
      let panelTitle = "正在加载动态";
      let panelDescription = "正在获取最新内容，请稍候。";
      if (feed.status === "permission") {
        panelTitle = "正在确认 RSS 权限";
        panelDescription = "个人未读、收藏与稍后阅读只会在权限确认后请求。";
      } else if (feed.status === "empty") {
        panelTitle = "暂无动态";
        panelDescription = "当前筛选条件下没有可展示的 RSS 内容。";
      } else if (feed.status === "disabled") {
        panelTitle = "公开动态未启用";
        panelDescription = feed.message;
      } else if (feed.status === "error") {
        panelTitle = "动态加载失败";
        panelDescription = feed.message;
      }
      if (stateTitle) stateTitle.textContent = panelTitle;
      if (stateDescription) stateDescription.textContent = panelDescription;
      if (retry) retry.hidden = !["error", "disabled"].includes(feed.status);
    }
    if (list && (!showState || feed.items.length)) {
      list.replaceChildren(...feed.items.map((item) => createFeedRow(item, request)));
      list.hidden = false;
    }
    if (loadMore) {
      loadMore.hidden = feed.status !== "ready" || !feed.hasNext;
      loadMore.disabled = feed.status === "loading";
      loadMore.textContent = feed.status === "loading" && !feed.replacing ? "正在加载…" : "加载更多";
    }
    syncFeedDialog(request);
  }

  function createFeedRow(item, request) {
    const row = document.createElement("li");
    row.className =
      "links-feed-row list-row border-base-content/[0.06] cursor-pointer border-b transition-colors last:border-b-0 hover:bg-base-content/[0.03]";
    row.dataset.feedItem = "";
    row.dataset.feedId = item.id;
    row.classList.toggle("links-feed-active", state.route.itemId === item.id);

    const avatar = document.createElement("div");
    avatar.className = "bg-base-200/60 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl";
    if (item.authorLogo) {
      const image = document.createElement("img");
      image.src = item.authorLogo;
      image.alt = "";
      image.loading = "lazy";
      image.className = "h-full w-full object-cover";
      avatar.appendChild(image);
    } else {
      avatar.appendChild(icon("icon-[heroicons--rss] text-base-content/30 h-5 w-5"));
    }

    const copy = document.createElement("div");
    copy.className = "list-col-grow min-w-0";
    const titleLine = document.createElement("div");
    titleLine.className = "flex items-center gap-2";
    if (!item.read) {
      const unread = document.createElement("span");
      unread.className = "links-dot-unread";
      unread.title = "未读";
      titleLine.appendChild(unread);
    }
    const title = document.createElement(request.protectedMode ? "button" : "a");
    title.className =
      "links-feed-title text-base-content hover:text-primary line-clamp-1 text-left text-sm font-medium transition-colors";
    title.textContent = item.title || "未命名动态";
    if (request.protectedMode) {
      title.type = "button";
      title.dataset.feedOpen = item.id;
    } else {
      title.href = item.url;
      title.target = "_blank";
      title.rel = "noopener noreferrer";
    }
    titleLine.appendChild(title);
    copy.appendChild(titleLine);
    const meta = document.createElement("p");
    meta.className = "text-base-content/50 mt-1 flex flex-wrap items-center gap-1.5 text-xs";
    const author = document.createElement("span");
    author.textContent = item.author || "友链作者";
    const source = document.createElement("span");
    source.textContent = feedSources.get(item.linkName)?.name || item.linkName || "友链来源";
    meta.append(author, document.createTextNode("·"), source);
    if (item.publishedAt) {
      const time = document.createElement("time");
      time.dateTime = item.publishedAt;
      time.textContent = formatDate(item.publishedAt);
      meta.append(document.createTextNode("·"), time);
    }
    copy.appendChild(meta);
    if (state.route.itemId === item.id && item.summary) {
      const summary = document.createElement("p");
      summary.className =
        "text-base-content/70 bg-base-200/50 mt-2.5 line-clamp-3 rounded-xl p-3 text-xs leading-relaxed";
      summary.textContent = item.summary;
      copy.appendChild(summary);
    }

    const actions = document.createElement("div");
    actions.className = "flex shrink-0 items-center gap-0.5";
    if (request.protectedMode) {
      for (const [field, active, label, iconName] of [
        ["favorite", item.favorite, item.favorite ? "取消收藏" : "收藏", "icon-[heroicons--star]"],
        ["later", item.readLater, item.readLater ? "移出稍后阅读" : "稍后阅读", "icon-[heroicons--clock]"],
        ["read", item.read, item.read ? "标记未读" : "标记已读", "icon-[heroicons--check]"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-ghost btn-square btn-sm";
        button.classList.toggle(
          field === "favorite" ? "text-warning" : field === "later" ? "text-info" : "text-success",
          active,
        );
        if (!active) button.classList.add("text-base-content/30");
        button.dataset.feedToggle = field;
        button.dataset.feedId = item.id;
        button.title = label;
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", String(active));
        button.disabled = state.feedActionBusy.has(`${item.id}:${field}`);
        button.appendChild(icon(`${iconName} h-4 w-4`));
        actions.appendChild(button);
      }
    } else {
      const outbound = externalLink(item.url, "btn btn-ghost btn-square btn-sm text-base-content/20");
      outbound.title = "阅读原文";
      outbound.setAttribute("aria-label", "阅读原文");
      outbound.appendChild(icon("icon-[heroicons--arrow-up-right] h-4 w-4"));
      actions.appendChild(outbound);
    }
    row.append(avatar, copy, actions);
    return row;
  }

  function setText(selector, value) {
    const node = root.querySelector(selector);
    if (node) node.textContent = value || "";
  }

  function setLink(selector, href) {
    const node = root.querySelector(selector);
    if (!node) return;
    const value = normalizeHttpUrl(href);
    node.hidden = !value;
    if (value) node.href = value;
  }

  function showDialog(dialog) {
    if (!dialog || dialog.open) return;
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    if (!dialog?.open) return;
    state.dialogSync = true;
    dialog.close();
    queueMicrotask(() => {
      state.dialogSync = false;
    });
  }

  function syncLinkDialog() {
    const dialog = root.querySelector("[data-link-detail-dialog]");
    const link = links.get(state.route.link);
    if (!link || (state.route.view && state.route.view !== "links")) {
      closeDialog(dialog);
      return;
    }
    const name = link.name || "未命名友链";
    const description = link.description || "这个站点暂未填写介绍。";
    const groupLabel = link.groupLabel || "未分组";
    setText("[data-link-detail-name]", name);
    setText("[data-link-detail-name-copy]", name);
    setText("[data-link-detail-description]", description);
    setText("[data-link-detail-group]", groupLabel);
    setText("[data-link-detail-url]", link.url);
    setText("[data-link-detail-rss]", link.rssUrl || "");
    setText("[data-link-detail-current-url]", `/links?link=${encodeURIComponent(link.key)}`);
    setText(
      "[data-link-detail-status]",
      link.accessState === "ACCESSIBLE"
        ? "链接可访问"
        : link.accessState === "CHECKING"
          ? "链接检测中"
          : link.accessState === "INACCESSIBLE"
            ? "链接暂不可访问"
            : "尚无检测结果",
    );
    const statusDot = root.querySelector("[data-link-detail-status-dot]");
    if (statusDot) {
      statusDot.className = `status status-xs ${
        link.accessState === "ACCESSIBLE"
          ? "status-success"
          : link.accessState === "CHECKING"
            ? "status-warning"
            : link.accessState === "INACCESSIBLE"
              ? "status-error"
              : "status-neutral"
      }`;
    }
    const copyValues = { name, url: link.url, description, group: groupLabel, rss: link.rssUrl };
    for (const button of root.querySelectorAll("[data-link-detail-copy]")) {
      const value = copyValues[button.dataset.linkDetailCopy] || "";
      button.dataset.linksCopy = value;
      button.hidden = !value;
    }
    const rssRow = root.querySelector("[data-link-detail-rss-row]");
    if (rssRow) rssRow.hidden = !link.rssUrl;
    setLink("[data-link-detail-visit]", link.url);
    const feedButton = root.querySelector("[data-link-detail-feed]");
    if (feedButton) {
      feedButton.hidden = !feedSources.has(link.key);
      feedButton.dataset.linkDetailFeed = link.key;
    }
    const image = root.querySelector("[data-link-detail-logo]");
    const fallback = root.querySelector("[data-link-detail-logo-fallback]");
    if (image) {
      image.hidden = !link.logo;
      if (link.logo) image.src = link.logo;
      image.alt = link.name || "";
    }
    if (fallback) fallback.hidden = Boolean(link.logo);
    showDialog(dialog);
  }

  function syncFeedDialog(request) {
    const dialog = root.querySelector("[data-feed-detail-dialog]");
    const item = request?.protectedMode ? feed.items.find((entry) => entry.id === state.route.itemId) : null;
    closeDialog(dialog);
    if (!item) {
      return;
    }
    if (!state.autoMarked.has(item.id) && (!item.read || item.readLater)) {
      state.autoMarked.add(item.id);
      if (!item.read) setFeedFlag(item.id, "read", true, { quiet: true });
      if (item.readLater) setFeedFlag(item.id, "later", false, { quiet: true });
    }
  }

  async function setFeedFlag(itemId, field, value, { quiet = false } = {}) {
    if (!capabilities.canReadFeed) return;
    const item = feed.items.find((entry) => entry.id === itemId);
    if (!item) return;
    const busyKey = `${itemId}:${field}`;
    if (state.feedActionBusy.has(busyKey)) return;
    const map = {
      read: { path: "read", query: "read", property: "read" },
      favorite: { path: "favorite", query: "favorite", property: "favorite" },
      later: { path: "read-later", query: "readLater", property: "readLater" },
    };
    const config = map[field];
    if (!config) return;
    const previous = item[config.property];
    item[config.property] = value;
    state.feedActionBusy.add(busyKey);
    renderFeedResults(activeFeedRequest());
    const url = new URL(
      `${LINK_FEED_CONSOLE_API}/${encodeURIComponent(itemId)}/${config.path}`,
      window.location.origin,
    );
    url.searchParams.set(config.query, String(value));
    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", ...buildCsrfHeaders() },
        signal,
      });
      if (!response.ok) throw httpError(response, await responseMessage(response));
      if (!quiet) toast("动态状态已保存", "success");
      if (field === "read") refreshUnreadCount();
      const scope = state.route.scope;
      const shouldRemove =
        (scope === "favorite" && !item.favorite) ||
        (scope === "later" && !item.readLater) ||
        (scope === "unread" && item.read);
      if (shouldRemove) {
        feed.items = feed.items.filter((entry) => entry.id !== itemId);
        feed.status = feed.items.length ? "ready" : "empty";
        if (state.route.itemId === itemId) navigate({ itemId: null }, { replace: true, announce: false });
      }
    } catch (error) {
      item[config.property] = previous;
      if (error?.name !== "AbortError") toast("状态保存失败，请稍后重试", "error");
      if ([401, 403].includes(Number(error?.status || 0))) {
        capabilities.canReadFeed = false;
        capabilities.canManage = false;
        capabilities.status = Number(error.status) === 401 ? "guest" : "denied";
        normalizeLocation();
        const request = activeFeedRequest();
        if (request) loadFeed(request, { replace: true, force: true });
      }
    } finally {
      state.feedActionBusy.delete(busyKey);
      renderFeedResults(activeFeedRequest());
    }
  }

  function applyFormValues(form) {
    const data = new FormData(form);
    return {
      type: data.get("type") === "update" ? "update" : "add",
      displayName: stringValue(data.get("displayName")),
      url: stringValue(data.get("url")),
      logo: stringValue(data.get("logo")),
      description: stringValue(data.get("description")),
      groupName: stringValue(data.get("groupName")),
      rssUrl: stringValue(data.get("rssUrl")),
      email: stringValue(data.get("email")),
      updateDescription: stringValue(data.get("updateDescription")),
    };
  }

  function validateApplyForm(values) {
    if (!normalizeHttpUrl(values.url)) return "请填写有效的 HTTP 或 HTTPS 网站地址。";
    if (!values.displayName) return "请填写网站名称。";
    if (!values.description) return "请填写网站描述。";
    if (values.logo && !normalizeHttpUrl(values.logo)) return "Logo 必须是有效的 HTTP 或 HTTPS 地址。";
    if (values.rssUrl && !normalizeHttpUrl(values.rssUrl)) return "RSS 必须是有效的 HTTP 或 HTTPS 地址。";
    if (values.type === "update" && !values.updateDescription) return "修改申请需要填写修改说明。";
    return "";
  }

  function buildApplyMarkdown(values) {
    const groupOption = Array.from(root.querySelectorAll('[data-link-apply-form] [name="groupName"] option')).find(
      (option) => option.value === values.groupName,
    );
    const lines = [
      values.type === "update" ? "申请修改友链：" : "申请交换友链：",
      `- 网站名称：${values.displayName || "请补充网站名称"}`,
      `- 网站地址：${normalizeHttpUrl(values.url) || values.url || "请补充网站地址"}`,
      `- Logo：${normalizeHttpUrl(values.logo) || "未提供"}`,
      `- 网站描述：${values.description || "请补充一句话简介"}`,
    ];
    if (values.groupName) lines.push(`- 申请分组：${groupOption?.textContent?.trim() || values.groupName}`);
    if (values.rssUrl) lines.push(`- RSS 链接：${normalizeHttpUrl(values.rssUrl) || values.rssUrl}`);
    if (values.email) lines.push(`- 联系邮箱：${values.email}`);
    if (values.type === "update") lines.push(`- 修改说明：${values.updateDescription || "请补充修改说明"}`);
    return lines.join("\n");
  }

  function updateApplyPreview() {
    const form = root.querySelector("[data-link-apply-form]");
    const output = root.querySelector("[data-apply-markdown]");
    if (!form || !output) return;
    output.value = buildApplyMarkdown(applyFormValues(form));
    renderApplyCapability();
  }

  function applyStatus(message, type = "info") {
    const status = root.querySelector("[data-apply-status]");
    if (!status) return;
    status.hidden = false;
    status.className = `alert alert-soft ${type === "error" ? "alert-error" : type === "success" ? "alert-success" : "alert-info"}`;
    status.textContent = message;
  }

  async function identifyApplySite() {
    const form = root.querySelector("[data-link-apply-form]");
    const button = form?.querySelector("[data-apply-identify]");
    if (!form || !button) return;
    const values = applyFormValues(form);
    const url = normalizeHttpUrl(values.url);
    if (!url) {
      applyStatus("请先输入有效的 HTTP 或 HTTPS 网站地址。", "error");
      form.elements.url?.focus();
      return;
    }
    if (state.capabilityPromise) await state.capabilityPromise;
    state.identifyController?.abort();
    const task = timeoutController(8000, signal);
    state.identifyController = task.controller;
    button.disabled = true;
    applyStatus(capabilities.canManage ? "正在调用 PluginLinks 官方识别接口…" : "正在尝试浏览器公开识别…");
    let officialError = null;
    try {
      let metadata = null;
      if (capabilities.canManage) {
        try {
          metadata = await fetchOfficialSiteMetadata(url, task.controller.signal);
        } catch (error) {
          officialError = error;
          if ([401, 403].includes(Number(error?.status || 0))) {
            capabilities.canManage = false;
            capabilities.canReadFeed = false;
            capabilities.status = Number(error.status) === 401 ? "guest" : "denied";
          }
        }
      }
      if (!metadata) metadata = await fetchPublicSiteMetadata(url, task.controller.signal);
      if (task.controller.signal.aborted) return;
      const assignments = {
        displayName: metadata.title,
        description: metadata.description,
        logo: metadata.logo,
        rssUrl: metadata.rssUrl,
      };
      for (const [name, value] of Object.entries(assignments)) {
        const field = form.elements[name];
        if (field && value && !stringValue(field.value)) field.value = value;
      }
      updateApplyPreview();
      applyStatus(
        officialError
          ? "官方识别不可用，已通过浏览器公开信息完成填充；请人工核对。"
          : metadata.platform
            ? `识别完成：${metadata.platform}；请核对后提交。`
            : "识别完成，请核对后提交。",
        officialError ? "info" : "success",
      );
    } catch (error) {
      if (error?.name === "AbortError" && task.controller.signal.reason?.name !== "TimeoutError") return;
      if (task.controller.signal.reason?.name === "TimeoutError") error.code = "timeout";
      applyStatus(
        `${officialError ? "官方识别失败；" : ""}${formatMetadataFailure(error)}。可以继续手动填写。`,
        "error",
      );
    } finally {
      task.dispose();
      if (state.identifyController === task.controller) state.identifyController = null;
      button.disabled = false;
      renderApplyCapability();
    }
  }

  function revealApplyDraft(values) {
    const markdown = buildApplyMarkdown(values);
    const output = root.querySelector("[data-apply-markdown]");
    const outputPanel = root.querySelector("[data-apply-output]");
    if (output) output.value = markdown;
    if (outputPanel) outputPanel.hidden = false;
    applyStatus("申请 Markdown 已生成，请核对后复制到留言板提交。", "success");
  }

  async function submitApplyForm(form) {
    if (state.capabilityPromise) await state.capabilityPromise;
    const values = applyFormValues(form);
    const validation = validateApplyForm(values);
    if (validation) {
      applyStatus(validation, "error");
      return;
    }
    if (values.type !== "add" || !capabilities.canManage) {
      revealApplyDraft(values);
      return;
    }
    const button = form.querySelector("[data-apply-submit]");
    if (button) button.disabled = true;
    applyStatus("正在通过 Halo 标准 Link 接口创建友链…");
    try {
      const response = await fetch(LINK_CORE_API, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...buildCsrfHeaders(),
        },
        body: JSON.stringify(buildPluginLinkPayload(values)),
        signal,
      });
      if (!response.ok) throw httpError(response, await responseMessage(response));
      applyStatus("友链已添加到 PluginLinks，刷新页面后即可看到。", "success");
      toast("友链创建成功", "success");
    } catch (error) {
      if (error?.name === "AbortError") return;
      const status = Number(error?.status || 0);
      if (status === 401 || status === 403) {
        capabilities.canManage = false;
        capabilities.canReadFeed = false;
        capabilities.status = status === 401 ? "guest" : "denied";
        applyStatus("当前会话不能直接创建，已切换为留言申请。", "info");
        revealApplyDraft(values);
      } else {
        const detail = sanitizePlainText(error?.message);
        applyStatus(
          status === 409
            ? "该网址或友链已经存在，请改用修改申请。"
            : status >= 500
              ? "链接管理服务暂时异常，请稍后重试。"
              : detail || "友链创建失败，请检查填写内容。",
          "error",
        );
      }
    } finally {
      if (button) button.disabled = false;
      renderApplyCapability();
    }
  }

  function plainClick(event) {
    return (
      event.button === 0 &&
      !event.defaultPrevented &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    );
  }

  root.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const viewLink = target.closest("[data-links-view-link]");
      if (viewLink && plainClick(event)) {
        event.preventDefault();
        const view = viewLink.dataset.linksViewLink;
        navigate({ view: view === "links" ? null : view }, { scroll: true });
        return;
      }
      const viewTrigger = target.closest("[data-links-view-trigger]");
      if (viewTrigger) {
        event.preventDefault();
        navigate({ view: viewTrigger.dataset.linksViewTrigger }, { scroll: true });
        return;
      }
      const groupFilter = target.closest("[data-link-group-filter]");
      if (groupFilter && plainClick(event)) {
        event.preventDefault();
        navigate({
          group: groupFilter.dataset.linkGroupFilter === "all" ? null : groupFilter.dataset.linkGroupFilter,
          link: null,
        });
        return;
      }
      const linkCard = target.closest("[data-link-card]");
      if (linkCard && plainClick(event)) {
        event.preventDefault();
        navigate({ link: linkCard.dataset.linkKey });
        return;
      }
      const detailFeed = target.closest("[data-link-detail-feed]");
      if (detailFeed) {
        event.preventDefault();
        navigate({
          view: "friends",
          linkName: detailFeed.dataset.linkDetailFeed,
          groupName: null,
          scope: null,
          itemId: null,
          link: null,
        });
        return;
      }
      const feedScope = target.closest("[data-feed-scope]");
      if (feedScope) {
        event.preventDefault();
        navigate({
          view: "friends",
          scope: feedScope.dataset.feedScope,
          groupName: null,
          linkName: null,
          itemId: null,
        });
        return;
      }
      const feedGroup = target.closest("[data-feed-group-action]");
      if (feedGroup) {
        event.preventDefault();
        navigate({
          view: "friends",
          groupName: feedGroup.dataset.feedGroupAction,
          linkName: null,
          scope: null,
          itemId: null,
        });
        return;
      }
      const feedSource = target.closest("[data-feed-source], [data-feed-source-action]");
      if (feedSource) {
        event.preventDefault();
        navigate({
          view: "friends",
          linkName: feedSource.dataset.feedLinkKey || feedSource.dataset.feedSourceAction,
          groupName: null,
          scope: null,
          itemId: null,
        });
        return;
      }
      if (target.closest("[data-feed-back]")) {
        event.preventDefault();
        navigate({ view: "friends", scope: null, groupName: null, linkName: null, itemId: null });
        return;
      }
      if (target.closest("[data-feed-load-more]")) {
        event.preventDefault();
        const request = activeFeedRequest();
        if (request && feed.hasNext) loadFeed(request, { replace: false });
        return;
      }
      if (target.closest("[data-feed-retry]")) {
        event.preventDefault();
        const request = activeFeedRequest();
        if (request) loadFeed(request, { replace: true, force: true });
        return;
      }
      const feedOpen = target.closest("[data-feed-open]");
      if (feedOpen) {
        event.preventDefault();
        navigate({ itemId: feedOpen.dataset.feedOpen });
        return;
      }
      const feedToggle = target.closest("[data-feed-toggle], [data-feed-detail-toggle]");
      if (feedToggle) {
        event.preventDefault();
        const item = feed.items.find((entry) => entry.id === feedToggle.dataset.feedId);
        const field = feedToggle.dataset.feedToggle || feedToggle.dataset.feedDetailToggle;
        if (!item) return;
        const next = field === "favorite" ? !item.favorite : field === "later" ? !item.readLater : !item.read;
        setFeedFlag(item.id, field, next);
        return;
      }
      const openDialogButton = target.closest("[data-links-open-dialog]");
      if (openDialogButton) {
        event.preventDefault();
        showDialog(document.getElementById(openDialogButton.dataset.linksOpenDialog));
        return;
      }
      const copyButton = target.closest("[data-links-copy]");
      if (copyButton) {
        event.preventDefault();
        copyText(copyButton.dataset.linksCopy || "")
          .then(() => toast("已复制", "success"))
          .catch(() => toast("复制失败", "error"));
        return;
      }
      if (target.closest("[data-apply-identify]")) {
        event.preventDefault();
        identifyApplySite();
        return;
      }
      if (target.closest("[data-apply-copy]")) {
        event.preventDefault();
        const form = root.querySelector("[data-link-apply-form]");
        const markdown = root.querySelector("[data-apply-markdown]")?.value || "";
        if (!form || !markdown) return;
        copyText(markdown)
          .then(() => {
            applyStatus("申请 Markdown 已复制，请粘贴到留言板。", "success");
            toast("申请内容已复制", "success");
          })
          .catch(() => applyStatus("复制失败，请手动复制下方内容。", "error"));
        return;
      }
      if (target.closest("[data-apply-board]")) {
        event.preventDefault();
        navigate({ view: "board" }, { scroll: true });
      }
    },
    { signal },
  );

  root.addEventListener(
    "input",
    (event) => {
      if (event.target instanceof Element && event.target.closest("[data-link-apply-form]")) updateApplyPreview();
    },
    { signal },
  );

  root.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement || target instanceof HTMLInputElement)) return;
      if (target.matches("[data-feed-filter-group]")) {
        navigate({
          view: "friends",
          groupName: target.value || null,
          linkName: null,
          scope: target.value ? null : "all",
          itemId: null,
        });
      } else if (target.matches("[data-feed-filter-source]")) {
        navigate({
          view: "friends",
          linkName: target.value || null,
          groupName: null,
          scope: target.value ? null : "all",
          itemId: null,
        });
      } else if (target.closest("[data-link-apply-form]")) {
        updateApplyPreview();
      }
    },
    { signal },
  );

  root.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches("[data-link-apply-form]")) return;
      event.preventDefault();
      submitApplyForm(form);
    },
    { signal },
  );

  root.addEventListener(
    "reset",
    (event) => {
      if (!(event.target instanceof HTMLFormElement) || !event.target.matches("[data-link-apply-form]")) return;
      globalThis.setTimeout(() => {
        const status = root.querySelector("[data-apply-status]");
        const output = root.querySelector("[data-apply-output]");
        if (status) status.hidden = true;
        if (output) output.hidden = true;
        updateApplyPreview();
      });
    },
    { signal },
  );

  const linkDialog = root.querySelector("[data-link-detail-dialog]");
  linkDialog?.addEventListener(
    "close",
    () => {
      if (!state.dialogSync && state.route.link) navigate({ link: null }, { announce: false });
    },
    { signal },
  );
  const feedDialog = root.querySelector("[data-feed-detail-dialog]");
  feedDialog?.addEventListener(
    "close",
    () => {
      if (!state.dialogSync && state.route.itemId) navigate({ itemId: null }, { announce: false });
    },
    { signal },
  );
  window.addEventListener(
    "popstate",
    () => {
      normalizeLocation();
      render();
      if (state.route.view === "board") focusBoard();
    },
    { signal },
  );

  const initial = normalizeLocation();
  render();
  updateApplyPreview();
  if (state.route.view === "board") focusBoard();
  if (initial.notes.length) globalThis.setTimeout(() => initial.notes.forEach((note) => toast(note)), 240);
  resolveCapabilities();

  return () => {
    lifecycle.abort();
    feed.controller?.abort();
    state.identifyController?.abort();
    globalThis.clearTimeout(state.boardFocusTimer);
  };
}
