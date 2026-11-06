#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

// Execute the production pre-replacement hook. DOM/network setup is intentionally
// limited to the boundary this hook owns; no Halo account or form submission.
const main = fs.readFileSync(new URL("../src/common/main.js", import.meta.url), "utf8");
const hookSource = main.match(
  /swup\.hooks\.before\(\s*"content:replace",\s*([\s\S]*?),\s*\{\s*priority:\s*-100\s*\},?\s*\);/,
)?.[1];
assert.ok(hookSource, "production content:replace cleanup hook must be available");

function setup({ hasPlugin = true, supportsPjax = true } = {}) {
  const elements = [
    "halo-contact-form-auto-loader",
    "halo-contact-form-auto-display",
    "halo-contact-form",
    "halo-contact-form-trigger",
    "another-plugin-widget",
  ].map((tag) => ({
    tag,
    removed: false,
    value: "未提交的输入",
    remove() {
      this.removed = true;
    },
  }));
  const window = {
    location: { href: "https://example.test/next", assign() {} },
    history: { back() {} },
  };
  if (hasPlugin) {
    window.autoContactFrom = [{ id: "old-form", displayFormConfig: { displayForm: "aside_button" } }];
    window.contactFormTracking = [{ formName: "old-form", tracking: { enabled: true } }];
  }
  const classList = { contains: () => false, toggle() {} };
  const context = vm.createContext({
    window,
    document: {
      body: { classList },
      querySelectorAll(selector) {
        const tags = selector.split(",").map((tag) => tag.trim());
        return elements.filter((element) => !element.removed && tags.includes(element.tag));
      },
    },
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
    history: { popstate: false },
    to: {
      url: "/next",
      document: { body: { classList }, querySelector: () => (supportsPjax ? {} : null) },
    },
    aborted: false,
    abort() {
      this.aborted = true;
    },
  };
  return { elements, window, visit, clean: () => hook(visit) };
}

test("leaving a form page removes both automatic hosts without clearing manual widgets or input", () => {
  const state = setup();
  state.clean();
  assert.deepEqual(
    state.elements.filter((element) => !element.removed).map((element) => element.tag),
    ["halo-contact-form", "halo-contact-form-trigger", "another-plugin-widget"],
  );
  assert.ok(state.elements.every((element) => element.value === "未提交的输入"));
});

test("a destination without injected config cannot reuse old automatic forms or attribution", () => {
  const state = setup();
  const previousConfig = state.window.autoContactFrom;
  const previousTracking = state.window.contactFormTracking;
  state.clean();
  assert.equal(state.window.autoContactFrom.length, 0, "old auto config would recreate the floating form");
  assert.equal(state.window.contactFormTracking.length, 0, "old attribution config must not follow a new page");
  assert.equal(previousConfig[0].id, "old-form", "do not mutate the form configuration object");
  assert.equal(previousTracking[0].formName, "old-form");
});

test("the next page can inject its own config and the following navigation clears that page only", () => {
  const state = setup();
  state.clean();
  const nextConfig = [{ id: "new-form" }];
  const nextTracking = [{ formName: "new-form" }];
  state.window.autoContactFrom = nextConfig;
  state.window.contactFormTracking = nextTracking;
  assert.equal(state.window.autoContactFrom[0].id, "new-form");
  state.clean();
  assert.equal(state.window.autoContactFrom.length, 0);
  assert.equal(state.window.contactFormTracking.length, 0);
  assert.equal(nextConfig[0].id, "new-form");
  assert.equal(nextTracking[0].formName, "new-form");
});

test("an independent page aborts PJAX before altering the current form state", () => {
  const state = setup({ supportsPjax: false });
  const config = state.window.autoContactFrom;
  state.clean();
  assert.equal(state.visit.aborted, true);
  assert.ok(state.elements.every((element) => !element.removed));
  assert.equal(state.window.autoContactFrom, config);
});

test("navigation without Contact Form does not introduce plugin globals", () => {
  const state = setup({ hasPlugin: false });
  state.clean();
  assert.equal("autoContactFrom" in state.window, false);
  assert.equal("contactFormTracking" in state.window, false);
});
