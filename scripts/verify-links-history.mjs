#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  buildCsrfHeaders,
  buildLinkFeedApiUrl,
  CURRENT_USER_API,
  LINK_FEED_CONSOLE_API,
  normalizeLinkCapabilities,
  normalizeHttpUrl,
  normalizeLinkFeedPage,
  PAGE_SIZE,
  sanitizePlainText,
} from "../src/apps/links/runtime.js";

const runtime = fs.readFileSync(new URL("../src/apps/links/runtime.js", import.meta.url), "utf8");
function part(start, end) {
  const first = runtime.indexOf(start);
  const last = runtime.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing production function boundary: ${start}`);
  return runtime.slice(first, last);
}

const item = (id, flags = {}) => ({
  id,
  linkName: "source-1",
  feedUrl: "https://example.test/feed.xml",
  guid: id,
  url: `https://example.test/${id}`,
  title: `文章 ${id}`,
  summary: "可阅读的摘要",
  author: "作者",
  publishedAt: "2026-10-28T00:00:00Z",
  updatedAt: "2026-10-28T00:00:00Z",
  firstSeenAt: "2026-10-28T00:00:00Z",
  fetchedAt: "2026-10-28T00:00:00Z",
  contentHash: "fixture-content",
  hidden: false,
  read: false,
  favorite: false,
  readLater: false,
  ...flags,
});
const page = (items, cursor = "") => ({
  items,
  hasNext: Boolean(cursor),
  nextBeforePublishedAt: cursor ? "2026-10-27T00:00:00Z" : null,
  nextBeforeId: cursor || null,
});
function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}
const settle = () => new Promise((done) => setImmediate(done));

