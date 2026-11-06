import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import "./verify-ui-async-state.mjs";
import "./verify-toc-navigation.mjs";

const root = new URL("../", import.meta.url);
// The shared diagnostic sink reads window.SkyDebug; rendering dependencies below
// are isolated per fixture and do not share this no-op browser logging surface.
globalThis.window = {};
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");
const optionalModule = async (name) => (fs.existsSync(new URL(name, root)) ? import(new URL(name, root)) : {});
const { decorateExternalLinks } = await optionalModule("src/common/js/external-links.js");
const { renderDocsMath } = await optionalModule("src/pages/doc/math.js");

function element(attributes = {}, text = "") {
  const attrs = { ...attributes };
  return {
    textContent: text,
    innerText: text,
    isConnected: true,
    rendered: false,
    getAttribute: (name) => attrs[name] ?? null,
    setAttribute: (name, value) => {
      attrs[name] = String(value);
    },
    hasAttribute: (name) => name in attrs,
    get href() {
      return attrs.href;
    },
    get hostname() {
      return new URL(attrs.href).hostname;
    },
    get origin() {
      return new URL(attrs.href).origin;
    },
    get src() {
      return attrs.src;
    },
    get relList() {
      return {
        add: (...values) => {
          attrs.rel = [...new Set([...(attrs.rel || "").split(/\s+/).filter(Boolean), ...values])].join(" ");
        },
      };
    },
    querySelector() {
      return this.rendered ? {} : null;
    },
    remove() {
      this.removed = true;
    },
  };
}

function contentFixture() {
  const media = element({
    src: "http://192.168.1.20:8080/chart.png",
    poster: "http://media.example:9000/poster.png",
    srcset: "http://media.example:9000/a.png 1x, http://media.example:9000/b.png 2x",
  });
  const style = element({}, ".layout{display:grid}.glass{backdrop-filter:blur(8px)}");
  const link = element({ href: "https://elsewhere.example/page", rel: "nofollow ugc sponsored" });
  const content = {
    isConnected: true,
    querySelectorAll(selector) {
      if (selector === "style") return [style];
      if (selector.includes("img[src]") || selector === "[poster]" || selector === "[srcset]") return [media];
      if (selector.startsWith("a[")) return [link];
      return [];
    },
  };
  const document = {
    getElementById: () => content,
    querySelectorAll: () => [],
    documentElement: { getAttribute: () => "light" },
  };
  const window = {
    location: new URL("https://blog.example/article"),
    SkyPjax: { onPage() {}, onCleanup() {} },
  };
  const context = {
    document,
    window,
    URL,
    queueMicrotask,
    decorateExternalLinks,
    skyDebug: { warn() {} },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  };
  vm.runInNewContext(read("src/static/js/article-content.js").replace(/^import .*;\r?\n/gm, ""), context);
  window.initArticleContent();
  return { media, style, link };
}

test("正文初始化保留媒体 origin、端口、poster 和 srcset", () => {
  const { media } = contentFixture();
  assert.equal(media.src, "http://192.168.1.20:8080/chart.png");
  assert.equal(media.getAttribute("poster"), "http://media.example:9000/poster.png");
  assert.equal(media.getAttribute("srcset"), "http://media.example:9000/a.png 1x, http://media.example:9000/b.png 2x");
});

test("正文初始化不删除包含合法 blur 的样式块", () => {
  assert.notEqual(contentFixture().style.removed, true);
});

test("正文初始化增补外链保护且保留作者 rel", () => {
  const { link } = contentFixture();
  assert.deepEqual(
    new Set(link.getAttribute("rel").split(/\s+/)),
    new Set(["nofollow", "ugc", "sponsored", "noopener", "noreferrer"]),
  );
});

test("全局外链区分相似主机名与端口，重复初始化不丢 rel", () => {
  const links = [
    element({ href: "https://blog.example/inside", rel: "author" }),
    element({ href: "https://blog.example.other.invalid/out", rel: "nofollow" }),
    element({ href: "https://blog.example:9443/out", rel: "ugc" }),
  ];
  const document = { querySelectorAll: () => links, addEventListener() {} };
  const window = { location: new URL("https://blog.example/"), addEventListener() {} };
  vm.runInNewContext(read("src/common/js/base.js").replace(/^import .*;\r?\n/gm, ""), {
    document,
    window,
    URL,
    decorateExternalLinks,
  });
  window.SkyEvents.initExternalLinks();
  window.SkyEvents.initExternalLinks();
  assert.equal(links[0].getAttribute("target"), null);
  assert.equal(links[0].getAttribute("rel"), "author");
  for (const link of links.slice(1)) assert.equal(link.getAttribute("target"), "_blank");
  assert.ok(links[1].getAttribute("rel").includes("nofollow"));
  assert.ok(links[2].getAttribute("rel").includes("ugc"));
});

