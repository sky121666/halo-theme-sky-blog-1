#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { normalizeLinkCapabilities } from "../src/apps/links/runtime.js";
import "./verify-links-history.mjs";
import "./verify-links-focus.mjs";
import "./verify-links-pjax-history.mjs";

const runtime = fs.readFileSync(new URL("../src/apps/links/runtime.js", import.meta.url), "utf8");
function part(start, end) {
  const first = runtime.indexOf(start);
  const last = runtime.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing production function boundary: ${start}`);
  return runtime.slice(first, last);
}

function titleFixture(initialView) {
  const title = {
    textContent: initialView === "friends" ? "友链动态" : initialView === "apply" ? "申请友链" : "自定义友链",
  };
  const description = {
    textContent: initialView === "friends" ? "动态说明" : initialView === "apply" ? "申请说明" : "自定义描述",
  };
  const root = { dataset: { linksDefaultTitle: "自定义友链", linksDefaultDescription: "自定义描述" } };
  const state = { route: { view: initialView } };
  const panels = [];
  const tabs = [];
  const source = part("  const defaultTitle =", "  const feed =");
  const render = part("  function renderPanels()", "  function renderLinksView()");
  return {
    title,
    description,
    state,
    render: vm.runInNewContext(`(function () { ${source} ${render} return renderPanels; })()`, {
      root,
      pageTitle: title,
      pageDescription: description,
      state,
      panels,
      tabs,
    }),
  };
}

for (const view of ["friends", "apply"]) {
  test(`cold ${view} view restores the SSR default title and description when returning to links`, () => {
    const fixture = titleFixture(view);
    fixture.render();
    fixture.state.route = {};
    fixture.render();
    assert.equal(fixture.title.textContent, "自定义友链");
    assert.equal(fixture.description.textContent, "自定义描述");
  });
}

function groupsFixture(counts) {
  const state = { route: {} };
  const sections = Object.entries(counts).map(([key, count]) => ({
    dataset: { linkGroupSection: key },
    hidden: false,
    querySelector: () => count ? {} : null,
  }));
  const filters = ["all", ...Object.keys(counts)].map((key) => ({
    dataset: { linkGroupFilter: key },
    classList: { toggle() {} },
    setAttribute() {},
    removeAttribute() {},
  }));
  const globalEmpty = { hidden: true };
  const missingGroup = { hidden: true };
  const root = {
    querySelectorAll(selector) {
      return selector === "[data-link-group-section]" ? sections
        : selector === "[data-link-group-filter]" ? filters : [];
    },
    querySelector(selector) {
      return selector === "[data-links-empty]" ? globalEmpty
        : selector === "[data-links-filter-empty]" ? missingGroup : null;
    },
  };
  const render = vm.runInNewContext(`(${part("  function renderLinksView()", "  function activeFeedRequest()").trim()})`, {
    root, state,
    links: { size: Object.values(counts).reduce((sum, count) => sum + count, 0) },
    routeContext: () => ({ groups: new Set(Object.keys(counts)) }),
    syncLinkDialog() {},
  });
  return { state, sections, filters, globalEmpty, missingGroup, render };
}

test("all links skip empty groups while an explicit empty group remains selectable", () => {
  const f = groupsFixture({ empty: 0, friends: 2 });
  f.render();
  assert.deepEqual(f.sections.map(section => section.hidden), [true, false]);
  assert.equal(f.globalEmpty.hidden, true);
  assert.equal(f.filters.length, 3, "empty groups retain their navigation entry");
  f.state.route.group = "empty";
  f.render();
  assert.deepEqual(f.sections.map(section => section.hidden), [false, true]);
  assert.equal(f.globalEmpty.hidden, true);
  assert.equal(f.missingGroup.hidden, true);
  delete f.state.route.group;
  f.render();
  assert.deepEqual(f.sections.map(section => section.hidden), [true, false]);
});

for (const counts of [{}, { empty: 0, another: 0 }]) {
  test(`an empty links catalog has one global empty state (${JSON.stringify(counts)})`, () => {
    const f = groupsFixture(counts);
    f.render();
    assert.equal(f.globalEmpty.hidden, false);
    assert(f.sections.every(section => section.hidden));
    if (Object.hasOwn(counts, "empty")) {
      f.state.route.group = "empty";
      f.render();
      assert.equal(f.globalEmpty.hidden, true);
      assert.equal(f.sections[0].hidden, false);
    }
  });
}

test("a missing group keeps its own recovery state without the global empty state", () => {
  const f = groupsFixture({ empty: 0 });
  f.state.route.group = "missing";
  f.render();
  assert.equal(f.missingGroup.hidden, false);
  assert.equal(f.globalEmpty.hidden, true);
  assert(f.sections.every(section => section.hidden));
});

class Node {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.hidden = false;
    this.style = {};
    this.className = "";
    this.textContent = "";
    this.isConnected = true;
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }
  get nextElementSibling() {
    const siblings = this.parentNode?.children || [];
    return siblings[siblings.indexOf(this) + 1] || null;
  }
  matches(selector) {
    return selector === "[data-feed-avatar-image]" && Object.hasOwn(this.dataset, "feedAvatarImage");
  }
}
const fakeDocument = {
  createElement: (tag) => new Node(tag),
  createTextNode: (text) => Object.assign(new Node("#text"), { textContent: text }),
};
function flatten(node) {
  return [node, ...node.children.flatMap(flatten)];
}
function rowFixture(protectedMode, logo = "https://example.test/logo.png") {
  const defs = part("function icon(className)", "export function mountLinksApp()");
  const create = part("  function createFeedRow(item, request)", "  function setText(");
  const controller = new AbortController();
  const state = { route: {}, feedActionBusy: new Set() };
  const ctx = {
    document: fakeDocument,
    state,
    signal: controller.signal,
    feedSources: new Map(),
    formatDate: (value) => value,
  };
  const fn = vm.runInNewContext(`(function () { ${defs} ${create} return createFeedRow; })()`, ctx);
  const item = {
    id: "item-1",
    title: "文章",
    url: "https://example.test/post",
    author: "作者",
    authorLogo: logo,
    read: false,
    readLater: false,
    favorite: false,
  };
  return { row: fn(item, { protectedMode }), controller };
}

test("public readers get the original article link and no protected controls", () => {
  const { row } = rowFixture(false);
  const nodes = flatten(row);
  assert(nodes.some((node) => node.tagName === "A" && node.href === "https://example.test/post"));
  assert(!nodes.some((node) => node.dataset.feedOpen || node.dataset.feedToggle));
});

test("view and manage roles get internal RSS controls while an unprivileged member gets the original", () => {
  const user = { metadata: { name: "reader" } };
  for (const [permissions, canRead] of [
    [{ uiPermissions: ["plugin:links:view"] }, true],
    [{ uiPermissions: ["plugin:links:manage"] }, true],
    [{ permissions: [{ metadata: { name: "role-template-link-view" } }] }, true],
    [{ uiPermissions: [] }, false],
  ]) {
    const capabilities = normalizeLinkCapabilities(permissions, user);
    assert.equal(capabilities.canReadFeed, canRead);
    const nodes = flatten(rowFixture(capabilities.canReadFeed).row);
    assert.equal(
      nodes.some((node) => node.dataset.feedOpen === "item-1"),
      canRead,
    );
    assert.equal(
      nodes.some((node) => node.tagName === "A" && node.href === "https://example.test/post"),
      !canRead,
    );
  }
});

test("an absent author avatar keeps the RSS fallback without creating an image", () => {
  const nodes = flatten(rowFixture(true, "").row);
  assert(!nodes.some((node) => node.tagName === "IMG"));
  assert(nodes.some((node) => node.className.includes("icon-[heroicons--rss]") && !node.hidden));
});

test("feed rows retain an RSS fallback while an avatar is present", () => {
  const { row } = rowFixture(true);
  const nodes = flatten(row);
  const image = nodes.find((node) => node.tagName === "IMG");
  const fallback = nodes.find((node) => node.className.includes("icon-[heroicons--rss]"));
  assert(image, "expected an image for an author logo");
  assert(fallback, "broken or pending avatar needs a visible RSS fallback");
  assert.equal(image.hidden, false, "lazy-loaded images need a layout box while the request is pending");
  assert.equal(image.style.opacity, "0");
  assert.equal(fallback.hidden, false);
});

function detailFixture({
  host = true,
  openFails = false,
  protectedMode = true,
  scope = "all",
  connected = true,
  missingTitle = false,
} = {}) {
  const dialog = host
    ? {
        open: false,
        isConnected: connected,
        showModal() {
          if (openFails) throw new Error("cannot open");
          this.open = true;
        },
        setAttribute() {
          if (openFails) throw new Error("cannot open");
          this.open = true;
        },
        close() {
          this.open = false;
        },
      }
    : null;
  const nodes = Object.fromEntries(
    ["title", "author", "time", "summary", "visit"].map((key) => [key, { textContent: "", hidden: false }]),
  );
  const buttons = ["favorite", "later", "read"].map((field) => {
    const label = { textContent: "" };
    return {
      dataset: { feedDetailToggle: field },
      label,
      attributes: {},
      setAttribute(key, value) {
        this.attributes[key] = String(value);
      },
      querySelector() {
        return label;
      },
    };
  });
  const root = {
    querySelector(selector) {
      if (selector === "[data-feed-detail-dialog]") return dialog;
      const match = selector.match(/^\[data-feed-detail-(title|author|time|summary|visit)\]$/);
      if (match?.[1] === "title" && missingTitle) return null;
      return match ? nodes[match[1]] : null;
    },
    contains: () => connected,
    querySelectorAll(selector) {
      return selector === "[data-feed-detail-toggle]" ? buttons : [];
    },
  };
  const item = {
    id: "item-1",
    title: "示例文章",
    url: "https://example.test/post",
    author: "作者",
    publishedAt: "2026-10-28T00:00:00Z",
    summary: "摘要",
    read: false,
    readLater: true,
    favorite: true,
  };
  const state = {
    route: { view: "friends", scope, itemId: item.id },
    feedDetails: new Map(),
    autoMarked: new Set(),
    feedActionBusy: new Set(),
    feedDetailItemId: "",
  };
  const feed = { items: [item] };
  const calls = [];
  const helpers = part("  function setText(", "  function syncLinkDialog()");
  const sync = part("  function syncFeedDialog(request)", "  async function setFeedFlag(");
  const context = {
    root,
    state,
    feed,
    programmaticDialogCloses: new WeakMap(),
    capabilities: { canReadFeed: protectedMode },
    queueMicrotask,
    formatDate: () => "2026-10-28",
    normalizeHttpUrl: (value) => value,
    setFeedFlag(id, field, value) {
      calls.push({
        id,
        field,
        value,
        open: dialog?.open === true,
        title: nodes.title.textContent,
        url: nodes.visit.href,
      });
    },
    signal: new AbortController().signal,
  };
  const run = vm.runInNewContext(`(function () { ${helpers} ${sync} return syncFeedDialog; })()`, context);
  return { run: () => run({ protectedMode }), dialog, nodes, buttons, calls, state, item, feed };
}

test("authorized RSS detail opens populated content before automatic state changes", () => {
  const fixture = detailFixture();
  fixture.run();
  assert.equal(fixture.dialog.open, true);
  assert.equal(fixture.nodes.title.textContent, "示例文章");
  assert.equal(fixture.nodes.author.textContent, "作者");
  assert.equal(fixture.nodes.summary.textContent, "摘要");
  assert.equal(fixture.nodes.visit.href, "https://example.test/post");
  assert.equal(
    fixture.buttons.find((button) => button.dataset.feedDetailToggle === "favorite").dataset.feedId,
    "item-1",
  );
  assert.equal(
    fixture.buttons.find((button) => button.dataset.feedDetailToggle === "favorite").attributes["aria-pressed"],
    "true",
  );
  assert.deepEqual(
    fixture.calls.map(({ field, value }) => [field, value]),
    [
      ["read", true],
      ["later", false],
    ],
  );
  assert(
    fixture.calls.every((call) => call.open && call.title === "示例文章" && call.url === "https://example.test/post"),
  );
  fixture.run();
  assert.equal(fixture.calls.length, 2, "re-rendering an open item must not repeat automatic changes");
});

for (const options of [
  { host: false },
  { openFails: true },
  { protectedMode: false },
  { connected: false },
  { missingTitle: true },
]) {
  test(`RSS detail does not write when it cannot open (${JSON.stringify(options)})`, () => {
    const fixture = detailFixture(options);
    assert.doesNotThrow(() => fixture.run());
    assert.equal(fixture.dialog?.open || false, false);
    assert.equal(fixture.calls.length, 0);
  });
}

test("changing an item in the current unread scope does not close its open detail", async () => {
  const source = part("  async function setFeedFlag(", "  function applyFormValues(");
  const item = { id: "item-1", read: false, favorite: false, readLater: false };
  const state = {
    route: { view: "friends", scope: "unread", itemId: item.id },
    feedActionBusy: new Set(),
    feedFlagChanges: new Map(),
    feedFlagRevision: 0,
  };
  const feed = { items: [item], status: "ready" };
  const calls = [];
  const fn = vm.runInNewContext(`(${source.trim()})`, {
    capabilities: { canReadFeed: true },
    state,
    feed,
    URL,
    LINK_FEED_CONSOLE_API: "/apis/console.api.link.halo.run/v1alpha1/rss/items",
    window: { location: { origin: "https://halo.test" } },
    buildCsrfHeaders: () => ({}),
    signal: new AbortController().signal,
    activeFeedRequest: () => ({}),
    renderFeedResults() {},
    refreshUnreadCount() {},
    toast() {},
    navigate: (...args) => calls.push(["navigate", ...args]),
    fetch: async (url, options) => {
      calls.push(["request", url.href, options.method]);
      return { ok: true };
    },
  });
  await fn(item.id, "read", true, { quiet: true });
  assert.equal(item.read, true);
  assert.equal(feed.items.length, 1);
  assert(!calls.some((call) => call[0] === "navigate"));
  assert(
    calls.some((call) => call[0] === "request" && call[1].endsWith("/item-1/read?read=true") && call[2] === "POST"),
  );
});

test("a direct RSS detail waits for the protected feed instead of trusting public prefetched flags", () => {
  const source = part("  function captureFeedFocus(list)", "  function createFeedRow(item, request)");
  const keySource = part("function feedKey(", "function safeJsonResponse(");
  const state = {
    route: { view: "friends", scope: "all", itemId: "item-1" },
    feedDetailItemId: "",
    feedActionBusy: new Set(),
    autoMarked: new Set(),
  };
  const feed = { key: "public:all", items: [{ id: "item-1", read: false, readLater: false }], status: "ready" };
  const calls = [];
  const request = { scope: "all", protectedMode: true };
  const run = vm.runInNewContext(`(function () { ${keySource} ${source} return renderFeedResults; })()`, {
    state,
    feed,
    root: { querySelector: () => null },
    VALID_SCOPES: new Set(["all", "unread", "favorite", "later"]),
    syncFeedDialog: (value) => calls.push(value),
  });
  run(request);
  assert.equal(calls.at(-1), null, "public items do not contain authoritative personal status");
  feed.key = "console:all";
  run(request);
  assert.equal(calls.at(-1), request);
});

test("reopening a detail permits retry when its status remains unchanged", () => {
  const fixture = detailFixture();
  fixture.run();
  fixture.state.route.itemId = "";
  fixture.run();
  fixture.state.route.itemId = fixture.item.id;
  fixture.run();
  assert.equal(fixture.dialog.open, true);
  assert.equal(fixture.calls.length, 4);
});

test("a failed protected status request restores the old state and allows retry", async () => {
  const source = part("  async function setFeedFlag(", "  function applyFormValues(");
  const item = { id: "item-1", read: false, favorite: false, readLater: false };
  const state = {
    route: { view: "friends", scope: "unread", itemId: item.id },
    feedActionBusy: new Set(),
    feedFlagChanges: new Map(),
    feedFlagRevision: 0,
  };
  const feed = { items: [item], status: "ready" };
  let succeeds = false;
  let requests = 0;
  const fn = vm.runInNewContext(`(${source.trim()})`, {
    capabilities: { canReadFeed: true },
    state,
    feed,
    URL,
    LINK_FEED_CONSOLE_API: "/apis/console.api.link.halo.run/v1alpha1/rss/items",
    window: { location: { origin: "https://halo.test" } },
    buildCsrfHeaders: () => ({}),
    signal: new AbortController().signal,
    activeFeedRequest: () => ({}),
    renderFeedResults() {},
    refreshUnreadCount() {},
    toast() {},
    httpError: () => new Error("status save failed"),
    responseMessage: async () => "",
    fetch: async () => {
      requests += 1;
      return { ok: succeeds, status: succeeds ? 200 : 500 };
    },
  });
  await fn(item.id, "read", true, { quiet: true });
  assert.equal(item.read, false);
  assert.equal(state.feedActionBusy.size, 0);
  assert.equal(feed.items.length, 1);
  succeeds = true;
  await fn(item.id, "read", true, { quiet: true });
  assert.equal(item.read, true);
  assert.equal(requests, 2);
});

test("closing an already marked detail removes it from the unread filter", () => {
  const source = part("  function captureFeedFocus(list)", "  function createFeedRow(item, request)");
  const keySource = part("function feedKey(", "function safeJsonResponse(");
  const state = {
    route: { view: "friends", scope: "unread" },
    feedDetailItemId: "item-1",
    feedActionBusy: new Set(),
    autoMarked: new Set(["item-1"]),
  };
  const feed = { key: "console:unread", items: [{ id: "item-1", read: true }], status: "ready" };
  const run = vm.runInNewContext(`(function () { ${keySource} ${source} return renderFeedResults; })()`, {
    state,
    feed,
    root: { querySelector: () => null },
    VALID_SCOPES: new Set(["all", "unread", "favorite", "later"]),
    syncFeedDialog() {},
  });
  run({ scope: "unread", protectedMode: true });
  assert.equal(feed.items.length, 0);
  assert.equal(feed.status, "empty");
});

test("feed avatar responds to loading, failure, and page teardown", () => {
  const source = part("  function syncFeedAvatar(image)", '  root.addEventListener(\n    "click"');
  const controller = new AbortController();
  const fallback = { hidden: false, matches: (selector) => selector === "[data-feed-avatar-fallback]" };
  const image = {
    hidden: true,
    style: {},
    complete: false,
    naturalWidth: 0,
    nextElementSibling: fallback,
    matches: (selector) => selector === "[data-feed-avatar-image]",
  };
  let connected = true;
  const listeners = new Map();
  const root = {
    contains: () => connected,
    querySelectorAll: () => [image],
    addEventListener(type, callback, options) {
      assert.equal(options.capture, true);
      listeners.set(type, (event) => {
        if (!options.signal.aborted) callback(event);
      });
    },
  };
  vm.runInNewContext(`(function () { ${source} })()`, { root, signal: controller.signal });
  image.complete = true;
  image.naturalWidth = 40;
  listeners.get("load")({ target: image });
  assert.equal(image.hidden, false);
  assert.equal(fallback.hidden, true);
  image.naturalWidth = 0;
  listeners.get("error")({ target: image });
  assert.equal(image.hidden, true);
  assert.equal(fallback.hidden, false);
  connected = false;
  image.naturalWidth = 40;
  listeners.get("load")({ target: image });
  assert.equal(image.hidden, true, "events from replaced rows must not change the current page");
  connected = true;
  controller.abort();
  listeners.get("load")({ target: image });
  assert.equal(image.hidden, true, "events after page teardown must be ignored");
});

test("a cached SSR avatar is synchronized when listeners are installed", () => {
  const source = part("  function syncFeedAvatar(image)", '  root.addEventListener(\n    "click"');
  const fallback = { hidden: false, matches: (selector) => selector === "[data-feed-avatar-fallback]" };
  const image = {
    hidden: true,
    style: {},
    complete: true,
    naturalWidth: 20,
    nextElementSibling: fallback,
    matches: (selector) => selector === "[data-feed-avatar-image]",
  };
  const root = { contains: () => true, querySelectorAll: () => [image], addEventListener() {} };
  vm.runInNewContext(`(function () { ${source} })()`, { root, signal: new AbortController().signal });
  assert.equal(image.hidden, false);
  assert.equal(fallback.hidden, true);
});

test("a direct itemId on the default friends view opens in the all scope", async () => {
  const { normalizeLinksState } = await import("../src/apps/links/runtime.js");
  const result = normalizeLinksState({ view: "friends", itemId: "item-1" }, { canReadFeed: true });
  assert.deepEqual(result.state, { view: "friends", scope: "all", itemId: "item-1" });
});

test("a delayed programmatic close cannot erase a reopened RSS detail route", async () => {
  const helpers = part("  function showDialog(dialog)", "  function syncLinkDialog()");
  const listeners = part("  const linkDialog = root.querySelector", '  window.addEventListener(\n    "popstate"');
  let onClose;
  const dialog = {
    open: true,
    close() {
      this.open = false;
    },
    addEventListener(type, handler) {
      if (type === "close") onClose = handler;
    },
  };
  const state = { route: { view: "friends", scope: "all", itemId: "item-1" }, dialogSync: false };
  const navigations = [];
  const root = { querySelector: (selector) => (selector === "[data-feed-detail-dialog]" ? dialog : null) };
  const close = vm.runInNewContext(`(function () { ${helpers} ${listeners} return closeDialog; })()`, {
    root,
    state,
    signal: new AbortController().signal,
    queueMicrotask,
    programmaticDialogCloses: new WeakMap(),
    navigate: (...args) => navigations.push(args),
    document: { activeElement: null },
    restoreFeedFocus() {},
  });
  close(dialog);
  await Promise.resolve();
  dialog.open = true;
  onClose();
  assert.equal(navigations.length, 0);
  dialog.open = false;
  onClose();
  assert.equal(navigations.length, 1, "a subsequent user close must still clear the route");
});