// Compose the actual loader, renderer, dialog and status handlers.
// Only DOM/native dialog operations and HTTP are replaced; no real requests run.
function fixture(responses, { scope = "all", itemId = "target", checking = false, postResponses = [] } = {}) {
  const controller = new AbortController();
  const state = {
    route: { view: "friends", scope, itemId },
    feedDetails: new Map(),
    autoMarked: new Set(),
    feedActionBusy: new Set(),
    feedFlagChanges: new Map(),
    feedFlagRevision: 0,
    feedDetailItemId: "",
  };
  const feed = {
    key: "",
    items: [],
    hasNext: false,
    nextBeforePublishedAt: "",
    nextBeforeId: "",
    status: "idle",
    generation: 0,
    controller: null,
  };
  const capabilities = { status: checking ? "checking" : "ready", canReadFeed: !checking, username: "reader" };
  const dialog = {
    open: false,
    isConnected: true,
    showModal() {
      this.open = true;
    },
    setAttribute() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
  const nodes = Object.fromEntries(
    ["title", "summary", "author", "time", "visit"].map((key) => [key, { textContent: "", hidden: false }]),
  );
  const loadMore = { hidden: true, disabled: false, textContent: "" };
  const notice = { hidden: true, textContent: "" };
  const root = {
    contains: () => true,
    querySelector(selector) {
      if (selector === "[data-feed-detail-dialog]") return dialog;
      if (selector === "[data-feed-load-more]") return loadMore;
      if (selector === "[data-feed-detail-notice]") return notice;
      return nodes[selector.match(/^\[data-feed-detail-(title|summary|author|time|visit)\]$/)?.[1]] || null;
    },
    querySelectorAll: () => [],
  };
  const requests = [];
  const writes = [];
  const notifications = [];
  let api;
  const context = {
    AbortController,
    PAGE_SIZE,
    LINK_FEED_CONSOLE_API,
    CURRENT_USER_API,
    USER_PERMISSIONS_API: "/apis/api.console.halo.run/v1alpha1/users",
    normalizeLinkCapabilities,
    normalizeLinksState: (route) => ({ state: route }),
    routeContext: () => ({}),
    timeoutController: () => ({ controller: new AbortController(), dispose() {} }),
    VALID_SCOPES: new Set(["all", "unread", "favorite", "later"]),
    URL,
    state,
    feed,
    capabilities,
    root,
    signal: controller.signal,
    programmaticDialogCloses: new WeakMap(),
    buildLinkFeedApiUrl,
    buildCsrfHeaders: () => buildCsrfHeaders("XSRF-TOKEN=fixture-token"),
    normalizeHttpUrl,
    normalizeLinkFeedPage,
    sanitizePlainText,
    formatDate: (value) => value,
    window: { location: { origin: "https://halo.test" } },
    activeFeedRequest: () => api.routeFeedRequest(state.route, capabilities),
    renderPanels() {},
    renderLinksView() {},
    renderApplyCapability() {},
    syncLinkDialog() {},
    refreshUnreadCount() {},
    renderFeedView() {
      const request = context.activeFeedRequest();
      api.renderFeedResults(request);
      api.ensureFeed(request);
    },
    normalizeLocation() {
      if (!capabilities.canReadFeed) delete state.route.itemId;
    },
    commitRoute(route) {
      if (capabilities.error) throw new Error(capabilities.error);
      state.route = route;
      api.render();
    },
    navigate(patch) {
      for (const [key, value] of Object.entries(patch)) {
        if (value == null) delete state.route[key];
        else state.route[key] = value;
      }
    },
    toast: (message) => notifications.push(message),
    fetch: async (url, options) => {
      if (String(url) === CURRENT_USER_API || String(url).endsWith("/permissions")) {
        const payload =
          String(url) === CURRENT_USER_API
            ? { user: { metadata: { name: "reader" }, spec: { disabled: false } } }
            : { uiPermissions: ["plugin:links:view"] };
        return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
      }
      const entry = { url: new URL(url), options };
      if (options.method === "POST") {
        writes.push({ ...entry, open: dialog.open, title: nodes.title.textContent });
        const result = postResponses.length ? await postResponses.shift() : null;
        if (result instanceof Error) throw result;
        return result instanceof Response ? result : new Response(null, { status: 204 });
      }
      requests.push(entry);
      assert(responses.length, "The loader must not request an unspecified cursor page");
      const result = await responses.shift();
      if (result instanceof Error) throw result;
      return result instanceof Response
        ? result
        : new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    },
  };
  const source = [
    part("function stringValue(", "function orderedState("),
    part("function feedKey(", "function timeoutController("),
    part("function routeFeedRequest(", "function icon("),
    part("  function render()", "  async function resolveCapabilities("),
    part("  async function resolveCapabilities(", "  async function refreshUnreadCount("),
    part("  function ensureFeed(", "  function createFeedRow("),
    part("  function setText(", "  function syncLinkDialog("),
    part("  function syncFeedDialog(", "  function applyFormValues("),
  ].join("\n");
  api = vm.runInNewContext(
    `(function () { ${source} return { loadFeed, ensureFeed, renderFeedResults, render, resolveCapabilities, syncFeedDialog, setFeedFlag, routeFeedRequest }; })()`,
    context,
  );
  return {
    ...api,
    state,
    feed,
    capabilities,
    dialog,
    nodes,
    loadMore,
    notice,
    requests,
    writes,
    notifications,
    responses,
    controller,
    request: context.activeFeedRequest,
    load: (options) => api.loadFeed(context.activeFeedRequest(), options),
  };
}

test("permission resolution starts the protected first page only once", async () => {
  const delayed = deferred();
  const f = fixture([delayed.promise, page([item("unexpected")])], { checking: true });
  f.render();
  assert.equal(f.requests.length, 0);
  await f.resolveCapabilities();
  assert.equal(f.requests.length, 1);
  delayed.resolve(page([item("first")], "next-cursor"));
  await settle();
  assert.equal(f.requests.length, 1);
  assert.equal(f.feed.items[0].id, "first");
});

test("a cold deep link loads one page and reaches its target only after explicit load-more", async () => {
  const f = fixture([page([item("first")], "first-cursor"), page([item("target")])]);
  await f.load();
  await settle();
  assert.equal(f.requests.length, 1);
  assert.equal(f.notice.hidden, false);
  assert.match(f.notice.textContent, /尚未加载/);
  assert.equal(f.dialog.open, false);
  assert.equal(f.writes.length, 0);
  f.render();
  f.ensureFeed(f.request());
  await settle();
  assert.equal(f.requests.length, 1, "rendering cannot start background pagination");
  await f.load({ replace: false });
  await settle();
  assert.equal(f.requests.length, 2);
  assert.equal(f.notice.hidden, true);
  assert.equal(f.requests[1].url.searchParams.get("beforeId"), "first-cursor");
  assert.equal(f.requests[1].url.searchParams.get("beforePublishedAt"), "2026-10-27T00:00:00Z");
  assert.equal(f.state.route.itemId, "target");
  assert.equal(f.dialog.open, true);
  assert.equal(f.nodes.title.textContent, "文章 target");
  assert.equal(f.writes.length, 1);
  assert(f.writes.every((request) => request.open && request.title === "文章 target"));
});

test("history restores an opened item removed from unread without another automatic write", async () => {
  const f = fixture([page([item("target", { readLater: true })])], { scope: "unread" });
  await f.load();
  await settle();
  assert.equal(f.dialog.open, true);
  assert.equal(f.writes.length, 2);
  delete f.state.route.itemId;
  f.renderFeedResults(f.request());
  assert.equal(f.feed.items.length, 0);
  assert.equal(f.dialog.open, false);
  f.state.route.itemId = "target";
  f.renderFeedResults(f.request());
  await settle();
  assert.equal(f.dialog.open, true);
  assert.equal(f.nodes.title.textContent, "文章 target");
  assert.equal(f.writes.length, 2);
});

test("an unread deep link does not scan all items or claim the target was deleted", async () => {
  const f = fixture([page([item("another-unread")])], { scope: "unread" });
  await f.load();
  await settle();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url.searchParams.get("read"), "false");
  assert.equal(f.state.route.itemId, "target");
  assert.equal(f.notice.hidden, false);
  assert.match(f.notice.textContent, /筛选/);
  assert.equal(f.dialog.open, false);
  assert.equal(f.notifications.length, 0);
  assert.equal(f.writes.length, 0);
  f.render();
  await settle();
  assert.equal(f.requests.length, 1);
});

