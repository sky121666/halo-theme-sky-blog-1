#!/usr/bin/env node

import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/pages/about/about.js", import.meta.url), "utf8");
const initializer = source.match(/SF\.initLocation = function\(\) \{[\s\S]*?\n {2}\};/)?.[0];
assert.ok(initializer, "the production location initializer must be available");

// Image transport stays offline; production code owns all rendering and event handling.
function setup({
  key = "",
  latitude = "0",
  longitude = "0",
  width = 400,
  name = "Fixture",
  initialize = true,
  cachedOutcome = "",
} = {}) {
  const requests = [];
  class Element extends EventTarget {
    constructor(tag) {
      super();
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.attributes = new Map();
      this.hidden = false;
      this.style = {};
      this.className = "";
      this.naturalWidth = 0;
    }

    setAttribute(attribute, value) {
      this.attributes.set(attribute, String(value));
    }

    getAttribute(attribute) {
      return this.attributes.get(attribute) ?? null;
    }

    removeAttribute(attribute) {
      this.attributes.delete(attribute);
    }

    set src(value) {
      this.setAttribute("src", value);
      requests.push(String(value));
      if (cachedOutcome) {
        this.complete = true;
        this.naturalWidth = cachedOutcome === "load" ? 400 : 0;
        this.dispatchEvent(new Event(cachedOutcome));
      }
    }

    get src() {
      return this.getAttribute("src") || "";
    }

    set textContent(value) {
      this.text = String(value);
      this.children = [];
    }

    get textContent() {
      return (this.text || "") + this.children.map((child) => child.textContent).join("");
    }

    append(...children) {
      this.children.push(...children);
    }

    appendChild(child) {
      this.append(child);
      return child;
    }

    replaceChildren(...children) {
      this.children = children;
      this.text = "";
    }

    set innerHTML(value) {
      this.replaceChildren();
      this.text = value.replace(/<[^>]+>/g, "");
      const anchor = value.match(/<a\b[^>]*\bhref="([^"]+)"/);
      const parent = anchor ? new Element("a") : this;
      if (anchor) {
        parent.href = anchor[1];
        this.append(parent);
      }
      for (const match of value.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
        const image = new Element("img");
        image.src = match[1];
        parent.append(image);
      }
    }

    querySelector(selector) {
      const matches = (element) =>
        selector.startsWith(".")
          ? element.className.split(/\s+/).includes(selector.slice(1))
          : element.tagName === selector.toUpperCase();
      for (const child of this.children) {
        if (matches(child)) return child;
        const nested = child.querySelector(selector);
        if (nested) return nested;
      }
      return null;
    }
  }

  const map = new Element("div");
  map.offsetWidth = width;
  for (const [attribute, value] of Object.entries({
    "data-map-key": key,
    "data-lat": latitude,
    "data-lng": longitude,
    "data-name": name,
    "data-map-state": key?.trim() ? "loading" : "unconfigured",
  })) {
    if (value !== null) map.setAttribute(attribute, value);
  }
  const context = vm.createContext({
    SF: {},
    AbortController,
    URL,
    URLSearchParams,
    document: {
      getElementById: () => map,
      createElement: (tag) => new Element(tag),
    },
  });
  vm.runInContext(initializer, context);
  const cleanup = initialize ? context.SF.initLocation() : undefined;
  return { map, requests, cleanup, context };
}

test("an absent or blank map key renders a local location link without an image request", () => {
  for (const key of [null, "", " \n "]) {
    const state = setup({ key });
    assert.equal(state.requests.length, 0, "an unconfigured preview must not use a shared key");
    assert.equal(state.map.querySelector("img"), null);
    assert.ok(state.map.querySelector("a"), "the location must remain reachable");
    assert.equal(state.map.querySelector(".sf-location-fallback")?.hidden, false);
    assert.equal(state.map.getAttribute("data-map-state"), "unconfigured");
  }
});

test("a configured preview uses the supplied key and stays hidden until the image loads", () => {
  const state = setup({ key: "  TEST_ONLY_KEY  ", width: 20 });
  assert.equal(state.requests.length, 1);
  const request = new URL(state.requests[0]);
  assert.equal(request.origin, "https://apis.map.qq.com");
  assert.equal(request.pathname, "/ws/staticmap/v2/");
  assert.ok(request.searchParams.get("key") === "TEST_ONLY_KEY", "use only the supplied key");
  assert.equal(request.searchParams.get("size"), "50*320", "respect the provider's minimum image width");
  const image = state.map.querySelector("img");
  const fallback = state.map.querySelector(".sf-location-fallback");
  assert.equal(image.hidden, true);
  assert.equal(fallback.hidden, false);
  image.naturalWidth = 400;
  image.dispatchEvent(new Event("load"));
  assert.equal(image.hidden, false);
  assert.equal(fallback.hidden, true);
  assert.equal(state.map.getAttribute("data-map-state"), "ready");
});

