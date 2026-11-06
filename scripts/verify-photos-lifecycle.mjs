#!/usr/bin/env node

import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/pages/photos/photos.js", import.meta.url), "utf8");
const lifecycleSource = source.match(/ {2}function bindImageLoad[\s\S]*?(?= {2}\/\/ =+\n {2}\/\/ 首屏)/)?.[0];
assert.ok(lifecycleSource, "production photo image lifecycle must be available");
const masonrySource = source.match(/ {2}function estimateHeight[\s\S]*?(?= {2}\/\/ 每张图仅通知)/)?.[0];
assert.ok(masonrySource, "production masonry height calculation must be available");
const firstScreenSource = source.match(/ {2}function checkFirstScreenDone[\s\S]*?(?=\n {2}initMasonry\(\);)/)?.[0];
assert.ok(firstScreenSource, "production first-screen reflow must be available");
const preloadSuccess = source.match(/preload\.onload = \(\) => \{([\s\S]*?)\n {18}\};/)?.[1];
assert.ok(preloadSuccess, "production preload success handler must be available");
const lightboxSource = source.match(
  / {2}function ensureLightGalleryImageContract[\s\S]*?(?= {2}function getLightGalleryInstance)/,
)?.[0];
assert.ok(lightboxSource, "production lightbox image registration must be available");
const lightboxSyncSource = source.match(/ {2}let lightGallerySyncPending[\s\S]*?(?= {2}let masonryCols)/)?.[0];
assert.ok(lightboxSyncSource, "production pagination lightbox update must be available");

function lightboxSyncFixture({ open = false, refresh = false, rebuildFails = false } = {}) {
  const photoGrid = new EventTarget();
  const cleanups = [];
  const calls = { destroy: 0, rebuild: 0, refresh: 0, init: 0 };
  let now = 0;
  let timerId = 0;
  const timers = new Map();
  const schedule = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, time: now + delay }); return id; };
  photoGrid.isConnected = true;
  let backdrop = false;
  const settings = { selector: "img", zoom: true, backdropDuration: 150 };
  const window = {
    setTimeout: schedule,
    clearTimeout: id => timers.delete(id),
    scrollX: 7,
    scrollY: 1540,
    scrollTo({ left, top, behavior }) {
      assert.equal(behavior, "instant");
      this.scrollX = left;
      this.scrollY = top;
    },
    lightGallery(grid, options) {
      calls.rebuild++;
      assert.equal(grid, photoGrid);
      assert.deepEqual({ ...options }, settings);
      if (rebuildFails) throw new Error("Gallery rebuild failed");
      instance = { ...instance, outer: null, lGalleryOn: false };
    },
    SkyLightGallery: { initNow: () => calls.init++ },
  };
  let instance = {
    s: settings,
    lGalleryOn: open,
    outer: open ? { isConnected: true } : null,
    destroy(full) {
      assert.equal(full, true);
      calls.destroy++;
      // lightgallery.js 1.4.0 restores prevScrollTop during destroy(), even
      // when the instance was never opened and that value is still undefined.
      window.scrollY = this.prevScrollTop || 0;
      schedule(() => { backdrop = false; }, this.s.backdropDuration + 50);
    },
  };
  if (refresh) instance.refresh = () => calls.refresh++;
  const context = vm.createContext({
    disposed: false,
    photoGrid,
    window,
    clearTimeout: id => timers.delete(id),
    allPhotoItems: [{}, {}],
    ensureLightGalleryImageContract() {},
    getLightGalleryInstance: () => instance,
    addCleanupTask: (fn) => cleanups.push(fn),
  });
  const sync = vm.runInContext(`${lightboxSyncSource}\nsyncLightGalleryItems`, context);
  return {
    sync,
    advance(ms = 200) {
      const until = now + ms;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].time - b[1].time || a[0] - b[0]).find(([, value]) => value.time <= until);
        if (!next) break;
        timers.delete(next[0]); now = next[1].time; next[1].fn();
      }
      now = until;
    },
    click() {
      const image = { isConnected: true, getAttribute: () => null, click() { backdrop = true; } };
      const event = new Event("click", { cancelable: true });
      Object.defineProperty(event, "target", { value: { closest: () => image } });
      photoGrid.dispatchEvent(event);
      return event.defaultPrevented;
    },
    hasBackdrop: () => backdrop,
    window,
    calls,
    settings,
    close() {
      instance.lGalleryOn = false;
      instance.outer = null;
      photoGrid.dispatchEvent(new Event("onCloseAfter"));
    },
    cleanup() {
      context.disposed = true;
      cleanups.splice(0).forEach((fn) => fn());
    },
  };
}