test("history can restore an opened item while an explicitly requested page is pending", async () => {
  const late = deferred();
  const f = fixture([page([item("previous", { read: true })], "older-cursor"), late.promise], {
    itemId: "previous",
  });
  await f.load();
  delete f.state.route.itemId;
  f.render();
  const pending = f.load({ replace: false });
  await settle();
  f.state.route.itemId = "previous";
  f.render();
  late.resolve(page([item("target", { read: true })]));
  await pending;
  await settle();
  assert.equal(f.requests.length, 2);
  assert.equal(f.dialog.open, true);
  assert.equal(f.nodes.title.textContent, "文章 previous");
  assert.equal(f.notifications.length, 0);
  assert.equal(f.writes.length, 0);
});

for (const [scope, flags, property, savedValue] of [
  ["unread", {}, "read", true],
  ["later", { read: true, readLater: true }, "readLater", false],
]) {
  test(`a pending ${scope} save updates the reloaded item after switching filters`, async () => {
    const saved = deferred();
    const f = fixture([page([item("target", flags)]), page([item("target", flags)]), page([item("target", flags)])], {
      scope,
      postResponses: [saved.promise],
    });
    await f.load();
    await settle();
    f.state.route = { view: "friends", scope: "all" };
    f.render();
    await settle();
    f.state.route = { view: "friends", scope, itemId: "target" };
    f.render();
    await settle();
    saved.resolve(new Response(null, { status: 204 }));
    await settle();
    assert.equal(f.writes.length, 1);
    assert.equal(f.feed.items[0][property], savedValue);
    assert.equal(f.state.feedDetails.get("target")[property], savedValue);
    delete f.state.route.itemId;
    f.renderFeedResults(f.request());
    assert.equal(f.feed.items.length, 0);
    f.state.route.itemId = "target";
    f.renderFeedResults(f.request());
    await settle();
    assert.equal(f.dialog.open, true);
    assert.equal(f.writes.length, 1, "restoring the saved item must not repeat its automatic write");
  });
}

