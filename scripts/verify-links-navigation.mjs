import assert from "node:assert/strict";
import test from "node:test";
import { createHistoryRecord, updateHistoryRecord } from "swup";
import { isSameLinksResource } from "../src/apps/links/history.js";
import { ignoreDocumentVisit, resolveThemeUrl } from "../src/common/js/navigation-policy.js";
import { collectionCanonical } from "../src/common/js/collection-canonical.js";

const origin = "https://halo.test";

test("Links filter and detail URLs are local, preserving preview and server filters", () => {
  const old = "/links?preview-theme=sky&server=1&view=links";
  const local = "/links?view=friends&itemId=5&server=1&preview-theme=sky";
  assert.equal(resolveThemeUrl(old, origin), resolveThemeUrl(local, origin));
  assert.ok(isSameLinksResource(origin + old, origin + local));
  for (const different of ["/archives", "/links?preview-theme=other&server=1", "/links?server=2&preview-theme=sky"]) {
    assert.notEqual(resolveThemeUrl(old, origin), resolveThemeUrl(different, origin));
    assert.equal(isSameLinksResource(origin + old, origin + different), false);
  }
});

test("Douban uses its client API query and keeps independent server query and preview", () => {
  assert.equal(resolveThemeUrl("/douban?page=2&status=done&genre=TV&preview-theme=sky", origin),
    "/douban?preview-theme=sky");
  assert.equal(resolveThemeUrl("/douban?account=1&preview-theme=sky", origin),
    "/douban?account=1&preview-theme=sky");
});

test("scope links use Swup's history record format and preserve the current URL on revisit", (t) => {
  let current;
  const previous = globalThis.window;
  globalThis.window = {
    history: {
      get state() { return current; },
      pushState(data) { current = data; },
      replaceState(data) { current = data; },
    }
  };
  t.after(() => {
    if (previous) globalThis.window = previous;
    else delete globalThis.window;
  });
  createHistoryRecord("/links?view=friends&preview-theme=sky");
  assert.equal(current.source, "swup");
  updateHistoryRecord("/links?view=friends&itemId=5&preview-theme=sky");
  assert.equal(current.url, "/links?view=friends&itemId=5&preview-theme=sky");
});

test("auth, independent apps, and opt-out links retain a full-document lifecycle", () => {
  for (const route of ["/login", "/uc/profile", "/dishes", "/schedule-calendar/view", "https://example.test"]) {
    assert.equal(ignoreDocumentVisit(route, origin), true);
  }
  assert.equal(ignoreDocumentVisit("/schedule-calendar-example", origin), false);
  assert.equal(ignoreDocumentVisit("/links", origin, { closest: () => ({}) }), true);
});

test("collection canonical follows the actual server page and ignores malformed aliases", () => {
  const content = (data, sections = []) => ({
    dataset: data,
    querySelectorAll: () => sections,
    querySelector: () => null,
  });
  const tags = content({
    collectionBase: "/tags",
    collectionMode: "query",
    collectionPage: "2",
    collectionTotalPages: "4",
  });
  assert.equal(collectionCanonical(tags, new URL("http://localhost:8090/tags?page=2"), "https://halo.test"),
    "https://halo.test/tags?p=2");
  const first = content({
    collectionBase: "/categories",
    collectionMode: "query",
    collectionPage: "1",
    collectionTotalPages: "4",
  });
  assert.equal(collectionCanonical(first, new URL("https://halo.test/categories?p=abc")), "https://halo.test/categories");
  const moments = content({
    collectionBase: "/moments",
    collectionMode: "path",
    collectionPage: "3",
    collectionTotalPages: "5",
  });
  assert.equal(collectionCanonical(moments, new URL("https://halo.test/moments?owner=sky")), "https://halo.test/moments/page/3");
  const photos = content({
    collectionBase: "/photos",
    collectionMode: "photos",
    collectionPage: "2",
    collectionTotalPages: "5",
    collectionSize: "20",
  });
  assert.equal(collectionCanonical(photos, new URL("https://halo.test/photos?page=2&size=20")), "https://halo.test/photos?page=2&size=20");
  const detail = content({
    collectionBase: "/moments/hello",
    collectionMode: "direct",
    collectionPage: "1",
    collectionTotalPages: "0",
  });
  assert.equal(collectionCanonical(detail, new URL("https://halo.test/moments/hello")), "https://halo.test/moments/hello");
});
