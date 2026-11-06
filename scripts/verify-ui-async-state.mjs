import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

function bangumiFixture() {
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  const image = { src: "original", style: {} };
  const cards = ["a", "b", "c"].map((src) =>
    Object.assign(new EventTarget(), {
      querySelector: () => ({ getAttribute: () => src }),
    }),
  );
  let cleanup;
  const window = {
    setTimeout(callback, delay) {
      const id = ++sequence;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const code = read("src/pages/bangumi/bangumi.js").replace(/^import .*;\n/gm, "");
  vm.runInNewContext(code, {
    window,
    AbortController,
    document: { getElementById: () => image, querySelectorAll: () => cards },
    registerPageLifecycle: (mount) => {
      cleanup = mount();
    },
    notifySwupPageReady() {},
  });
  return {
    image,
    hover(index) {
      cards[index].dispatchEvent(new Event("mouseenter"));
    },
    tick(ms) {
      const target = now + ms;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].callback();
      }
      now = target;
    },
    cleanup: () => cleanup(),
  };
}

test("bangumi returning to the current cover cancels a pending different cover", () => {
  const f = bangumiFixture();
  f.hover(0);
  f.tick(300);
  f.hover(1);
  f.tick(45);
  f.hover(0);
  f.tick(400);
  assert.equal(f.image.src, "a");
  assert.equal(f.image.style.opacity, "0.4");
});

test("bangumi settles on the final hovered cover", () => {
  const f = bangumiFixture();
  f.hover(0);
  f.tick(40);
  f.hover(1);
  f.tick(40);
  f.hover(2);
  f.tick(400);
  assert.equal(f.image.src, "c");
  assert.equal(f.image.style.opacity, "0.4");
});

test("bangumi unmount prevents delayed cover changes", () => {
  const f = bangumiFixture();
  f.hover(0);
  f.cleanup();
  f.tick(400);
  assert.equal(f.image.src, "original");
});

for (const failure of [null, "QuotaExceededError", "SecurityError"]) {
  test(`weather updates remain observable when storage ${failure || "works"}`, () => {
    const source = read("src/common/js/alpine-modules.js");
    const code = source.slice(source.indexOf("function weatherNumber("), source.indexOf("function onlineStats("));
    const events = [];
    const card = vm.runInNewContext(`${code};welcomeWeatherCard()`, {
      localStorage: {
        removeItem() {},
        setItem() {
          if (failure) throw new DOMException("unavailable", failure);
        },
      },
      window: { dispatchEvent: (event) => events.push(event) },
      CustomEvent,
      AbortController,
      Date,
    });
    const data = { weatherBg: "rainy", location: "Fixture", weather: { temp: 13, humidity: 85, wind: "20 km/h" } };
    card.applyWeatherData(data);
    card.setCache(data);
    assert.equal(card.weatherBg, "rainy");
    assert.equal(events.length, 1, "storage failure must not suppress the current view update");
    assert.equal(events[0].type, "sky-weather-updated");
    assert.equal(events[0].detail.rawData.temp, 13);
  });
}

function weatherFixture({ cached = null, idle = false } = {}) {
  const source = read("src/common/js/alpine-modules.js");
  const code = source.slice(source.indexOf("function weatherNumber("), source.indexOf("function onlineStats("));
  let sequence = 0;
  const timers = new Map(), events = [], writes = [], requests = [];
  const schedule = (fn) => { const id = ++sequence; timers.set(id, fn); return id; };
  const window = { dispatchEvent: event => events.push(event) };
  if (idle) window.requestIdleCallback = schedule;
  const card = vm.runInNewContext(`${code};welcomeWeatherCard()`, {
    window, Date, CustomEvent, AbortController, DOMException,
    requestIdleCallback: schedule, cancelIdleCallback: id => timers.delete(id),
    setTimeout: schedule, clearTimeout: id => timers.delete(id),
    skyDebug: { warn() {}, log() {} },
    localStorage: { removeItem() {}, getItem: () => cached && JSON.stringify({ ...cached, timestamp: Date.now() }), setItem: (_, value) => writes.push(JSON.parse(value)) },
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
  });
  card.$el = { dataset: { weatherProvider: "proxy", fallbackRegion: "Fixture" } };
  return { card, timers, events, writes, requests, tick() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); } };
}

for (const idle of [false, true]) test(`天气离页取消${idle ? "idle" : "timer"}启动任务`, () => {
  const f = weatherFixture({ idle }); f.card.init(); f.card.destroy?.(); f.tick();
  assert.equal(f.requests.length, 0);
});

test("天气离页取消缓存命中的延迟广播", async () => {
  const f = weatherFixture({ cached: { weatherBg: "rainy", weather: { temp: 12 } } });
  await f.card.loadWeather(); f.card.destroy?.(); f.tick();
  assert.equal(f.events.length, 0);
});