function themeFixture(mode) {
  const script = read("templates/modules/theme-script.html").match(
    /<script[^>]*th:fragment="inline-script"[^>]*>([\s\S]*?)<\/script>/,
  )[1];
  const attributes = {};
  const media = Object.assign(new EventTarget(), { matches: false });
  const html = {
    setAttribute: (name, value) => {
      attributes[name] = value;
    },
    classList: { add() {}, remove() {} },
  };
  const document = { documentElement: html, dispatchEvent() {} };
  const window = { matchMedia: () => media, location: new URL("https://blog.example/") };
  let stored = mode === "normal" ? "auto" : "light_theme";
  const storage = {
    getItem: () => {
      if (mode === "read-failure") throw new Error("storage blocked");
      return stored;
    },
    setItem: (_name, value) => {
      if (mode === "write-failure") throw new Error("quota");
      stored = value;
    },
  };
  const context = {
    window,
    document,
    URL,
    console,
    localStorage: storage,
    requestAnimationFrame: (fn) => fn(),
    CustomEvent: class {},
    Element: class {},
  };
  vm.runInNewContext(script, context);
  const toggleSource = read("src/common/js/alpine-modules.js");
  const start = toggleSource.indexOf("function createThemeToggle()");
  const end = toggleSource.indexOf("\nfunction ", start + 1);
  vm.runInNewContext(toggleSource.slice(start, end) + "\nwindow.__toggle = createThemeToggle();", context);
  const toggle = window.__toggle;
  toggle.$el = { dataset: { lightTheme: "light", darkTheme: "dark", defaultTheme: "dark_theme" } };
  toggle.init();
  return { window, attributes, toggle, media };
}

for (const mode of ["normal", "read-failure", "write-failure"]) {
  test(`主题偏好 ${mode} 时生命周期和颜色切换仍可用`, () => {
    const { window, attributes, toggle } = themeFixture(mode);
    assert.equal(typeof window.SkyPjax.onPage, "function");
    const before = attributes["data-color-scheme"];
    toggle.toggleTheme();
    if (mode !== "normal") assert.notEqual(attributes["data-color-scheme"], before);
    assert.ok(["light", "dark"].includes(attributes["data-color-scheme"]));
  });
}

test("存储写入失败后 auto 模式仍随系统切换，不读取过期持久值", () => {
  const { toggle, media, attributes } = themeFixture("write-failure");
  toggle.toggleTheme(); // light -> dark
  toggle.toggleTheme(); // dark -> auto
  media.matches = true;
  media.dispatchEvent(Object.assign(new Event("change"), { matches: true }));
  assert.equal(attributes["data-color-scheme"], "dark");
});

async function docFixture({
  available = true,
  signal = new AbortController().signal,
  nodes,
  detail = { initial: false, pjax: true },
} = {}) {
  nodes ||= [element({ "math-inline": "" }, "x^2"), element({ "math-display": "" }, "y^2")];
  const calls = [];
  const content = { isConnected: true, querySelectorAll: () => nodes, contains: (node) => nodes.includes(node) };
  const document = {
    baseURI: "https://blog.example/docs/a",
    getElementById: () => content,
    querySelectorAll: () =>
      available ? [{ src: "https://blog.example/plugins/plugin-katex/assets/static/katex.min.js" }] : [],
  };
  const window = {
    katex: {
      render(text, node, options) {
        calls.push({ text, displayMode: options.displayMode });
        node.rendered = true;
      },
    },
  };
  // Exercise the production lifecycle callback, including its initial/PJAX distinction.
  const source = read("src/pages/doc/doc.js");
  const entry = source.slice(source.indexOf("// 初始化\n"), source.indexOf("\nif (window.SkyPjax?.onPage)"));
  const initialized = [];
  let pending;
  const context = {
    detail,
    document,
    restoreHeadingFragment() {}, // TOC coordinates have their own behavior fixture.
    _pageAbort: null,
    AbortController,
    isDocPage: () => true,
    cleanupDocPage() {},
    initTOC() {
      initialized.push("toc");
    },
    initDropdowns() {
      initialized.push("dropdowns");
    },
    initSidebarFooterCollision() {
      initialized.push("sidebar");
    },
    initDrawers() {
      initialized.push("drawers");
    },
    getPageSignal: () => signal,
    renderDocsMath: () => {
      pending = renderDocsMath?.({ document, window, signal });
    },
  };
  vm.runInNewContext(entry + "\nhandlePageEnter(detail ?? undefined);", context);
  await pending;
  return { calls, nodes, initialized };
}