test("a failed preview hides the image and preserves its existing location destination", () => {
  const state = setup({ key: "TEST_ONLY_KEY" });
  const image = state.map.querySelector("img");
  const link = state.map.querySelector("a");
  const destination = link.href;
  image.dispatchEvent(new Event("error"));
  assert.equal(image.hidden, true);
  assert.equal(state.map.querySelector(".sf-location-fallback").hidden, false);
  assert.equal(link.href, destination);
  assert.equal(state.map.getAttribute("data-map-state"), "failed");
  assert.equal(state.requests.length, 1, "failure must not retry the same rejected request");
});

test("cached image outcomes cannot settle before the preview handlers are ready", () => {
  for (const cachedOutcome of ["load", "error"]) {
    const state = setup({ key: "TEST_ONLY_KEY", cachedOutcome });
    const loaded = cachedOutcome === "load";
    assert.equal(state.map.querySelector("img").hidden, !loaded);
    assert.equal(state.map.querySelector(".sf-location-fallback").hidden, loaded);
  }
});

test("leaving the page removes image handlers and cancels the pending preview source", () => {
  const state = setup({ key: "TEST_ONLY_KEY" });
  const image = state.map.querySelector("img");
  assert.equal(typeof state.cleanup, "function");
  state.cleanup();
  assert.equal(getEventListeners(image, "load").length, 0);
  assert.equal(getEventListeners(image, "error").length, 0);
  assert.equal(image.getAttribute("src"), null);
  image.dispatchEvent(new Event("load"));
  assert.equal(image.hidden, true, "a stale image must not change the disposed page");
});

test("the page lifecycle runs cleanup returned by the delayed location initializer", () => {
  const state = setup({ key: "TEST_ONLY_KEY", initialize: false });
  const lifecycle = source.match(
    /registerPageLifecycle\(function\(\) \{[\s\S]*?\n {2}\}, \{ entry: 'about' \}\);/,
  )?.[0];
  assert.ok(lifecycle, "the production about page lifecycle must be available");
  let timer;
  let dispose;
  Object.assign(state.context, {
    window: {
      setTimeout(callback) {
        timer = callback;
      },
      clearTimeout() {},
    },
    registerPageLifecycle(mount) {
      dispose = mount();
    },
  });
  state.context.document.querySelector = () => state.map;
  for (const method of [
    "initScrollReveal",
    "initStatCounter",
    "initArticleHeatmap",
    "initGitHub",
    "initToolkitProgress",
    "initSmoothScroll",
    "cancelAnimationFrames",
  ]) {
    state.context.SF[method] = () => undefined;
  }
  vm.runInContext(lifecycle, state.context);
  timer();
  const image = state.map.querySelector("img");
  assert.ok(getEventListeners(image, "load").length > 0);
  dispose();
  assert.equal(getEventListeners(image, "load").length, 0);
  assert.equal(getEventListeners(image, "error").length, 0);
  assert.equal(image.getAttribute("src"), null);
});

test("invalid coordinates never create a map request or an invalid external destination", () => {
  for (const [latitude, longitude] of [
    ["", "0"],
    [null, "0"],
    ["91", "0"],
    ["0", "181"],
    ["12junk", "0"],
    ["Infinity", "0"],
  ]) {
    for (const key of ["", "TEST_ONLY_KEY"]) {
      const state = setup({ key, latitude, longitude });
      assert.equal(state.requests.length, 0);
      assert.equal(state.map.querySelector("a"), null);
      assert.equal(state.map.getAttribute("data-map-state"), "failed", "invalid coordinates must not retain the hidden unconfigured fallback");
      assert.ok(state.map.textContent.length > 0, "invalid coordinates need visible guidance");
    }
  }
});

test("location labels remain plain text and large containers keep the existing image size cap", () => {
  const name = "<svg onload=alert(1)>";
  const state = setup({ key: "TEST_ONLY_KEY", name, width: 2000 });
  assert.equal(state.map.querySelector("a").getAttribute("aria-label"), "在高德地图中查看" + name);
  assert.equal(state.map.querySelector("svg"), null);
  const link = new URL(state.map.querySelector("a").href);
  assert.equal(link.searchParams.get("name"), name);
  assert.equal(new URL(state.requests[0]).searchParams.get("size"), "800*320");
});
