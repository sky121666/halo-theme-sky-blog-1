#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import "./verify-links-regressions.mjs";
import "./verify-links-identification.mjs";
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
assert.deepEqual(normalize({ view: "friends", itemId: "feed-1" }), {
  view: "friends",
  scope: "all",
  itemId: "feed-1",
});
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

// Run the production dialog sync against the image/event boundary. These cases
// catch early display of broken images and callbacks from a previous selection.
const syncDialogSource = runtime.slice(
  runtime.indexOf("function syncLinkDialog()"),
  runtime.indexOf("function syncFeedDialog("),
);

function logoFixture() {
  const fallback = { hidden: false };
  let current;
  class Logo extends EventTarget {
    hidden = true;
    className = "h-full w-full object-cover";
    dataset = {};
    isConnected = true;
    attributes = new Map();
    set src(value) {
      this.attributes.set("src", value);
    }
    get src() {
      return this.attributes.get("src") || "";
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
    replaceWith(next) {
      this.isConnected = false;
      current = next;
    }
    dispatchEvent(event) {
      super.dispatchEvent(event);
      this[`on${event.type}`]?.(event);
      return true;
    }
  }
  current = new Logo();
  const controller = new AbortController();
  const state = { route: { link: "one" } };
  const catalog = new Map([
    ["one", { key: "one", name: "第一站", logo: "https://one.test/logo.png" }],
    ["two", { key: "two", name: "第二站", logo: "https://two.test/logo.png" }],
    ["shared", { key: "shared", name: "共用图标站点", logo: "https://one.test/logo.png" }],
    ["empty", { key: "empty", name: "无图站点", logo: "" }],
  ]);
  const root = {
    querySelector(selector) {
      if (selector === "[data-link-detail-logo]") return current;
      if (selector === "[data-link-detail-logo-fallback]") return fallback;
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  const sync = vm.runInNewContext(`(${syncDialogSource})`, {
    root,
    state,
    links: catalog,
    feedSources: new Set(),
    signal: controller.signal,
    document: { createElement: () => new Logo() },
    setText() {},
    setLink() {},
    showDialog() {},
    closeDialog() {},
  });
  return {
    fallback,
    controller,
    image: () => current,
    select(key = "one") {
      state.route.link = key;
      sync();
      return current;
    },
  };
}

test("a pending or failed detail logo keeps the usable fallback visible", () => {
  const fixture = logoFixture();
  const image = fixture.select();
  assert.equal(image.hidden, true, "the image must not be exposed before it has loaded");
  assert.equal(fixture.fallback.hidden, false);
  image.dispatchEvent(new Event("error"));
  assert.equal(image.hidden, true);
  assert.equal(fixture.fallback.hidden, false);
});

test("a successfully loaded detail logo replaces the fallback", () => {
  const fixture = logoFixture();
  const image = fixture.select();
  image.dispatchEvent(new Event("load"));
  assert.equal(image.hidden, false);
  assert.equal(fixture.fallback.hidden, true);
  assert.equal(image.alt, "第一站");
});

test("switching from a loaded logo to no logo removes the previous source", () => {
  const fixture = logoFixture();
  fixture.select().dispatchEvent(new Event("load"));
  const empty = fixture.select("empty");
  assert.equal(empty.src, "");
  assert.equal(empty.hidden, true);
  assert.equal(fixture.fallback.hidden, false);
});

test("late load and error events cannot change the latest selection", () => {
  const fixture = logoFixture();
  const previous = fixture.select();
  const current = fixture.select("two");
  previous.dispatchEvent(new Event("load"));
  assert.equal(current.hidden, true);
  assert.equal(fixture.fallback.hidden, false);
  current.dispatchEvent(new Event("load"));
  previous.dispatchEvent(new Event("error"));
  assert.equal(current.hidden, false);
  assert.equal(fixture.fallback.hidden, true);
  assert.equal(current.src, "https://two.test/logo.png");
});

test("syncing unchanged detail data does not restart the image request", () => {
  const fixture = logoFixture();
  const first = fixture.select();
  first.dispatchEvent(new Event("load"));
  assert.equal(fixture.select(), first);
  assert.equal(first.hidden, false);
});

test("links sharing a logo reuse the image but update its accessible name", () => {
  const fixture = logoFixture();
  const image = fixture.select();
  image.dispatchEvent(new Event("load"));
  assert.equal(fixture.select("shared"), image);
  assert.equal(image.alt, "共用图标站点");
  assert.equal(image.hidden, false);
});

test("a completed image cannot update the dialog after the page unmounts", () => {
  const fixture = logoFixture();
  const image = fixture.select();
  fixture.controller.abort();
  image.dispatchEvent(new Event("load"));
  assert.equal(image.hidden, true);
  assert.equal(fixture.fallback.hidden, false);
});

console.log("Links v2 runtime verification passed (routes, permissions, cursors, payloads, template markers). ");