test("天气离页中止请求且忽略仍然完成的响应", async () => {
  const f = weatherFixture();
  const pending = f.card.getWeatherByWttrProxy({ city: "Fixture" });
  f.card.destroy?.();
  const aborted = f.requests[0].options.signal.aborted;
  f.requests[0].resolve({ ok: true, json: async () => ({ temp: 12, weather_code: 61 }) });
  await pending;
  assert.equal(aborted, true);
  assert.equal(f.events.length, 0); assert.equal(f.writes.length, 0); assert.equal(f.card.weather, null);
});

test("定位请求取消后不会降级发起天气请求", async () => {
  const f = weatherFixture(); const pending = f.card.loadWeather();
  f.card.destroy?.(); f.requests[0].reject(new DOMException("Aborted", "AbortError"));
  await new Promise(setImmediate);
  const count = f.requests.length;
  if (count > 1) f.requests[1].resolve({ ok: true, json: async () => ({ temp: 12, weather_code: 61 }) });
  await pending; assert.equal(count, 1); assert.equal(f.events.length, 0);
});

function doubanFilterFixture(query = "", { deferItems = false } = {}) {
  class FilterElement {
    constructor(filter, value = "") {
      this.dataset = filter ? { doubanFilter: filter, value } : {};
      this.children = [];
      this.attributes = new Map();
      this.className = "";
      this.disabled = false;
      this.classList = {
        toggle: (name, active) => {
          const classes = new Set(this.className.split(/\s+/).filter(Boolean));
          if (active) classes.add(name);
          else classes.delete(name);
          this.className = [...classes].join(" ");
        },
      };
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    appendChild(child) { this.children.push(child); return child; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    closest(selector) {
      if (selector === "[data-douban-filter]" && this.dataset.doubanFilter) return this;
      if (selector === "[data-douban-reset]" && this.reset) return this;
      if (selector === this.action) return this;
      return null;
    }
  }
  const panels = new Map();
  const panel = name => {
    if (!panels.has(name)) panels.set(name, Object.assign(new FilterElement(), { action: name }));
    return panels.get(name);
  };
  const statuses = ["done", "doing", "mark"].map(value => new FilterElement("status", value));
  panel("[data-douban-types]").children = [new FilterElement("type")];
  panel("[data-douban-genres]").children = [new FilterElement("genre")];
  const buttons = () => [...statuses, ...panel("[data-douban-types]").children, ...panel("[data-douban-genres]").children];
  const listeners = new Map(), requests = [];
  const window = {
    location: new URL(`https://halo.test/douban${query}`),
    history: {
      state: null,
      pushState(state, _, url) { this.state = state; window.location = new URL(url, window.location); },
      replaceState(state, _, url) { this.state = state; window.location = new URL(url, window.location); },
    },
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  const root = {
    dataset: { pageSize: "20" },
    querySelector: panel,
    querySelectorAll: () => buttons(),
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  const code = read("src/pages/douban/douban.js").replace(/^import .*;\n/gm, "");
  let cleanup;
  vm.runInNewContext(code, {
    window, URL, AbortController, Element: FilterElement,
    normalizeDoubanItem: item => item,
    document: { querySelector: () => root, createElement: () => new FilterElement() },
    skyDebug: { event() {}, warn() {} },
    fetch: async (input, options) => {
      const url = new URL(input, window.location);
      const isList = !url.pathname.endsWith("/-/types") && !url.pathname.endsWith("/-/genres");
      if (deferItems && isList) return new Promise((resolve, reject) => requests.push({
        url, signal: options.signal, reject,
        resolve: data => resolve({ ok: true, json: async () => data }),
      }));
      return {
        ok: true,
        json: async () => {
          if (url.pathname.endsWith("/-/types")) return [{ key: "movie", name: "电影", doubanCount: 1 }, { key: "book", name: "书籍", doubanCount: 1 }];
          if (url.pathname.endsWith("/-/genres")) return [{ name: "剧情", doubanCount: 1 }];
          return { items: [], page: 1, total: 0, totalPages: 1, hasPrevious: false, hasNext: false };
        },
      };
    },
    registerPageLifecycle: mount => { cleanup = mount(); },
    notifySwupPageReady() {},
  });
  return {
    requests, panel,
    cleanup: () => cleanup(),
    settle: () => new Promise(setImmediate),
    find: (filter, value) => buttons().find(button => button.dataset.doubanFilter === filter && button.dataset.value === value),
    selected: filter => buttons().filter(button => button.dataset.doubanFilter === filter && button.getAttribute("aria-pressed") === "true").map(button => button.dataset.value),
    click(filter, value) { listeners.get("click")({ target: this.find(filter, value) }); },
    clickAction(action) { listeners.get("click")({ target: panel(`[data-douban-${action}]`) }); },
    reset() { const target = new FilterElement(); target.reset = true; listeners.get("click")({ target }); },
    restore(query) { window.location = new URL(`/douban${query}`, window.location); listeners.get("popstate")(); },
  };
}

test("豆瓣初次加载和异步生成的筛选按钮都向辅助技术暴露选中状态", async () => {
  const f = doubanFilterFixture("?type=movie&genre=剧情&status=doing");
  try {
    assert.deepEqual(f.selected("status"), ["doing"]);
    assert.equal(f.find("status", "done").getAttribute("aria-pressed"), "false");
    await f.settle();
    assert.deepEqual(f.selected("type"), ["movie"]);
    assert.deepEqual(f.selected("genre"), ["剧情"]);
    assert.equal(f.find("type", "book").getAttribute("aria-pressed"), "false");
  } finally { f.cleanup(); }
});

test("豆瓣切换类型时同步辅助选中状态并清除旧题材", async () => {
  const f = doubanFilterFixture("?type=movie&genre=剧情");
  try {
    await f.settle();
    f.click("type", "book");
    assert.deepEqual(f.selected("type"), ["book"]);
    assert.equal(f.find("type", "movie").getAttribute("aria-pressed"), "false");
    await f.settle();
    assert.deepEqual(f.selected("genre"), [""]);
    f.click("status", "mark");
    assert.deepEqual(f.selected("status"), ["mark"]);
  } finally { f.cleanup(); }
});

test("豆瓣浏览历史恢复和重置筛选同步所有辅助选中状态", async () => {
  const f = doubanFilterFixture();
  try {
    await f.settle();
    f.restore("?type=book&genre=剧情&status=mark");
    await f.settle();
    assert.deepEqual(f.selected("type"), ["book"]);
    assert.deepEqual(f.selected("genre"), ["剧情"]);
    assert.deepEqual(f.selected("status"), ["mark"]);
    f.reset();
    await f.settle();
    assert.deepEqual(f.selected("type"), [""]);
    assert.deepEqual(f.selected("genre"), [""]);
    assert.deepEqual(f.selected("status"), ["done"]);
  } finally { f.cleanup(); }
});

function doubanPage(page, totalPages = 2) {
  return { items: [{ name: `Page ${page}` }], page, total: totalPages * 20,
    totalPages, hasPrevious: page > 1, hasNext: page < totalPages };
}

for (const [action, initial, destination] of [["next", 1, 2], ["prev", 2, 1]]) {
  test(`豆瓣 ${action} 连点只请求一次且终点禁止越界`, async () => {
    const f = doubanFilterFixture(`?page=${initial}`, { deferItems: true });
    try {
      f.requests[0].resolve(doubanPage(initial));
      await f.settle();
      assert.equal(f.panel(`[data-douban-${action}]`).disabled, false);
      f.clickAction(action);
      assert.equal(f.requests.length, 2);
      assert.equal(f.requests[1].url.searchParams.get("page"), String(destination));
      assert.equal(f.panel("[data-douban-prev]").disabled, true);
      assert.equal(f.panel("[data-douban-next]").disabled, true);
      f.clickAction(action);
      assert.equal(f.requests.length, 2, "pending pagination cannot move the requested page again");
      f.requests[1].resolve(doubanPage(destination));
      await f.settle();
      assert.equal(f.panel("[data-douban-page-info]").textContent, `${destination} / 2`);
      assert.equal(f.panel(`[data-douban-${action}]`).disabled, true);
      f.clickAction(action);
      assert.equal(f.requests.length, 2, "terminal pagination cannot request beyond the list boundary");
    } finally { f.cleanup(); }
  });
}

test("豆瓣翻页等待时仍能筛选，旧响应不会解除新请求的翻页锁", async () => {
  const f = doubanFilterFixture("", { deferItems: true });
  try {
    f.requests[0].resolve(doubanPage(1));
    await f.settle();
    f.clickAction("next");
    f.click("type", "book");
    assert.equal(f.requests[1].signal.aborted, true);
    assert.equal(f.requests[2].url.searchParams.get("type"), "book");
    assert.equal(f.requests[2].url.searchParams.get("page"), "1");
    f.requests[1].resolve(doubanPage(2));
    await f.settle();
    assert.equal(f.panel("[data-douban-next]").disabled, true);
    f.requests[2].resolve(doubanPage(1));
    await f.settle();
    assert.equal(f.panel("[data-douban-next]").disabled, false);
    assert.equal(f.panel("[data-douban-prev]").disabled, true);
    assert.equal(f.panel("[data-douban-page-info]").textContent, "1 / 2");
  } finally { f.cleanup(); }
});

test("豆瓣翻页失败可重试，重试成功恢复当前页边界", async () => {
  const f = doubanFilterFixture("", { deferItems: true });
  try {
    f.requests[0].resolve(doubanPage(1));
    await f.settle();
    f.clickAction("next");
    f.requests[1].reject(new Error("fixture network failure"));
    await f.settle();
    assert.equal(f.panel("[data-douban-error]").hidden, false);
    f.clickAction("retry");
    assert.equal(f.requests[2].url.searchParams.get("page"), "2");
    f.requests[2].resolve(doubanPage(2));
    await f.settle();
    assert.equal(f.panel("[data-douban-error]").hidden, true);
    assert.equal(f.panel("[data-douban-prev]").disabled, false);
    assert.equal(f.panel("[data-douban-next]").disabled, true);
  } finally { f.cleanup(); }
});
