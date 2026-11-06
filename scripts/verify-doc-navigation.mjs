#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const modalSource = fs.readFileSync(new URL("../src/common/js/modal-focus.js", import.meta.url), "utf8").replace("export function", "function");
const source = fs.readFileSync(new URL("../src/pages/doc/doc.js", import.meta.url), "utf8");
const tocSource = source.slice(source.indexOf("function initTOC()"), source.indexOf("function initDropdowns()"));
const drawerSource = source.slice(source.indexOf("function initDrawers()"), source.indexOf("// 初始化\n"));
const dropdownSource = source.slice(source.indexOf("function initDropdowns()"), source.indexOf("function initSidebarFooterCollision()"));
const selectorsTemplate = fs.readFileSync(new URL("../templates/modules/doc/selectors.html", import.meta.url), "utf8");

// Exercise the production TOC and drawer functions without a Halo server.
// Browser rendering and the Thymeleaf selector fragment require page acceptance.
function element({ html = "", links = [] } = {}) {
  const classes = new Set();
  return {
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = value;
      if (!value) links = [];
    },
    hidden: false,
    setAttribute() {}, removeAttribute() {}, focus() {}, contains() { return false; },
    style: {},
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    querySelector(selector) {
      if (selector === ".toc-link") return links[0] || null;
      if (selector === ".toc-list") return links.length ? {} : null;
      throw new Error(`Unexpected element selector: ${selector}`);
    },
    querySelectorAll(selector) {
      if (selector.startsWith("a[href]")) return [];
      assert.equal(selector, ".toc-link");
      return links;
    },
  };
}

function setup({ hasContent = true, hasToc = false } = {}) {
  const links = hasToc ? [{}] : [];
  const nodes = {
    "toc-nav": element({ html: hasToc ? '<ol class="toc-list"><li>Introduction</li></ol>' : "", links }),
    "toc-card": element(),
    "doc-toc-overlay": element(),
    "doc-toc-drawer": element(),
    "doc-toc-drawer-nav": element(),
    "doc-sidebar-overlay": element(),
    "doc-sidebar-drawer": element(),
  };
  if (hasContent) {
    nodes["article-content"] = {
      querySelectorAll(selector) {
        assert.equal(selector, "h1, h2, h3, h4, h5, h6");
        return [];
      },
    };
  }
  const triggers = [element(), element()];
  const window = {};
  const document = Object.assign(new EventTarget(), {
    body: { style: { overflow: "" } },
    getElementById: (id) => nodes[id] || null,
    querySelectorAll(selector) {
      assert.equal(selector, ".doc-toc-drawer-trigger");
      return triggers;
    },
  });
  const api = vm.runInNewContext(`${modalSource}\n${tocSource}\n${drawerSource}\n({ initTOC, initDrawers });`, {
    window,
    document,
    on() {}, AbortController, getPageSignal: () => new AbortController().signal,
  });
  return { ...api, nodes, triggers, window, document };
}

function selectorNavigation({ kind = "version", currentHref, currentBase, targetHref, initializeTimes = 1 }) {
  const selectorTags = [...selectorsTemplate.matchAll(/<div\b[^>]*class="doc-version-selector"[^>]*>/g)];
  const tag = selectorTags[kind === "version" ? 0 : 1]?.[0];
  assert.ok(tag, "Both selector types must remain available in the production fragment");
  const expression = tag.match(/th:attr="data-doc-base=\$\{([^}]+)\}"/)?.[1];
  const base = expression
    ? vm.runInNewContext(expression, {
        currentVersion: { status: { permalink: currentBase } },
        currentLanguage: { link: currentBase },
      })
    : undefined;
  let href = targetHref;
  const link = {
    dataset: {},
    get href() {
      return new URL(href, currentHref).href;
    },
    set href(value) {
      href = value;
    },
    getAttribute(name) {
      assert.equal(name, "href");
      return href;
    },
  };
  const selector = {
    dataset: base == null ? {} : { docBase: base },
    querySelector() { return null; },
    querySelectorAll(query) {
      assert.equal(query, ".doc-version-item[href]");
      return [link];
    },
  };
  const document = {
    querySelectorAll(query) {
      assert.equal(query, ".doc-version-selector");
      return base == null ? [] : [selector];
    },
  };
  const initDropdowns = vm.runInNewContext(`${dropdownSource}\ninitDropdowns;`, {
    document,
    window: { location: new URL(currentHref) },
    URL,
    on() {},
  });
  for (let index = 0; index < initializeTimes; index += 1) initDropdowns();
  return link.href;
}

