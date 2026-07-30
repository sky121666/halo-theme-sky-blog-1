#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  LINK_FEED_API,
  LINK_FEED_CONSOLE_API,
  LINK_CORE_API,
  MANAGED_QUERY_KEYS,
  applyLinksStateToUrl,
  buildCsrfHeaders,
  buildLinkFeedApiUrl,
  buildPluginLinkPayload,
  normalizeLinkCapabilities,
  normalizeLinkFeedPage,
  normalizeLinksState,
  normalizeLinksUrl,
  normalizeHttpUrl,
  sanitizePlainText,
} from "../src/apps/links/runtime.js";

const groups = new Set(["tools", "friends"]);
const links = new Map([
  ["link-tool", "tools"],
  ["link-friend", "friends"],
]);
const feedGroups = new Set(["friends"]);
const feedLinks = new Set(["link-friend"]);
const context = { groups, links, feedGroups, feedLinks };

function normalize(raw, extra = {}) {
  return normalizeLinksState(raw, { ...context, ...extra }).state;
}

assert.deepEqual(MANAGED_QUERY_KEYS, ["view", "scope", "groupName", "linkName", "itemId", "group", "link"]);
assert.deepEqual(normalize({ view: "unknown", scope: "all" }), {});
assert.deepEqual(normalize({ view: "links", group: "friends" }), { group: "friends" });
assert.deepEqual(normalize({ view: "apply", group: "friends", itemId: "feed-1" }), { view: "apply" });
assert.deepEqual(normalize({ view: "board", scope: "all" }), { view: "board" });
assert.deepEqual(normalize({ group: "missing", link: "link-friend" }), { link: "link-friend" });
assert.deepEqual(normalize({ group: "tools", link: "link-friend" }), { link: "link-friend" });
assert.deepEqual(normalize({ group: "friends", link: "link-friend" }), {
  group: "friends",
  link: "link-friend",
});
assert.deepEqual(normalize({ view: "friends", group: "friends", link: "link-friend" }), { view: "friends" });
assert.deepEqual(normalize({ view: "friends", scope: "favorite", groupName: "friends", linkName: "link-friend" }), {
  view: "friends",
  groupName: "friends",
});
assert.deepEqual(normalize({ view: "friends", itemId: "feed-1" }), { view: "friends" });
assert.deepEqual(normalize({ view: "friends", scope: "all", itemId: "feed-1" }, { canReadFeed: true }), {
  view: "friends",
  scope: "all",
  itemId: "feed-1",
});
assert.deepEqual(normalize({ view: "friends", scope: "favorite", itemId: "feed-1" }, { canReadFeed: false }), {
  view: "friends",
  scope: "all",
});
assert.deepEqual(normalize({ view: "friends", scope: "unread", itemId: "feed-1" }, { canReadFeed: false }), {
  view: "friends",
  scope: "unread",
});

const preserved = normalizeLinksUrl(
  "https://halo.test/links?campaign=summer&view=links&scope=bad#links-comments",
  context,
).url;
assert.equal(preserved.searchParams.get("campaign"), "summer");
assert.equal(preserved.searchParams.has("view"), false);
assert.equal(preserved.searchParams.has("scope"), false);
assert.equal(preserved.hash, "#links-comments");

const orderedUrl = applyLinksStateToUrl("https://halo.test/links?keep=1", {
  link: "link-friend",
  group: "friends",
});
assert.equal(orderedUrl.search, "?keep=1&group=friends&link=link-friend");

const publicFeed = buildLinkFeedApiUrl(
  {
    groupName: "friends",
    linkName: "must-drop",
    beforePublishedAt: "2026-07-29T00:00:00Z",
    beforeId: "feed-20",
    limit: 999,
  },
  "https://halo.test",
);
assert.equal(publicFeed.pathname, LINK_FEED_API);
assert.equal(publicFeed.searchParams.get("groupName"), "friends");
assert.equal(publicFeed.searchParams.has("linkName"), false);
assert.equal(publicFeed.searchParams.get("limit"), "100");
assert.equal(publicFeed.searchParams.get("beforeId"), "feed-20");

