import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/pages/douban/douban.js", import.meta.url), "utf8");
const part = (start, end) => {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing production boundary: ${start}`);
  return source.slice(first, last);
};
const settle = () => new Promise(resolve => setImmediate(resolve));
const result = (page, totalPages, total, items = []) => ({
  page, totalPages, total, items, hasPrevious: page > 1, hasNext: page < totalPages,
});

function setup(page = 1, filters = {}) {
  const state = { page, size: 20, status: "done", type: "", genre: "", dataType: "", ...filters };
  const controller = new AbortController();
  const requests = [];
  const history = [];
  const window = {
    location: new URL(`https://example.com/douban?page=${page}&preview-theme=theme-sky-blog-1#library`),
    history: {
      state: { existing: true },
      replaceState(value, _, path) { this.state = value; history.push({ method: "replace", path }); window.location = new URL(path, window.location); },
      pushState(value, _, path) { this.state = value; history.push({ method: "push", path }); window.location = new URL(path, window.location); },
    },
  };
  const els = Object.fromEntries([
    "grid", "total", "pageInfo", "empty", "emptyTitle", "emptyDescription", "pagination", "error", "errorTitle",
    "errorDescription", "reset", "loading", "prev", "next",
  ].map(key => [key, { hidden: true, textContent: "", replaceChildren(...children) { this.children = children; } }]));
  const api = vm.runInNewContext(`(() => {
    let itemsRequest = null;
    let pagination = null;
    ${part("function normalizeListResult", "function formatDate")}
    ${part("function buildUrl", "function parseBoundedPositiveInteger")}
    ${part("function syncQueryState", "function initDoubanPage")}
    ${part("  const renderItems =", "  const loadGenres =")}
    return { loadItems, cleanup() { controller.abort(); itemsRequest?.abort(); } };
  })()`, {
    state, els, controller, signal: controller.signal, window, URL, AbortController,
    API_BASE: "/apis/api.douban.moony.la/v1alpha1/doubanmovies",
    QUERY_KEYS: ["dataType", "genre", "page", "size", "type", "status"],
    createCard: item => item, updatePaginationButtons() {},
    setHidden(element, hidden) { element.hidden = hidden; },
    skyDebug: { warn() {} },
    fetch(url, { signal }) {
      return new Promise((resolve, reject) => requests.push({
        url: String(url), signal, reject,
        resolve(data) { resolve({ ok: true, json: async () => data }); },
      }));
    },
  });
  return { ...api, state, els, history, requests, window };
}

test("an out-of-range page reloads the last valid page once and replaces history without dropping filters or preview", async () => {
  const f = setup(9999, { type: "book", genre: "文学" });
  const loading = f.loadItems();
  f.requests[0].resolve(result(9999, 2, 21));
  await settle();
  assert.equal(f.requests.length, 2);
  const corrected = new URL(f.requests[1].url);
  assert.equal(corrected.searchParams.get("page"), "2");
  assert.equal(corrected.searchParams.get("type"), "book");
  assert.equal(corrected.searchParams.get("genre"), "文学");
  assert.equal(f.els.loading.hidden, false);
  f.requests[1].resolve(result(2, 2, 21, [{ name: "last record" }]));
  await loading;
  assert.equal(f.state.page, 2);
  assert.equal(f.els.grid.children.length, 1);
  assert.equal(f.els.empty.hidden, true);
  assert.equal(f.els.error.hidden, true);
  assert.equal(f.history.length, 1);
  assert.equal(f.history[0].method, "replace");
  assert.equal(f.window.location.searchParams.get("preview-theme"), "theme-sky-blog-1");
  assert.equal(f.window.location.hash, "#library");
  assert.equal(f.window.history.state.existing, true);
});

for (const filters of [{}, { type: "book", genre: "文学" }]) {
  test(`a first-page empty result remains empty without another request: ${JSON.stringify(filters)}`, async () => {
    const f = setup(1, filters);
    const loading = f.loadItems();
    f.requests[0].resolve(result(1, 0, 0));
    await loading;
    assert.equal(f.requests.length, 1);
    assert.equal(f.history.length, 0);
    assert.equal(f.els.empty.hidden, false);
    assert.equal(f.els.error.hidden, true);
  });
}

test("an empty catalog reached through an old page returns to page one and preserves the empty state", async () => {
  const f = setup(99);
  const loading = f.loadItems();
  f.requests[0].resolve(result(99, 0, 0));
  await settle();
  assert.equal(f.requests.length, 2);
  assert.equal(new URL(f.requests[1].url).searchParams.get("page"), "1");
  f.requests[1].resolve(result(1, 0, 0));
  await loading;
  assert.equal(f.state.page, 1);
  assert.equal(f.els.empty.hidden, false);
  assert.equal(f.els.error.hidden, true);
});

test("a second shrinking result stops after one correction and offers recovery instead of looping", async () => {
  const f = setup(99);
  const loading = f.loadItems();
  f.requests[0].resolve(result(99, 3, 42));
  await settle();
  assert.equal(f.requests.length, 2);
  f.requests[1].resolve(result(3, 1, 8));
  await loading;
  assert.equal(f.requests.length, 2);
  assert.equal(f.els.error.hidden, false);
  assert.equal(f.els.reset.hidden, false);
  assert.equal(f.els.empty.hidden, true);
  assert.equal(f.els.loading.hidden, true);
});

test("a correction failure shows an error and an explicit retry uses the corrected page", async () => {
  const f = setup(99);
  const loading = f.loadItems();
  f.requests[0].resolve(result(99, 1, 8));
  await settle();
  assert.equal(f.requests.length, 2);
  f.requests[1].reject(new Error("offline"));
  await loading;
  assert.equal(f.els.error.hidden, false);
  assert.equal(f.els.empty.hidden, true);
  const retry = f.loadItems();
  assert.equal(new URL(f.requests[2].url).searchParams.get("page"), "1");
  f.requests[2].resolve(result(1, 1, 8, [{ name: "record" }]));
  await retry;
  assert.equal(f.els.error.hidden, true);
  assert.equal(f.els.grid.children.length, 1);
});

test("an old response cannot correct the URL or fetch again after a filter change", async () => {
  const f = setup(99);
  const old = f.loadItems();
  Object.assign(f.state, { page: 1, type: "book" });
  const current = f.loadItems();
  f.requests[0].resolve(result(99, 1, 8));
  await old;
  assert.equal(f.requests.length, 2);
  assert.equal(f.history.length, 0);
  f.requests[1].resolve(result(1, 1, 1, [{ name: "book" }]));
  await current;
  assert.equal(f.els.grid.children[0].name, "book");
});

test("leaving while the correction is pending prevents late content or history changes", async () => {
  const f = setup(99);
  const loading = f.loadItems();
  f.requests[0].resolve(result(99, 1, 8));
  await settle();
  assert.equal(f.requests.length, 2);
  f.cleanup();
  assert.equal(f.requests[1].signal.aborted, true);
  f.requests[1].resolve(result(1, 1, 8, [{ name: "late record" }]));
  await loading;
  assert.equal(f.els.grid.children, undefined);
  assert.equal(f.history.length, 1);
});