function selectorInteraction() {
  const handlers = new Map();
  const selectors = Array.from({ length: 4 }, () => {
    const classes = new Set();
    const attributes = new Map();
    const button = {
      focused: false,
      setAttribute(name, value) { attributes.set(name, value); },
      getAttribute(name) { return attributes.get(name); },
      focus() { this.focused = true; },
    };
    const dropdown = {
      id: "",
      classList: {
        contains: name => classes.has(name),
        remove: name => classes.delete(name),
        toggle(name, active) { if (active) classes.add(name); else classes.delete(name); },
      },
    };
    const selector = {
      dataset: {}, button, dropdown,
      querySelector(query) { return query === ".doc-version-btn" ? button : dropdown; },
      contains(node) { return [this, button, dropdown].includes(node); },
    };
    return selector;
  });
  const document = { querySelectorAll: () => selectors };
  const initDropdowns = vm.runInNewContext(`${dropdownSource}\ninitDropdowns;`, {
    document, URL, window: { location: new URL("https://halo.test/docs/project") },
    on(target, type, handler) {
      const events = handlers.get(target) || {};
      events[type] = handler;
      handlers.set(target, events);
    },
  });
  initDropdowns();
  return { selectors, document, fire: (target, type, event = {}) => handlers.get(target)?.[type]?.(event) };
}

test("document selectors expose distinct controlled panels and synchronize expansion on repeated activation", () => {
  const f = selectorInteraction();
  assert.equal(new Set(f.selectors.map(s => s.button.getAttribute("aria-controls"))).size, 4);
  const { button, dropdown } = f.selectors[0];
  assert.equal(button.getAttribute("aria-expanded"), "false");
  f.fire(button, "click");
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(dropdown.classList.contains("show"), true);
  f.fire(button, "click");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(dropdown.classList.contains("show"), false);
});

test("Escape closes the inner selector and restores its trigger before the surrounding drawer handles Escape", () => {
  const f = selectorInteraction();
  const selector = f.selectors[0];
  f.fire(selector.button, "click");
  let prevented = false;
  let stopped = false;
  f.fire(selector, "keydown", {
    key: "Escape", preventDefault() { prevented = true; }, stopPropagation() { stopped = true; },
  });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(selector.dropdown.classList.contains("show"), false);
  assert.equal(selector.button.getAttribute("aria-expanded"), "false");
  assert.equal(selector.button.focused, true);
  prevented = false;
  f.fire(selector, "keydown", { key: "Escape", preventDefault() { prevented = true; } });
  assert.equal(prevented, false, "a second Escape remains available to the enclosing drawer");
});

test("opening another selector and clicking outside close earlier panels with matching accessible state", () => {
  const f = selectorInteraction();
  f.fire(f.selectors[0].button, "click");
  f.fire(f.selectors[1].button, "click");
  assert.equal(f.selectors[0].button.getAttribute("aria-expanded"), "false");
  assert.equal(f.selectors[0].dropdown.classList.contains("show"), false);
  f.fire(f.document, "click", { target: {} });
  assert.ok(f.selectors.every(s => s.button.getAttribute("aria-expanded") === "false"));
  assert.ok(f.selectors.every(s => !s.dropdown.classList.contains("show")));
});