test("pagination rebuild of an unopened legacy lightbox preserves the current viewport", () => {
  const f = lightboxSyncFixture();
  f.sync();
  assert.equal(f.calls.destroy, 1);
  f.advance();
  assert.equal(f.calls.rebuild, 1);
  assert.equal(f.window.scrollX, 7);
  assert.equal(f.window.scrollY, 1540, "page 2 must not restore the lightbox's absent open-time position");
  f.window.scrollY = 2300;
  f.sync();
  assert.equal(f.window.scrollY, 2300, "later pages preserve the position at append time");
});

test("pagination waits until the active legacy lightbox closes before rebuilding its items", () => {
  const f = lightboxSyncFixture({ open: true });
  f.sync();
  f.sync();
  assert.equal(f.calls.destroy, 0, "appending must not close the user's open lightbox");
  assert.equal(f.window.scrollY, 1540);
  f.close();
  assert.equal(f.calls.destroy, 1, "several appends require one update after close");
  f.advance();
  assert.equal(f.calls.rebuild, 1);
  assert.equal(f.window.scrollY, 1540);
});

test("leaving the page cancels a deferred lightbox item update", () => {
  const f = lightboxSyncFixture({ open: true });
  f.sync();
  f.cleanup();
  f.close();
  assert.equal(f.calls.destroy, 0);
  assert.equal(f.calls.rebuild, 0);
});

test("a lightbox with a refresh API updates without teardown or scrolling", () => {
  const f = lightboxSyncFixture({ refresh: true });
  f.sync();
  assert.equal(f.calls.refresh, 1);
  assert.equal(f.calls.destroy, 0);
  assert.equal(f.window.scrollY, 1540);
});

test("a failed legacy lightbox rebuild still preserves the reading position", () => {
  const f = lightboxSyncFixture({ rebuildFails: true });
  f.sync();
  assert.throws(() => f.advance(), /Gallery rebuild failed/);
  assert.equal(f.window.scrollY, 1540);
});

test("legacy teardown finishes before a newly appended image opens its lightbox", () => {
  const f = lightboxSyncFixture();
  f.sync();
  assert.equal(f.calls.rebuild, 0, "do not expose a new instance to the old global backdrop cleanup");
  assert.equal(f.click(), true, "remember the user's click during teardown");
  f.advance(199);
  assert.equal(f.calls.rebuild, 0);
  f.advance(1);
  assert.equal(f.calls.rebuild, 1);
  assert.equal(f.hasBackdrop(), true, "the queued image opens after old cleanup has finished");
  f.advance(500);
  assert.equal(f.hasBackdrop(), true);
});

test("appends during legacy teardown coalesce and leaving cancels rebuild and queued clicks", () => {
  const f = lightboxSyncFixture();
  f.sync(); f.sync(); f.click();
  assert.equal(f.calls.destroy, 1);
  assert.equal(f.calls.init, 0, "do not reinitialize through the plugin while teardown is pending");
  f.cleanup(); f.advance(1000);
  assert.equal(f.calls.rebuild, 0);
  assert.equal(f.hasBackdrop(), false);
});

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
    toggle(name, force) {
      const active = force ?? !values.has(name);
      if (active) values.add(name);
      else values.delete(name);
      return active;
    },
  };
}

