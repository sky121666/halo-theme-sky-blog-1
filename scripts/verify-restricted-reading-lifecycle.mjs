#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const main = fs.readFileSync(new URL("../src/common/main.js", import.meta.url), "utf8");
const hookSource = main.match(
  /swup\.hooks\.before\(\s*"content:replace",\s*([\s\S]*?),\s*\{\s*priority:\s*-100\s*\},?\s*\);/,
)?.[1];
assert.ok(hookSource, "production content:replace cleanup hook must be available");

function modal(tag, { canClose = true } = {}) {
  const classes = new Set(["plugin-owned-class"]);
  const element = {
    tag,
    closed: 0,
    removed: false,
    style: { "--halo-restrict-widget-title-color": "#123456" },
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains: (name) => classes.has(name),
    },
    remove() {
      throw new Error("theme must use the plugin close contract");
    },
  };
  // Installed 1.9.3 dispatches close; its creator removes the host on that event.
  if (canClose)
    element.close = () => {
      element.closed += 1;
      element.removed = true;
    };
  return element;
}

function documentWith(elements, scheme = "light") {
  return {
    documentElement: { dataset: { colorScheme: scheme } },
    body: { classList: { contains: () => false, toggle() {} } },
    querySelectorAll(selector) {
      const tags = selector.split(",").map((tag) => tag.trim().replace(/^body\s*>\s*/, ""));
      return elements.filter((element) => !element.removed && tags.includes(element.tag));
    },
  };
}

function cleanupSetup({ supportsPjax = true, canClose = true } = {}) {
  const elements = [
    modal("content-restrict-answer-modal", { canClose }),
    modal("content-restrict-mp-modal", { canClose }),
    modal("content-restrict-pay-modal"),
    modal("content-restrict-widget"),
  ];
  const document = documentWith(elements);
  const context = vm.createContext({
    document,
    window: { location: { href: "https://example.test/next", reload() {} }, history: { back() {} } },
    SKY_PJAX_CONTAINERS: ["#swup", "#swup-scripts", "#swup-page-extras"],
    MANAGED_BODY_CLASSES: [],
    pageGeneration: 0,
    _currentSignaled: true,
    getVisitDebug: () => ({ id: 1, to: "/next" }),
    skyDebug: { event() {} },
    debugPath: () => "/next",
    swup: { options: {} },
  });
  const hook = vm.runInContext(`(${hookSource})`, context);
  const visit = {
    history: { popstate: true },
    to: {
      url: "/next",
      document: { body: document.body, querySelector: () => (supportsPjax ? {} : null) },
    },
    aborted: false,
    abort() {
      this.aborted = true;
    },
  };
  return { elements, visit, clean: () => hook(visit) };
}

test("history PJAX closes old answer and mp dialogs through the official close method", () => {
  const state = cleanupSetup();
  state.clean();
  assert.deepEqual(
    state.elements.slice(0, 2).map((element) => element.closed),
    [1, 1],
  );
  assert.ok(state.elements.slice(0, 2).every((element) => element.removed));
});

test("restricted cleanup leaves payment and content hosts untouched", () => {
  const state = cleanupSetup();
  state.clean();
  assert.ok(state.elements.slice(2).every((element) => element.closed === 0 && !element.removed));
});

test("an independent destination keeps current dialogs until full document navigation", () => {
  const state = cleanupSetup({ supportsPjax: false });
  state.clean();
  assert.equal(state.visit.aborted, true);
  assert.ok(state.elements.every((element) => element.closed === 0));
});

test("an unupgraded optional dialog cannot interrupt page cleanup", () => {
  assert.doesNotThrow(() => cleanupSetup({ canClose: false }).clean());
});

function themeSetup({ scheme = "light", initial = false } = {}) {
  const source = main.match(/function initializeRestrictedReadingModals\(\) \{[\s\S]*?\n\}/)?.[0];
  const elements = initial ? [modal("content-restrict-answer-modal")] : [];
  const document = documentWith(elements, scheme);
  let notify = () => {};
  const observed = [];
  class MutationObserver {
    constructor(callback) {
      notify = callback;
    }
    observe(target, options) {
      observed.push({ target, options });
    }
  }
  if (source) vm.runInNewContext(`${source}\ninitializeRestrictedReadingModals();`, { document, MutationObserver });
  return { document, elements, observed, notify: () => notify([]) };
}

test("new body dialogs reuse the plugin dark class without rewriting configured colors", () => {
  const state = themeSetup({ scheme: "dark" });
  const answer = modal("content-restrict-answer-modal");
  const mp = modal("content-restrict-mp-modal");
  const pay = modal("content-restrict-pay-modal");
  state.elements.push(answer, mp, pay);
  state.notify();
  for (const element of [answer, mp]) {
    assert.equal(element.classList.contains("color-scheme-dark"), true);
    assert.equal(element.classList.contains("plugin-owned-class"), true);
    assert.equal(element.style["--halo-restrict-widget-title-color"], "#123456");
  }
  assert.equal(pay.classList.contains("color-scheme-dark"), false);
  const bodyObservation = state.observed.find(({ target }) => target === state.document.body);
  assert.equal(bodyObservation?.options.childList, true);
  assert.equal(bodyObservation?.options.attributes, undefined, "modal class changes must not retrigger observation");
  assert.equal(bodyObservation?.options.subtree, undefined, "form internals must not be observed");
});

test("theme changes update existing dialogs and restore inherited plugin light colors", () => {
  const state = themeSetup({ scheme: "dark", initial: true });
  const [answer] = state.elements;
  assert.equal(answer.classList.contains("color-scheme-dark"), true);
  state.document.documentElement.dataset.colorScheme = "light";
  state.notify();
  assert.equal(answer.classList.contains("color-scheme-dark"), false);
  assert.equal(answer.classList.contains("plugin-owned-class"), true);
  assert.ok(
    state.observed.some(
      ({ target, options }) =>
        target === state.document.documentElement && options.attributeFilter?.includes("data-color-scheme"),
    ),
  );
});
