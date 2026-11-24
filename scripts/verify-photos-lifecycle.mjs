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
const lightboxSource = source.match(
  / {2}function ensureLightGalleryImageContract[\s\S]*?(?= {2}function syncLightGalleryItems)/,
)?.[0];
assert.ok(lightboxSource, "production lightbox image registration must be available");

test("gallery opens appended photos in the current lightbox and releases it on abort", () => {
  const gallerySource = fs.readFileSync(new URL("../src/common/js/gallery.js", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "").replace(/^export /gm, "");
  const image = (href) => ({
    matches: (selector) => selector === "img",
    getAttribute: (name) => name === "src" ? href : null,
    closest(selector) { return selector === "img" ? this : null; },
    isConnected: true,
    focus() { this.focused = true; },
    tabIndex: 0,
  });
  const first = image("/first.jpg");
  const second = image("/second.jpg");
  const nodes = [first];
  const root = Object.assign(new EventTarget(), {
    contains: (node) => nodes.includes(node),
    querySelectorAll: () => nodes,
    getAttribute: () => null,
  });
  const controller = new AbortController();
  const actions = [];
  let events = {};
  const mount = vm.runInNewContext(gallerySource + "\nmountGalleries", {
    document: {
      querySelectorAll: () => [],
      getElementById: (id) => id === "glightbox-body" ? {} : null,
      activeElement: { closest: () => null },
    },
    window: {}, matchMedia: () => ({ matches: false }),
    GLightbox() {
      actions.push("mount");
      return {
        on(name, callback) { events[name] = callback; },
        setElements(slides) { actions.push(...slides.map((slide) => slide.href)); },
        openAt(index) { actions.push(index); },
        insertSlide(slide) { actions.push(slide.href); },
        destroy() { actions.push("destroy"); },
      };
    },
  });
  mount({ querySelectorAll: () => [root] }, [{ root: "#photo-grid", selector: "img" }],
    controller.signal, false);
  const click = new Event("click", { cancelable: true });
  Object.defineProperties(click, { target: { value: first }, button: { value: 0 } });
  root.dispatchEvent(click);
  assert.equal(click.defaultPrevented, true);
  nodes.push(second);
  root.dispatchEvent(new Event("sky:gallery-items"));
  root.dispatchEvent(new Event("sky:gallery-items"));
  events.close();
  actions.push("open");
  assert.equal(first.focused, true, "closing a lightbox returns focus to the triggering image");
  controller.abort();
  root.dispatchEvent(new Event("sky:gallery-items"));
  assert.deepEqual(actions, ["mount", "/first.jpg", 0, "/second.jpg", "open", "destroy"]);
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
  const boundImages = [];
  let preloads = 0;
  let callback;
  const context = vm.createContext({
    disposed: false,
    requestController: new AbortController(),
    resizeTimer: null,
    cleanupTasks: [],
    photoGrid: { removeEventListener() {} },
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
    Image: class {
      constructor() { preloads++; }
    },
    fetch: async (url) => {
      requests.push(url);
      const value = pages[requests.length - 1];
      if (value instanceof Error) throw value;
      return { ok: true, text: async () => value };
    },
    DOMParser: class {
      parseFromString(page) {
        return {
          querySelectorAll: () => (page?.empty ? [] : [{ style: {}, dataset: {}, querySelector: () => page?.image ?? null }]),
          querySelector: () => (page?.next ? { href: page.next } : null),
        };
      }
    },
    allPhotoItems: [],
    appendToShortest: (item) => appended.push(item),
    bindImageLoad(image) { boundImages.push(image); },
    ensureLightGalleryImageContract(item) { return item.querySelector("img"); },
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
  const cleanup = vm.runInContext(`(function () { ${source.slice(start, end)} })()`, context);
  return {
    requests,
    appended,
    boundImages,
    preloadCount: () => preloads,
    nodes,
    sentinel,
    enter: () => callback([{ isIntersecting: true }]),
    cleanup,
    settle: () => new Promise((resolve) => setTimeout(resolve, 40)),
  };
}

test("a paginated card is placed and registered before the browser image finishes", async () => {
  const image = { complete: false, src: "/photos/pending.jpg" };
  const f = paginationFixture([{ image }]);
  f.enter();
  await f.settle();
  assert.equal(f.appended.length, 1);
  assert.equal(f.appended[0].dataset.photoAppended, "");
  assert.deepEqual(f.boundImages, [image]);
  assert.equal(f.preloadCount(), 0);
  f.cleanup();
});

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