// The browser owns image transport. Keep that boundary controllable while
// running the production lifecycle and real EventTarget listener semantics.
function setup({ complete = false, width = 0, height = 0 } = {}) {
  const retry = new EventTarget();
  const error = { hidden: true };
  const card = {
    classList: classList(),
    querySelector: (selector) => (selector === ".photo-load-error" ? error : retry),
  };
  const originalUrl = "/upload/photo.jpg?size=large&signature=unchanged";
  const attributes = new Map([
    ["src", originalUrl],
    ["data-src", originalUrl],
  ]);
  const requests = [];
  const img = Object.assign(new EventTarget(), {
    complete,
    naturalWidth: width,
    naturalHeight: height,
    dataset: {},
    classList: classList(),
    tabIndex: 0,
    closest: () => card,
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: (name) => attributes.delete(name),
  });
  Object.defineProperty(img, "src", {
    get: () => attributes.get("src") ?? "",
    set(value) {
      attributes.set("src", value);
      requests.push(value);
      img.complete = false;
      img.naturalWidth = 0;
      img.naturalHeight = 0;
    },
  });

  const cleanups = [];
  const document = { activeElement: null };
  retry.focus = () => {
    document.activeElement = retry;
  };
  img.focus = () => {
    document.activeElement = img;
  };
  let heightUpdates = 0;
  const context = vm.createContext({
    disposed: false,
    document,
    addCleanupTask: (task) => cleanups.push(task),
    updateItemHeight: () => heightUpdates++,
  });
  const bind = vm.runInContext(`${lifecycleSource}\nbindImageLoad`, context);
  const registerLightbox = vm.runInContext(`${lightboxSource}\nensureLightGalleryImageContract`, context);
  let settledCount = 0;
  bind(img, () => settledCount++);
  return {
    img,
    card,
    error,
    retry,
    requests,
    document,
    originalUrl,
    registerLightbox: () => registerLightbox({ querySelector: () => img }),
    settledCount: () => settledCount,
    heightUpdates: () => heightUpdates,
    succeed() {
      img.complete = true;
      img.naturalWidth = 1200;
      img.naturalHeight = 800;
      img.dispatchEvent(new Event("load"));
    },
    fail() {
      img.complete = true;
      img.naturalWidth = 0;
      img.naturalHeight = 0;
      img.dispatchEvent(new Event("error"));
    },
    cleanup() {
      context.disposed = true;
      cleanups.splice(0).forEach((task) => task());
    },
  };
}

function assertFailure(state) {
  assert.equal(state.img.classList.contains("loaded"), false, "a failed image must not appear loaded");
  assert.equal(state.card.classList.contains("load-error"), true, "the card must retain its error layout");
  assert.equal(state.error.hidden, false, "a failed image must offer a visible recovery action");
  assert.equal(state.img.tabIndex, -1, "the failed lightbox image must not remain keyboard focusable");
}

test("a cached broken image shows a recoverable error instead of a loaded card", () => {
  const state = setup({ complete: true });
  assertFailure(state);
  assert.equal(state.settledCount(), 1);
  assert.deepEqual(state.requests, [], "failure must not start an automatic retry");
});

test("a cached successful image displays normally", () => {
  const state = setup({ complete: true, width: 1200, height: 800 });
  assert.equal(state.img.classList.contains("loaded"), true);
  assert.equal(state.card.classList.contains("loaded"), true);
  assert.equal(state.error.hidden, true);
  assert.equal(state.settledCount(), 1);
});

test("an asynchronous image error reveals recovery and settles only once", () => {
  const state = setup();
  state.fail();
  assertFailure(state);
  assert.equal(getEventListeners(state.img, "load").length, 0);
  assert.equal(getEventListeners(state.img, "error").length, 0);
  state.succeed();
  assertFailure(state);
  assert.equal(state.settledCount(), 1, "the opposite event must not settle the same request again");
});

test("a successful image ignores a later error event without recounting masonry completion", () => {
  const state = setup();
  state.succeed();
  state.fail();
  assert.equal(state.img.classList.contains("loaded"), true);
  assert.equal(state.error.hidden, true);
  assert.equal(state.settledCount(), 1);
});

test("manual retry reloads the exact source and a success clears the error", () => {
  const state = setup({ complete: true });
  const click = new Event("click", { cancelable: true, bubbles: true });
  state.retry.dispatchEvent(click);
  assert.equal(click.defaultPrevented, true, "retry must not fall through to image navigation");
  assert.deepEqual(state.requests, [state.originalUrl], "signed and relative source URLs must remain intact");
  assert.equal(state.error.hidden, true, "retry must restore the loading indicator");
  state.succeed();
  assert.equal(state.img.classList.contains("loaded"), true);
  assert.equal(state.card.classList.contains("loaded"), true);
  assert.equal(state.card.classList.contains("load-error"), false);
  assert.equal(state.error.hidden, true);
  assert.equal(state.img.tabIndex, 0);
  assert.equal(state.settledCount(), 1, "manual retry must not recount first-screen completion");
  assert.equal(state.heightUpdates(), 2, "both initial failure and retry success must update the column estimate");
});

