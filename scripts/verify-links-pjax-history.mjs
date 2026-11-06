import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import Swup, { Location } from "swup";
import { isSameLinksResource, linksHistoryState } from "../src/apps/links/history.js";
import { normalizeLinksUrl, normalizeLinksState, applyLinksStateToUrl, historyPath } from "../src/apps/links/runtime.js";

const main = fs.readFileSync(new URL("../src/common/main.js", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/apps/links/runtime.js", import.meta.url), "utf8");
function part(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing production boundary: ${start}`);
  return source.slice(first, last);
}

function fixture({ initial = "/links?view=friends&scope=all&preview-theme=sky", enabled = true, historyState } = {}) {
  const origin = "https://halo.test";
  const entries = [{ url: new URL(initial, origin), state: historyState === undefined
    ? { source: "swup", url: initial, index: 3, custom: "preserved" } : historyState }];
  let position = 0;
  const listeners = new Map();
  const document = { baseURI: origin, querySelector: () => ({}) };
  const window = {
    __skyPjaxEnabled: enabled,
    get location() { return entries[position].url; },
    history: {
      get state() { return entries[position].state; },
      replaceState(state, _title, url) { entries[position] = { state, url: new URL(url, origin) }; },
      pushState(state, _title, url) {
        entries.splice(++position, entries.length, { state, url: new URL(url, origin) });
      },
    },
    addEventListener: (name, fn) => listeners.set(name, fn),
  };
  const visits = [];
  class ConfiguredSwup {
    constructor(options) {
      this.location = new Location(window.location.href, origin);
      this.options = { skipPopStateHandling: event => event.state?.source !== "swup", ...options };
      this.currentHistoryIndex = 3;
      this.isSameResolvedUrl = (a, b) => a === b;
      this.createVisit = ({ to, hash }) => ({ to: { url: to, hash }, history: {}, animation: {}, scroll: {} });
      this.hooks = { callSync: (_name, _visit, _args, run) => run() };
      this.performNavigation = visit => visits.push(visit);
    }
  }
  const config = part(main, "if (window.__skyPjaxEnabled !== false) {", "  window.__swup = swup;");
  vm.runInNewContext(`${part(main, "function isRouteOrDescendant(", "if (window.__skyPjaxEnabled")}\n${config}\nwindow.__swup = swup; }`, {
    window, document, URL, Swup: ConfiguredSwup, SwupHeadPlugin: class {}, SwupScriptsPlugin: class {}, isSameLinksResource,
  });
  const state = { route: {} };
  const renders = [];
  const context = {
    window, URL, state, linksHistoryState, normalizeLinksUrl, normalizeLinksState, applyLinksStateToUrl, historyPath,
    isSameLinksResource, mountedUrl: window.location.href,
    routeContext: () => ({}), toast() {}, signal: new AbortController().signal,
    render: () => renders.push({ ...state.route }), focusBoard() {},
  };
  const api = vm.runInNewContext(`(() => {
    ${part(runtime, "  function normalizeLocation(", "  function focusBoard(")}
    ${part(runtime, "  function commitRoute(", "  function renderPanels(")}
    ${part(runtime, '  window.addEventListener(\n    "popstate"', "  const initial = normalizeLocation();")}
    return { normalizeLocation, navigate, commitRoute };
  })()`, context);
  function pop(index) {
    position = index;
    const savedWindow = globalThis.window;
    const savedDocument = globalThis.document;
    globalThis.window = window;
    globalThis.document = document;
    try {
      const event = { state: window.history.state };
      if (window.__swup) Swup.prototype.handlePopState.call(window.__swup, event);
      listeners.get("popstate")(event);
    } finally {
      if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow;
      if (savedDocument === undefined) delete globalThis.document; else globalThis.document = savedDocument;
    }
  }
  return { ...api, window, entries, visits, state, renders, pop };
}

test("Links local back/forward retains its page despite query ordering and detail changes", () => {
  const f = fixture();
  f.normalizeLocation();
  f.navigate({ itemId: "feed-a" });
  f.pop(0);
  assert.equal(f.visits.length, 0, "the installed Swup handler must not start content replacement");
  assert.equal(f.state.route.itemId, undefined);
  f.pop(1);
  assert.equal(f.visits.length, 0);
  assert.equal(f.state.route.itemId, "feed-a");
});

test("Links normalize, push and replace keep Swup URL current without dropping metadata", () => {
  const f = fixture();
  const initial = f.entries[0].state;
  f.normalizeLocation();
  assert.equal(f.window.history.state.url, historyPath(f.window.location));
  assert.equal(initial.url, "/links?view=friends&scope=all&preview-theme=sky", "do not mutate previous state objects");
  f.navigate({ itemId: "feed-a" });
  const pushed = f.window.history.state;
  assert.equal(pushed.url, historyPath(f.window.location));
  assert.equal(pushed.index, 3);
  assert.equal(pushed.custom, "preserved");
  f.navigate({ itemId: "feed-b" }, { replace: true });
  assert.equal(f.entries.length, 2);
  assert.equal(f.window.history.state.url, historyPath(f.window.location));
  assert.match(pushed.url, /itemId=feed-a/);
});

test("leaving Links and returning loads the full current child route through Swup", () => {
  const f = fixture();
  f.normalizeLocation();
  f.navigate({ itemId: "feed-a", scope: "favorite" });
  const target = historyPath(f.window.location);
  f.window.history.pushState({ source: "swup", url: "/archives", index: 4 }, "", "/archives");
  f.window.__swup.location = new Location("https://halo.test/archives", "https://halo.test");
  f.pop(1);
  assert.equal(f.visits.length, 1);
  assert.equal(f.visits[0].to.url, target);
  assert.equal(f.visits[0].history.popstate, true);
  assert.equal(f.state.route.itemId, "feed-a");
});

test("old Links listener does not normalize or render a destination owned by another plugin", () => {
  const f = fixture();
  f.normalizeLocation();
  f.window.history.pushState({ source: "swup", url: "/moments?view=other&itemId=other", index: 4 }, "", "/moments?view=other&itemId=other");
  f.pop(1);
  assert.equal(f.visits.length, 1);
  assert.equal(historyPath(f.window.location), "/moments?view=other&itemId=other");
  assert.equal(f.renders.length, 0);
});

test("only the seven owned keys and parameter order are equivalent on the same Links path", () => {
  const base = "https://halo.test/links?preview-theme=sky&other=1";
  for (const key of ["view", "scope", "groupName", "linkName", "itemId", "group", "link"]) {
    assert.equal(isSameLinksResource(base, `/links?${key}=x&other=1&preview-theme=sky`), true);
  }
  for (const target of ["/links?preview-theme=other&other=1", "/links?preview-theme=sky&other=2", "/links?preview-theme=sky&other=1&applied=true", "/links/?preview-theme=sky&other=1", "/links/child", "/moments", "https://other.test/links?preview-theme=sky&other=1"]) {
    assert.equal(isSameLinksResource(base, target), false, target);
  }
  assert.equal(isSameLinksResource("https://halo.test/moments?view=a", "/moments?view=b"), false);
  assert.equal(isSameLinksResource("invalid", "/links"), false);
});

test("a changed server query remains a Swup visit and is not normalized by the old Links instance", () => {
  const f = fixture();
  f.normalizeLocation();
  const target = "/links?preview-theme=other&view=friends&scope=all";
  f.window.history.pushState({ source: "swup", url: target, index: 4 }, "", target);
  f.pop(1);
  assert.equal(f.visits.length, 1);
  assert.equal(f.renders.length, 0);
});

test("no-swup links and regular navigation preserve their existing visit policy", () => {
  const f = fixture();
  const { ignoreVisit, resolveUrl } = f.window.__swup.options;
  assert.equal(ignoreVisit("/links?view=apply", { el: { closest: selector => selector === "[data-no-swup]" } }), true);
  assert.equal(ignoreVisit("/archives"), false);
  assert.equal(ignoreVisit("/links?view=apply"), false);
  assert.equal(resolveUrl, undefined, "do not merge normal link navigation or cache resources");
});

for (const historyState of [null, { source: "another-plugin", url: "/foreign", custom: 1 }]) {
  test(`PJAX disabled local history preserves ${historyState ? "foreign" : "null"} state`, () => {
    const f = fixture({ enabled: false, historyState });
    assert.equal(f.window.__swup, undefined);
    f.normalizeLocation();
    f.navigate({ itemId: "feed-a" });
    assert.equal(f.window.history.state, historyState);
    f.pop(0);
    assert.equal(f.state.route.itemId, undefined);
    f.pop(1);
    assert.equal(f.state.route.itemId, "feed-a");
    assert.equal(f.visits.length, 0);
  });
}