test("a list response started before a status save cannot overwrite the saved state", async () => {
  const saved = deferred();
  const staleList = deferred();
  const f = fixture([page([item("target")]), staleList.promise], {
    scope: "unread",
    postResponses: [saved.promise],
  });
  await f.load();
  await settle();
  f.state.route = { view: "friends", scope: "all" };
  f.render();
  await settle();
  saved.resolve(new Response(null, { status: 204 }));
  await settle();
  staleList.resolve(page([item("target")]));
  await settle();
  assert.equal(f.feed.items[0].read, true);
  assert.equal(f.state.feedDetails.get("target").read, true);
  assert.equal(f.writes.length, 1);
});

test("a failed status save rolls back both the reloaded item and its cached detail", async () => {
  const saved = deferred();
  const f = fixture([page([item("target")]), page([item("target")])], {
    scope: "unread",
    postResponses: [saved.promise],
  });
  await f.load();
  await settle();
  f.state.route = { view: "friends", scope: "all" };
  f.render();
  await settle();
  assert.equal(f.feed.items[0].read, true, "a pending save must survive a list replacement");
  saved.resolve(new Response("Unavailable", { status: 503 }));
  await settle();
  assert.equal(f.feed.items[0].read, false);
  assert.equal(f.state.feedDetails.get("target").read, false);
  assert.equal(f.state.feedActionBusy.size, 0);
  assert.equal(f.writes.length, 1);
});

test("a stale unread response cannot put a successfully read item back into the unread list", async () => {
  const saved = deferred();
  const staleList = deferred();
  const f = fixture([page([item("target")]), page([item("target")]), staleList.promise], {
    scope: "unread",
    postResponses: [saved.promise],
  });
  await f.load();
  await settle();
  f.state.route = { view: "friends", scope: "all" };
  f.render();
  await settle();
  f.state.route = { view: "friends", scope: "unread" };
  f.render();
  await settle();
  saved.resolve(new Response(null, { status: 204 }));
  await settle();
  staleList.resolve(page([item("target")]));
  await settle();
  assert.equal(f.feed.items.length, 0);
  assert.equal(f.feed.status, "empty");
  assert.equal(f.state.feedDetails.get("target").read, true);
  assert.equal(f.writes.length, 1);
});

const filteredScopes = [
  {
    scope: "unread",
    flags: {},
    field: "read",
    property: "read",
    previous: false,
    value: true,
    automatic: true,
    otherField: "favorite",
    otherProperty: "favorite",
    otherPrevious: false,
    otherValue: true,
  },
  {
    scope: "favorite",
    flags: { read: true, favorite: true },
    field: "favorite",
    property: "favorite",
    previous: true,
    value: false,
    automatic: false,
    otherField: "read",
    otherProperty: "read",
    otherPrevious: true,
    otherValue: false,
  },
  {
    scope: "later",
    flags: { read: true, readLater: true },
    field: "later",
    property: "readLater",
    previous: true,
    value: false,
    automatic: true,
    otherField: "favorite",
    otherProperty: "favorite",
    otherPrevious: false,
    otherValue: true,
  },
];