for (const sample of [
  {
    name: "version switching keeps the document suffix and Halo preview link parameters",
    currentHref: "https://halo.test/docs/project/v2/guide/install?preview-theme=theme-sky-blog-1&page=2",
    currentBase: "/docs/project/v2",
    targetHref: "/docs/project/v1?preview-theme=theme-sky-blog-1&source=docs#intro",
    expected: "https://halo.test/docs/project/v1/guide/install?preview-theme=theme-sky-blog-1&source=docs#intro",
  },
  {
    name: "language switching preserves encoded document segments without decoding slashes",
    kind: "language",
    currentHref: "https://halo.test/docs/project/zh/%E5%AE%89%E8%A3%85/a%2Fb",
    currentBase: "/docs/project/zh",
    targetHref: "/docs/project/en",
    expected: "https://halo.test/docs/project/en/%E5%AE%89%E8%A3%85/a%2Fb",
  },
  {
    name: "selector roots and documents may have trailing slashes",
    currentHref: "https://halo.test/docs/project/v2/guide/install/",
    currentBase: "/docs/project/v2/",
    targetHref: "/docs/project/v1/",
    expected: "https://halo.test/docs/project/v1/guide/install/",
  },
  {
    name: "an exact root keeps the supplied target root and its trailing slash",
    currentHref: "https://halo.test/docs/project/v2",
    currentBase: "/docs/project/v2/",
    targetHref: "/docs/project/v1/",
    expected: "https://halo.test/docs/project/v1/",
  },
  {
    name: "a partial path segment does not count as the current version prefix",
    currentHref: "https://halo.test/docs/project/v20/guide",
    currentBase: "/docs/project/v2",
    targetHref: "/docs/project/v1?preview-theme=theme-sky-blog-1",
    expected: "https://halo.test/docs/project/v1?preview-theme=theme-sky-blog-1",
  },
  {
    name: "an encoded slash does not create a version path boundary",
    currentHref: "https://halo.test/docs/project/v2%2Fguide",
    currentBase: "/docs/project/v2",
    targetHref: "/docs/project/v1",
    expected: "https://halo.test/docs/project/v1",
  },
  {
    name: "a prefix found only inside an unrelated path leaves the plugin link unchanged",
    currentHref: "https://halo.test/archive/docs/project/v2/guide",
    currentBase: "/docs/project/v2",
    targetHref: "/docs/project/v1",
    expected: "https://halo.test/docs/project/v1",
  },
  {
    name: "missing current language metadata keeps the plugin-provided link",
    kind: "language",
    currentHref: "https://halo.test/docs/project/zh/guide",
    currentBase: null,
    targetHref: "/docs/project/en",
    expected: "https://halo.test/docs/project/en",
  },
  {
    name: "reinitializing the same selectors does not append the document suffix twice",
    currentHref: "https://halo.test/docs/project/v2/guide/install",
    currentBase: "/docs/project/v2",
    targetHref: "/docs/project/v1",
    initializeTimes: 2,
    expected: "https://halo.test/docs/project/v1/guide/install",
  },
]) {
  test(sample.name, () => {
    assert.equal(selectorNavigation(sample), sample.expected);
  });
}

test("a document without headings hides both TOC entries and its desktop card", () => {
  const state = setup();
  state.initTOC();
  assert.ok(
    state.triggers.every((trigger) => trigger.hidden),
    "bottom and side dock must hide empty TOC entries",
  );
  assert.equal(state.nodes["toc-card"].style.display, "none");
});

test("opening an empty TOC does not show an overlay or lock document scrolling", () => {
  const state = setup();
  state.initDrawers();
  state.window.openDocTocDrawer();
  assert.equal(state.nodes["doc-toc-drawer"].classList.contains("open"), false);
  assert.equal(state.nodes["doc-toc-overlay"].classList.contains("open"), false);
  assert.equal(state.document.body.style.overflow, "");
});

test("reinitializing a document without headings clears an earlier TOC before opening", () => {
  const state = setup({ hasToc: true });
  state.nodes["doc-toc-drawer-nav"].innerHTML = "Earlier document";
  state.initTOC();
  state.initDrawers();
  state.window.openDocTocDrawer();
  assert.equal(state.nodes["toc-nav"].innerHTML, "");
  assert.equal(state.nodes["doc-toc-drawer-nav"].innerHTML, "");
  assert.equal(state.nodes["doc-toc-drawer"].classList.contains("open"), false);
  assert.equal(state.document.body.style.overflow, "");
});

test("a nonempty TOC still opens with its content and releases scrolling when closed", () => {
  const state = setup({ hasToc: true });
  state.initDrawers();
  state.window.openDocTocDrawer();
  assert.equal(state.nodes["doc-toc-drawer"].classList.contains("open"), true);
  assert.equal(state.nodes["doc-toc-drawer-nav"].innerHTML, '<ol class="toc-list"><li>Introduction</li></ol>');
  assert.equal(state.document.body.style.overflow, "hidden");
  state.window.closeDocTocDrawer();
  assert.equal(state.nodes["doc-toc-overlay"].classList.contains("open"), false);
  assert.equal(state.document.body.style.overflow, "");
});

test("a catalog without article content retains its document-tree drawer", () => {
  const state = setup({ hasContent: false });
  state.initTOC();
  state.initDrawers();
  state.window.openDocSidebarDrawer();
  assert.equal(state.nodes["doc-sidebar-drawer"].classList.contains("open"), true);
  assert.equal(state.document.body.style.overflow, "hidden");
  state.window.closeDocSidebarDrawer();
  assert.equal(state.nodes["doc-sidebar-drawer"].classList.contains("open"), false);
  assert.equal(state.document.body.style.overflow, "");
});