test("Docsme PJAX 页面入口补渲染官方旧行内和块公式", async () => {
  assert.deepEqual((await docFixture()).calls, [
    { text: "x^2", displayMode: false },
    { text: "y^2", displayMode: true },
  ]);
});

test("Docsme 首屏初始化保留原公式，交由官方 DOMContentLoaded 回调渲染", async () => {
  const first = await docFixture({ detail: { initial: true, pjax: false } });
  assert.deepEqual(first.calls, [], "theme must not render before the official cold-start callback");
  assert.deepEqual(
    first.nodes.map((node) => node.innerText),
    ["x^2", "y^2"],
  );
  assert.ok(first.nodes.every((node) => !node.rendered));
  assert.deepEqual(first.initialized, ["toc", "dropdowns", "sidebar", "drawers"]);
});

test("Docsme 无 PJAX 上下文时仍初始化导航，但不重复官方首屏公式", async () => {
  const first = await docFixture({ detail: null });
  assert.deepEqual(first.calls, []);
  assert.deepEqual(first.initialized, ["toc", "dropdowns", "sidebar", "drawers"]);
});

test("Docsme 重复进入不会重复渲染已处理节点", async () => {
  const first = await docFixture();
  assert.equal(first.calls.length, 2);
  assert.equal((await docFixture({ nodes: first.nodes })).calls.length, 0);
});

test("插件未提供脚本或页面已离开时不渲染", async () => {
  assert.equal((await docFixture({ available: false })).calls.length, 0);
  assert.equal((await docFixture({ signal: AbortSignal.abort() })).calls.length, 0);
});

function lazyMathFixture() {
  const node = element({ "math-inline": "" }, "x^2");
  const content = { isConnected: true, querySelectorAll: () => [node], contains: () => true };
  const scripts = [];
  const window = {};
  const document = {
    baseURI: "https://blog.example/docs/a",
    getElementById: () => content,
    querySelectorAll: () => [{ src: "https://blog.example/plugins/plugin-katex/assets/static/katex.min.js" }],
    createElement: () =>
      Object.assign(new EventTarget(), {
        remove() {
          this.removed = true;
        },
      }),
    head: { appendChild: (script) => scripts.push(script) },
  };
  let calls = 0;
  const ready = () => {
    window.katex = {
      render(_text, target) {
        calls++;
        target.rendered = true;
      },
    };
    scripts.at(-1).dispatchEvent(new Event("load"));
  };
  return { document, window, node, content, scripts, ready, calls: () => calls };
}

test("首次公式资源慢加载时合并请求，离页任务不修改旧正文", async () => {
  const f = lazyMathFixture();
  const controller = new AbortController();
  const old = renderDocsMath({ ...f, signal: controller.signal });
  const current = renderDocsMath(f);
  assert.equal(f.scripts.length, 1);
  controller.abort();
  f.ready();
  await Promise.all([old, current]);
  assert.equal(f.calls(), 1);
  assert.equal(f.scripts[0].removed, true);
});

test("公式资源失败保留原文，后续进入可重试", async () => {
  const f = lazyMathFixture();
  const first = renderDocsMath(f);
  f.scripts[0].dispatchEvent(new Event("error"));
  await first;
  assert.equal(f.calls(), 0);
  assert.equal(f.node.textContent, "x^2");
  const second = renderDocsMath(f);
  assert.equal(f.scripts.length, 2);
  f.ready();
  await second;
  assert.equal(f.calls(), 1);
});

test("公式资源返回时已移除的文档不会被重新渲染", async () => {
  const f = lazyMathFixture();
  const task = renderDocsMath(f);
  f.content.isConnected = false;
  f.ready();
  await task;
  assert.equal(f.calls(), 0);
});

test("单个非法公式不阻断其他公式", async () => {
  const f = lazyMathFixture();
  const valid = element({ "math-display": "" }, "y^2");
  f.content.querySelectorAll = () => [f.node, valid];
  f.window.katex = {
    render(_text, target) {
      if (target === f.node) throw new Error("invalid formula");
      target.rendered = true;
    },
  };
  await renderDocsMath(f);
  assert.equal(valid.rendered, true);
  assert.equal(f.node.textContent, "x^2");
});