for (const config of filteredScopes) {
  for (const first of ["scope", "other"]) {
    for (const scopeSuccess of [true, false]) {
      for (const otherSuccess of [true, false]) {
        test(`${config.scope} keeps closed-detail rows consistent when ${first} finishes first (${scopeSuccess}/${otherSuccess})`, async () => {
          const scopeSave = deferred();
          const otherSave = deferred();
          const f = fixture([page([item("target", config.flags)])], {
            scope: config.scope,
            postResponses: [scopeSave.promise, otherSave.promise],
          });
          await f.load();
          await settle();
          if (!config.automatic) f.setFeedFlag("target", config.field, config.value);
          const pendingOther = f.setFeedFlag("target", config.otherField, config.otherValue);
          delete f.state.route.itemId;
          f.render();
          assert.equal(f.feed.items.length, 1, "the pending filter field must keep its row");

          const complete = (pending, success) =>
            pending.resolve(new Response(success ? null : "Unavailable", { status: success ? 204 : 503 }));
          complete(first === "scope" ? scopeSave : otherSave, first === "scope" ? scopeSuccess : otherSuccess);
          await settle();
          assert.equal(
            f.feed.items.length,
            first === "scope" && scopeSuccess ? 0 : 1,
            "an unrelated completion cannot apply a pending filter change",
          );
          complete(first === "scope" ? otherSave : scopeSave, first === "scope" ? otherSuccess : scopeSuccess);
          await pendingOther;
          await settle();
          assert.equal(f.feed.items.length, scopeSuccess ? 0 : 1);
          const cached = f.state.feedDetails.get("target");
          assert.equal(cached[config.property], scopeSuccess ? config.value : config.previous);
          assert.equal(cached[config.otherProperty], otherSuccess ? config.otherValue : config.otherPrevious);
          if (!scopeSuccess) {
            assert.equal(f.feed.items[0][config.property], config.previous);
            assert.equal(
              f.feed.items[0][config.otherProperty],
              otherSuccess ? config.otherValue : config.otherPrevious,
            );
          }
          assert.equal(f.state.feedActionBusy.size, 0);
          assert.equal(f.dialog.open, false);
          assert.equal(f.writes.length, 2);
        });
      }
    }
  }

  test(`${config.scope} can load older results after all 20 visible rows leave the filter`, async () => {
    const f = fixture(
      [
        page(
          Array.from({ length: 20 }, (_, index) => item(`visible-${index}`, config.flags)),
          "older-cursor",
        ),
        page([item("older", config.flags)]),
      ],
      { scope: config.scope, itemId: "" },
    );
    await f.load();
    for (let index = 0; index < 20; index++) {
      const id = `visible-${index}`;
      f.state.route.itemId = id;
      f.render();
      await settle();
      if (!config.automatic) await f.setFeedFlag(id, config.field, config.value);
      delete f.state.route.itemId;
      f.render();
      await settle();
    }
    assert.equal(f.feed.items.length, 0);
    assert.equal(f.feed.hasNext, true);
    assert.equal(f.loadMore.hidden, false, "older filtered rows must remain reachable");
    assert.equal(f.loadMore.disabled, false);
    await f.load({ replace: false });
    assert.equal(f.requests[1].url.searchParams.get("beforeId"), "older-cursor");
    assert.deepEqual(
      Array.from(f.feed.items, (entry) => entry.id),
      ["older"],
    );
  });
}

test("a stale filtered page with no remaining rows preserves access to its next cursor", async () => {
  const saved = deferred();
  const staleList = deferred();
  const f = fixture([page([item("target")]), page([item("target")]), staleList.promise, page([item("older")])], {
    scope: "unread",
    postResponses: [saved.promise],
  });
  await f.load();
  await settle();
  f.state.route = { view: "friends", scope: "all" };
  f.render();
  await settle();
  f.state.route = { view: "friends", scope: "unread" };
  f.render();
  await settle();
  saved.resolve(new Response(null, { status: 204 }));
  await settle();
  staleList.resolve(page([item("target")], "older-cursor"));
  await settle();
  assert.equal(f.feed.items.length, 0);
  assert.equal(f.feed.hasNext, true);
  assert.equal(f.loadMore.hidden, false);
  assert.equal(f.loadMore.disabled, false);
  await f.load({ replace: false });
  assert.equal(f.requests[3].url.searchParams.get("beforeId"), "older-cursor");
  assert.deepEqual(
    Array.from(f.feed.items, (entry) => entry.id),
    ["older"],
  );
});

test("an exhausted list preserves an unresolved target without reporting deletion", async () => {
  const f = fixture([page([item("first")])]);
  await f.load();
  assert.equal(f.requests.length, 1);
  assert.equal(f.state.route.itemId, "target");
  assert.equal(f.notice.hidden, false);
  assert.equal(f.notifications.length, 0);
  assert.equal(f.dialog.open, false);
  assert.equal(f.writes.length, 0);
});

test("a failed explicit cursor load preserves the target and can be retried", async () => {
  const f = fixture([page([item("first")], "first-cursor"), new Response("Unavailable", { status: 503 })]);
  await f.load();
  await f.load({ replace: false });
  assert.equal(f.state.route.itemId, "target");
  assert.equal(f.feed.status, "error");
  assert.equal(f.writes.length, 0);
  f.responses.push(page([item("target")]));
  await f.load({ force: true });
  await settle();
  assert.equal(f.dialog.open, true);
  assert.equal(f.writes.length, 1);
});