test("keyboard retry keeps focus on the image and returns it to retry after another failure", () => {
  const state = setup({ complete: true });
  state.retry.focus();
  state.retry.dispatchEvent(new Event("click", { cancelable: true }));
  assert.equal(state.document.activeElement, state.img);
  state.fail();
  assert.equal(state.document.activeElement, state.retry);
  state.retry.dispatchEvent(new Event("click", { cancelable: true }));
  state.succeed();
  assert.equal(state.document.activeElement, state.img);
  assert.equal(state.settledCount(), 1);
});

test("late dimensions update the existing column without moving cards and guide later insertion", () => {
  const columns = [0, 1].map(() => ({
    children: [],
    appendChild(item) {
      this.children.push(item);
      item.parentElement = this;
    },
  }));
  const context = vm.createContext({
    masonryColNodes: columns,
    masonryCols: 2,
    colHeights: [0, 0],
    itemHeights: new Map(),
    photoGrid: { offsetWidth: 416 },
    GAP: 16,
  });
  const api = vm.runInContext(`${masonrySource}\n({ appendToShortest, updateItemHeight })`, context);
  const makeItem = (img) => {
    const attrs = new Map();
    img.getAttribute = name => attrs.get(name) ?? null;
    img.setAttribute = (name, value) => attrs.set(name, String(value));
    return { classList: classList(), querySelector: () => img };
  };
  const delayedImage = { naturalWidth: 0, naturalHeight: 0 };
  const delayed = makeItem(delayedImage);
  const other = makeItem({ naturalWidth: 200, naturalHeight: 300 });
  api.appendToShortest(delayed);
  api.appendToShortest(other);
  delayedImage.naturalWidth = 200;
  delayedImage.naturalHeight = 600;
  api.updateItemHeight(delayed);
  assert.equal(delayed.parentElement, columns[0]);
  assert.equal(other.parentElement, columns[1]);
  assert.deepEqual([...context.colHeights], [616, 316]);
  const next = makeItem({});
  api.appendToShortest(next);
  assert.equal(next.parentElement, columns[1]);
});

test("first-screen reflow waits for every image and restores focus and scroll after moving cards", () => {
  const focused = {
    focus(options) {
      assert.equal(options.preventScroll, true);
      document.activeElement = focused;
    },
  };
  const document = { activeElement: focused };
  const window = {
    scrollX: 5,
    scrollY: 480,
    scrollTo({ left, top, behavior }) {
      assert.equal(behavior, "instant");
      this.scrollX = left;
      this.scrollY = top;
    },
  };
  const items = [{}, {}];
  let resets = 0;
  const appended = [];
  const context = vm.createContext({
    disposed: false,
    loadedCount: 0,
    totalFirst: 2,
    document,
    window,
    allPhotoItems: items,
    photoGrid: { contains: (element) => element === focused },
    initMasonry() {
      resets++;
      document.activeElement = null;
      window.scrollY = 200;
    },
    appendToShortest(item) {
      appended.push(item);
    },
  });
  const check = vm.runInContext(`${firstScreenSource}\ncheckFirstScreenDone`, context);
  check();
  assert.equal(resets, 0);
  check();
  assert.equal(resets, 1);
  assert.deepEqual(appended, items);
  assert.equal(document.activeElement, focused);
  assert.equal(window.scrollX, 5);
  assert.equal(window.scrollY, 480);
  check();
  assert.equal(resets, 1, "later notifications must not repeat first-screen reflow");
});

test("preload finishing after its timeout updates a placed card but cannot overwrite a settled image", () => {
  const img = { dataset: {}, classList: classList() };
  const item = {};
  let updates = 0;
  const context = vm.createContext({
    img,
    item,
    disposed: false,
    preload: { naturalWidth: 400, naturalHeight: 800 },
    clearTimeout: () => {},
    t: 1,
    resolve: () => {},
    updateItemHeight: () => updates++,
  });
  vm.runInContext(preloadSuccess, context);
  assert.equal(img._nw, 400);
  assert.equal(img._nh, 800);
  assert.equal(updates, 1);
  img.dataset.settled = "1";
  delete img._nw;
  delete img._nh;
  vm.runInContext(preloadSuccess, context);
  assert.equal(img._nw, undefined);
  assert.equal(updates, 1);
});