const protectedFeed = buildLinkFeedApiUrl({ scope: "later", protectedMode: true, limit: 20 }, "https://halo.test");
assert.equal(protectedFeed.pathname, LINK_FEED_CONSOLE_API);
assert.equal(protectedFeed.searchParams.get("readLater"), "true");
assert.equal(protectedFeed.searchParams.has("favorite"), false);

const page = normalizeLinkFeedPage({
  items: [
    {
      id: "feed-1",
      linkName: "link-friend",
      url: "https://friend.test/post",
      title: "<strong>安全标题</strong>",
      summary: "<script>alert(1)</script> 摘要",
      read: false,
      favorite: true,
      readLater: true,
    },
    { id: "unsafe", url: "javascript:alert(1)" },
  ],
  hasNext: true,
  nextBeforePublishedAt: "2026-07-28T00:00:00Z",
  nextBeforeId: "feed-2",
});
assert.equal(page.items.length, 1);
assert.equal(page.items[0].title, "安全标题");
assert.equal(page.items[0].summary, "alert(1) 摘要");
assert.equal(page.items[0].favorite, true);
assert.equal(page.hasNext, true);

assert.equal(normalizeHttpUrl("javascript:alert(1)"), "");
assert.equal(sanitizePlainText("测试<br><b>友链</b>&nbsp;&amp;安全"), "测试 友链 &安全");
assert.deepEqual(buildCsrfHeaders("theme=dark; XSRF-TOKEN=halo%3Acsrf%2Btoken"), {
  "X-XSRF-TOKEN": "halo:csrf+token",
});

assert.deepEqual(
  normalizeLinkCapabilities(
    { permissions: [{ metadata: { name: "role-template-link-manage" } }] },
    { metadata: { name: "sky" } },
  ),
  { authenticated: true, username: "sky", canReadFeed: true, canManage: true },
);
assert.deepEqual(
  normalizeLinkCapabilities({ uiPermissions: ["plugin:links:view"] }, { metadata: { name: "reader" } }),
  { authenticated: true, username: "reader", canReadFeed: true, canManage: false },
);

const payload = buildPluginLinkPayload({
  url: "https://example.test/",
  displayName: "示例站点",
  description: "示例描述",
  logo: "https://example.test/logo.png",
  groupName: "friends",
  rssUrl: "https://example.test/rss.xml",
});
assert.equal(payload.metadata.generateName, "link-");
assert.equal(payload.spec.groupName, "friends");
assert.deepEqual(payload.spec.rss, { enabled: true, feedUrls: ["https://example.test/rss.xml"] });
assert.equal(LINK_CORE_API, "/apis/core.halo.run/v1alpha1/links");

const runtime = fs.readFileSync(new URL("../src/apps/links/runtime.js", import.meta.url), "utf8");
const template = fs.readFileSync(new URL("../templates/modules/links/content.html", import.meta.url), "utf8");
for (const marker of [
  "linkFeedFinder.groupBy(1)",
  "linkFeedFinder.list({limit: linkFeedLimit})",
  "linkFeedFinder.list({limit: linkFeedLimit})))",
  "data-feed-prefetch-item",
  "data-link-apply-form",
  "data-link-detail-dialog",
  "data-feed-detail-dialog",
]) {
  assert(template.includes(marker), `Links 模板缺少契约标记：${marker}`);
}
const localNavigationTags = template.match(/<a\b[^>]*data-links-local-navigation[^>]*>/gs) || [];
assert.equal(localNavigationTags.length, 5, "Links 模板应声明 5 类本地导航入口");
assert(
  localNavigationTags.every((tag) => tag.includes("data-no-swup")),
  "Links 本地导航必须绕过全局 Swup，由页面运行时局部更新",
);
for (const forbidden of ["plugin-friends", "link-submit", "/friends"]) {
  assert(!runtime.includes(forbidden), `Links 运行时不得包含旧集成：${forbidden}`);
  assert(!template.includes(forbidden), `Links 模板不得包含旧集成：${forbidden}`);
}

console.log("Links v2 runtime verification passed (routes, permissions, cursors, payloads, template markers). ");