test("a repeated explicit cursor stops without dropping the target", async () => {
  const f = fixture([page([item("first")], "repeated-cursor"), page([item("second")], "repeated-cursor")]);
  await f.load();
  await f.load({ replace: false });
  assert.equal(f.requests.length, 2);
  assert.equal(f.state.route.itemId, "target");
  assert.equal(f.feed.status, "error");
  assert.equal(f.writes.length, 0);
});

test("ordinary load-more reports a repeated cursor instead of offering the same page again", async () => {
  const f = fixture([page([item("first")], "repeated-cursor"), page([item("second")], "repeated-cursor")], {
    itemId: "",
  });
  await f.load();
  await f.load({ replace: false });
  assert.equal(f.requests.length, 2);
  assert.equal(f.feed.status, "error");
  assert.match(f.feed.message, /重试/);
  assert.doesNotMatch(f.feed.message, /游标|JSON|HTTP/);
  assert.equal(f.writes.length, 0);
});

test("ordinary load-more remembers earlier cursors and a full retry starts a new sequence", async () => {
  const f = fixture(
    [page([item("first")], "cursor-a"), page([item("second")], "cursor-b"), page([item("third")], "cursor-a")],
    { itemId: "" },
  );
  await f.load();
  await f.load({ replace: false });
  assert.equal(f.feed.status, "ready");
  await f.load({ replace: false });
  assert.equal(f.requests.length, 3);
  assert.equal(f.feed.status, "error");
  assert.match(f.feed.message, /重试/);
  assert.doesNotMatch(f.feed.message, /游标|JSON|HTTP/);
  f.responses.push(page([item("fresh")], "cursor-a"));
  await f.load({ force: true });
  assert.equal(f.feed.status, "ready");
  assert.deepEqual(
    Array.from(f.feed.items, (entry) => entry.id),
    ["fresh"],
  );
});

test("a hasNext page without a cursor remains retryable instead of claiming the item is missing", async () => {
  const f = fixture([{ ...page([item("first")]), hasNext: true }]);
  await f.load();
  assert.equal(f.state.route.itemId, "target");
  assert.equal(f.feed.status, "error");
  assert.equal(f.notifications.length, 0);
  assert.equal(f.writes.length, 0);
});

for (const action of ["leave", "filter", "abort"]) {
  test(`a delayed cursor cannot reopen or write after ${action}`, async () => {
    const late = deferred();
    const f = fixture([page([item("first")], "first-cursor"), late.promise]);
    await f.load();
    const pending = f.load({ replace: false });
    await settle();
    assert.equal(f.requests.length, 2);
    if (action === "leave") {
      f.state.route = { view: "apply" };
      f.render();
      assert.equal(f.requests[1].options.signal.aborted, true);
    } else if (action === "filter") {
      f.state.route = { view: "friends", scope: "favorite" };
      f.responses.push(page([item("new-filter", { favorite: true, read: true })]));
      await f.load();
    } else f.controller.abort();
    late.resolve(page([item("target")]));
    await pending;
    await settle();
    assert.equal(f.dialog.open, false);
    assert.equal(f.writes.length, 0);
    if (action === "filter") assert.equal(f.feed.items[0].id, "new-filter");
  });
}

test("permission checking never starts a public lookup that can discard the private target", () => {
  const f = fixture([page([])], { checking: true });
  f.ensureFeed(f.request());
  assert.equal(f.requests.length, 0);
  assert.equal(f.state.route.itemId, "target");
});

test("revoking RSS permission clears the opened-item cache and closes its dialog", async () => {
  const f = fixture([page([item("target", { read: true })])]);
  await f.load();
  assert.equal(f.state.feedDetails.size, 1);
  f.capabilities.canReadFeed = false;
  f.renderFeedResults(f.request());
  assert.equal(f.state.feedDetails.size, 0);
  assert.equal(f.dialog.open, false);
  f.state.route.itemId = "target";
  f.syncFeedDialog(f.request());
  assert.equal(f.dialog.open, false);
  assert.equal(f.writes.length, 0);
});