test("refreshing lightbox items after pagination leaves failed images out of keyboard navigation", () => {
  const state = setup({ complete: true });
  state.registerLightbox();
  assertFailure(state);
});

test("leaving the page prevents pending image events and retry from updating the old card", () => {
  const pending = setup();
  pending.cleanup();
  assert.equal(getEventListeners(pending.img, "load").length, 0);
  assert.equal(getEventListeners(pending.img, "error").length, 0);
  assert.equal(getEventListeners(pending.retry, "click").length, 0);
  pending.succeed();
  assert.equal(pending.img.classList.contains("loaded"), false);
  assert.equal(pending.settledCount(), 0);

  const failed = setup({ complete: true });
  failed.cleanup();
  failed.retry.dispatchEvent(new Event("click", { cancelable: true }));
  failed.succeed();
  assertFailure(failed);
  assert.deepEqual(failed.requests, []);
  assert.equal(failed.settledCount(), 1);
});

// Observe/fetch/layout are browser boundaries. Execute the production pagination
// coordinator with a sentinel that stays visible, as on the real size=1 route.
function paginationFixture(pages) {
  const start = source.indexOf("  let nextUrlEl =");
  const end = source.indexOf("\n}", start);
  const nodes = new Map();
  const sentinel = { getBoundingClientRect: () => ({ top: 400, bottom: 450 }) };
  const link = { href: "https://halo.test/photos?page=2&size=1", parentElement: sentinel, remove() {} };
  nodes.set("next-page-url", link);
  for (const id of ["loading-spinner", "no-more-data", "photos-load-error", "photos-load-retry"]) {
    nodes.set(id, Object.assign(new EventTarget(), { classList: classList() }));
  }
  nodes.get("loading-spinner").classList.add("hidden");
  nodes.get("photos-load-error").classList.add("hidden");
  const requests = [];
  const appended = [];
  let callback;
  const context = vm.createContext({
    disposed: false,
    requestController: new AbortController(),
    resizeTimer: null,
    cleanupTasks: [],
    photoGrid: { removeEventListener() {} },
    handleGridClick() {},
    handleGridKeydown() {},
    handleResize() {},
    document: { getElementById: (id) => nodes.get(id), addEventListener() {} },
    window: {
      location: new URL("https://halo.test/photos?size=1"),
      innerHeight: 900,
      removeEventListener() {},
      requestAnimationFrame: (fn) => setTimeout(fn, 0),
      cancelAnimationFrame: clearTimeout,
    },
    URL,
    setTimeout,
    clearTimeout,
    fetch: async (url) => {
      requests.push(url);
      const value = pages[requests.length - 1];
      if (value instanceof Error) throw value;
      return { ok: true, text: async () => value };
    },
    DOMParser: class {
      parseFromString(page) {
        return {
          querySelectorAll: () => (page?.empty ? [] : [{ style: {}, querySelector: () => null }]),
          querySelector: () => (page?.next ? { href: page.next } : null),
        };
      }
    },
    allPhotoItems: [],
    appendToShortest: (item) => appended.push(item),
    bindImageLoad() {},
    syncLightGalleryItems() {},
    skyDebug: { error() {} },
    IntersectionObserver: class {
      constructor(fn) {
        callback = fn;
      }
      observe() {}
      disconnect() {}
    },
  });
  vm.runInContext(`(function () { ${source.slice(start, end)} })()`, context);
  return {
    requests,
    appended,
    nodes,
    sentinel,
    enter: () => callback([{ isIntersecting: true }]),
    cleanup: () => context.window.__skyPhotosCleanup(),
    settle: () => new Promise((resolve) => setTimeout(resolve, 40)),
  };
}

test("a visible photo sentinel continues through small pages until exhaustion", async () => {
  const f = paginationFixture([{ next: "https://halo.test/photos?page=3&size=1" }, {}]);
  f.enter();
  await f.settle();
  assert.equal(f.requests.length, 2);
  assert.equal(f.appended.length, 2);
  assert.equal(f.nodes.get("no-more-data").classList.contains("flex"), true);
});

test("photo loading pauses once the sentinel leaves the expanded viewport", async () => {
  const f = paginationFixture([{ next: "https://halo.test/photos?page=3&size=1" }, {}]);
  f.sentinel.getBoundingClientRect = () => ({ top: 1500, bottom: 1550 });
  f.enter();
  await f.settle();
  assert.equal(f.requests.length, 1);
});

test("a failed photo page waits for explicit retry and keeps the same next URL", async () => {
  const f = paginationFixture([new Error("network"), {}]);
  f.enter();
  await f.settle();
  assert.equal(f.requests.length, 1);
  assert.equal(f.nodes.get("photos-load-error").classList.contains("hidden"), false);
  f.nodes.get("photos-load-retry").dispatchEvent(new Event("click"));
  await f.settle();
  assert.deepEqual(f.requests, ["https://halo.test/photos?page=2&size=1", "https://halo.test/photos?page=2&size=1"]);
});

test("a repeated next-page URL stops instead of duplicating photos or looping", async () => {
  const f = paginationFixture([{ next: "https://halo.test/photos?page=2&size=1" }]);
  f.enter();
  await f.settle();
  assert.equal(f.requests.length, 1);
  assert.equal(f.nodes.get("photos-load-error").classList.contains("hidden"), false);
});

test("leaving photos cancels a queued visible-sentinel continuation", async () => {
  const f = paginationFixture([{ next: "https://halo.test/photos?page=3&size=1" }]);
  f.enter();
  await Promise.resolve();
  f.cleanup();
  await f.settle();
  assert.equal(f.requests.length, 1);
  assert.equal(f.appended.length, 0);
});


function sizedCard({ width, height, attrs = {} } = {}) {
  const attributes = new Map(Object.entries(attrs));
  const img = {
    _nw: width, _nh: height, naturalWidth: 0, naturalHeight: 0,
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
  };
  const item = { classList: classList(), querySelector: () => img };
  const inserted = [];
  const columns = [{ appendChild(node) {
    inserted.push({ width: img.getAttribute('width'), height: img.getAttribute('height') });
    node.parentElement = this;
  } }];
  const context = vm.createContext({ masonryColNodes: columns, masonryCols: 1,
    colHeights: [0], itemHeights: new Map(), photoGrid: { offsetWidth: 200 }, GAP: 16 });
  const api = vm.runInContext(`${masonrySource}\n({ appendToShortest, updateItemHeight })`, context);
  return { item, img, api, context, inserted };
}

test('a preloaded lazy photo reserves its real dimensions before entering the masonry DOM', () => {
  const f = sizedCard({ width: 400, height: 800 });
  f.api.appendToShortest(f.item);
  assert.deepEqual(f.inserted, [{ width: '400', height: '800' }], 'the browser must know the ratio before insertion');
  assert.deepEqual([...f.context.colHeights], [416]);
});

test('documented server dimensions reserve a lazy photo before it has natural dimensions', () => {
  const f = sizedCard({ attrs: { width: '600', height: '300' } });
  f.api.appendToShortest(f.item);
  assert.deepEqual([...f.context.colHeights], [116], 'use the 2:1 ratio rather than an arbitrary 200px estimate');
});

test('late preload dimensions replace the temporary skeleton size on its existing card', () => {
  const f = sizedCard(); f.api.appendToShortest(f.item);
  f.img._nw = 600; f.img._nh = 900; f.api.updateItemHeight(f.item);
  assert.equal(f.img.getAttribute('width'), '600'); assert.equal(f.img.getAttribute('height'), '900');
  assert.deepEqual([...f.context.colHeights], [316]);
});

for (const dimensions of [[0, 100], [100, 0], [-1, 100], [Infinity, 100]]) {
  test(`invalid photo dimensions keep the existing recovery skeleton: ${dimensions.join('x')}`, () => {
    const f = sizedCard({ width: dimensions[0], height: dimensions[1] });f.api.appendToShortest(f.item);
      assert.equal(f.img.getAttribute('width'), null);assert.equal(f.img.getAttribute('height'), null);
    assert.deepEqual([...f.context.colHeights], [216]);
  });
}
