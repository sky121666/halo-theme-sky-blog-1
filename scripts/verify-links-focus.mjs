import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const runtime = fs.readFileSync(new URL("../src/apps/links/runtime.js", import.meta.url), "utf8");
function part(start, end) {
  const first = runtime.indexOf(start);
  const last = runtime.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing production boundary: ${start}`);
  return runtime.slice(first, last);
}

function fixture(scope = "all") {
  const document = { activeElement: null };
  class Node {
    constructor(tag = "div") {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.className = "";
      this.hidden = false;
      this.style = {};
      this.isConnected = true;
      this.events = new Map();
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/), ...names])].join(" "); },
        toggle: (name, enabled) => {
          const names = new Set(this.className.split(/\s+/));
          if (enabled ?? !names.has(name)) names.add(name);
          else names.delete(name);
          this.className = [...names].join(" ");
        },
      };
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    matches(selector) {
      if (selector.includes(",")) return selector.split(",").some(value => this.matches(value.trim()));
      if (selector === "[hidden]") return this.hidden;
      if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
      const data = selector.match(/^\[data-([\w-]+)\]$/);
      if (data) return Object.hasOwn(this.dataset, data[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase()));
      return this.tagName.toLowerCase() === selector;
    }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    replaceChildren(...children) {
      // Model the native focus loss when a focused subtree is replaced.
      if (this.contains(document.activeElement)) document.activeElement = document.body;
      this.children.forEach(child => { child.parentNode = null; });
      this.children = [];
      this.append(...children);
    }
    focus() { if (!this.disabled && !this.closest("[hidden]")) document.activeElement = this; }
    addEventListener(type, listener) { this.events.set(type, listener); }
  }
  document.createElement = tag => new Node(tag);
  document.createTextNode = text => Object.assign(new Node("#text"), { textContent: text });
  document.body = new Node("body");
  document.activeElement = document.body;
  const root = new Node();
  const list = new Node("ul");
  list.dataset.feedList = "";
  const filter = new Node("button");
  filter.dataset.feedScope = scope;
  filter.className = "links-filter-active";
  const dialog = new Node("dialog");
  dialog.dataset.feedDetailDialog = "";
  dialog.open = false;
  const close = new Node("button");
  dialog.append(close);
  for (const field of ["title", "author", "time", "summary", "visit"]) {
    const node = new Node(field === "visit" ? "a" : "span");
    node.dataset[`feedDetail${field[0].toUpperCase()}${field.slice(1)}`] = "";
    dialog.append(node);
  }
  const pendingCloses = [];
  dialog.showModal = () => { dialog.open = true; close.focus(); };
  dialog.close = () => {
    dialog.open = false;
    if (dialog.contains(document.activeElement)) document.activeElement = document.body;
    pendingCloses.push(() => dialog.events.get("close")());
  };
  root.append(list, filter, dialog);
  document.body.append(root);
  const state = {
    route: { view: "friends", scope }, feedActionBusy: new Set(), feedDetails: new Map(),
    autoMarked: new Set(), feedDetailItemId: "", feedReturnFocus: null,
  };
  const feed = {
    key: `console:${scope}`, status: "ready", hasNext: false,
    items: ["a", "b", "c"].map(id => ({ id, title: id, read: false, favorite: true, readLater: true })),
  };
  const signal = new AbortController().signal;
  const request = { scope, protectedMode: true };
  let api;
  const source = [
    part("function icon(className)", "export function mountLinksApp()"),
    part("  function captureFeedFocus(list)", "  function setText("),
    part("  function setText(", "  function syncLinkDialog("),
    part("  function syncFeedDialog(", "  async function setFeedFlag("),
    part("  const linkDialog = root.querySelector", '  window.addEventListener(\n    "popstate"'),
  ].join("\n");
  api = vm.runInNewContext(`(() => { ${source} return { renderFeedResults }; })()`, {
    root, document, state, feed, signal, feedSources: new Map(),
    feedKey: value => `console:${value.scope}`,
    formatDate: value => value,
    normalizeHttpUrl: value => value,
    capabilities: { canReadFeed: true },
    programmaticDialogCloses: new WeakMap(),
    syncFeedAvatar() {},
    setFeedFlag() {},
    navigate(patch) {
      Object.assign(state.route, patch);
      api.renderFeedResults(request);
    },
  });
  const render = () => api.renderFeedResults(request);
  const row = id => list.children.find(node => node.dataset.feedId === id);
  const action = (id, field) => row(id)?.querySelectorAll("[data-feed-toggle]").find(node => node.dataset.feedToggle === field);
  const title = id => row(id)?.querySelector(".links-feed-title");
  const closeDialog = () => { dialog.open = false; dialog.events.get("close")(); };
  const flushCloseEvents = () => pendingCloses.splice(0).forEach(callback => callback());
  render();
  return { state, feed, document, list, filter, dialog, close, render, row, action, title, closeDialog, flushCloseEvents };
}

for (const field of ["favorite", "later", "read"]) {
  test(`a ${field} update keeps the same row action focused while pending and after completion`, () => {
    const f = fixture();
    f.action("b", field).focus();
    f.state.feedActionBusy.add(`b:${field}`);
    f.render();
    assert.equal(f.document.activeElement, f.action("b", field));
    assert.equal(f.document.activeElement.attributes["aria-disabled"], "true");
    assert.notEqual(f.document.activeElement.disabled, true);
    f.state.feedActionBusy.clear();
    f.render();
    assert.equal(f.document.activeElement, f.action("b", field));
    assert.equal(f.document.activeElement.attributes["aria-disabled"], "false");
  });
}

test("removing the focused filtered row selects the next row, then the previous row, then the active filter", () => {
  const f = fixture("favorite");
  f.action("b", "favorite").focus();
  f.feed.items = f.feed.items.filter(item => item.id !== "b");
  f.render();
  assert.equal(f.document.activeElement, f.title("c"));
  f.feed.items = f.feed.items.filter(item => item.id !== "c");
  f.render();
  assert.equal(f.document.activeElement, f.title("a"));
  f.feed.items = [];
  f.feed.status = "empty";
  f.render();
  assert.equal(f.document.activeElement, f.filter);
});

test("a late list render preserves focus the user moved to a filter", () => {
  const f = fixture();
  f.action("b", "favorite").focus();
  f.render();
  f.filter.focus();
  f.render();
  assert.equal(f.document.activeElement, f.filter);
});

test("closing a detail returns to its title after background list replacements", () => {
  const f = fixture();
  f.title("b").focus();
  f.state.route.itemId = "b";
  f.render();
  assert.equal(f.document.activeElement, f.close);
  f.render();
  f.render();
  assert.equal(f.document.activeElement, f.close, "background renders must leave modal focus alone");
  f.closeDialog();
  assert.equal(f.document.activeElement, f.title("b"));
  assert.equal(f.state.route.itemId, null);
});

test("closing an already-read detail in unread returns to the next remaining title", () => {
  const f = fixture("unread");
  f.title("b").focus();
  f.state.route.itemId = "b";
  f.render();
  f.feed.items.find(item => item.id === "b").read = true;
  f.render();
  f.closeDialog();
  assert.equal(f.row("b"), undefined);
  assert.equal(f.document.activeElement, f.title("c"));
});

test("a delayed close event does not take focus away from another control", () => {
  const f = fixture();
  f.title("b").focus();
  f.state.route.itemId = "b";
  f.render();
  f.dialog.open = false;
  f.filter.focus();
  f.closeDialog();
  assert.equal(f.document.activeElement, f.filter);
});

test("route closure uses the programmatic close path and restores focus after the native close event", () => {
  const f = fixture();
  f.title("b").focus();
  f.state.route.itemId = "b";
  f.render();
  f.render();
  f.state.route.itemId = null;
  f.render();
  assert.equal(f.dialog.open, false);
  assert.equal(f.document.activeElement, f.document.body);
  f.flushCloseEvents();
  assert.equal(f.document.activeElement, f.title("b"));
  assert.equal(f.state.feedReturnFocus, null);
});

test("a queued programmatic close clears its return record without stealing a moved focus", () => {
  const f = fixture();
  f.title("b").focus();
  f.state.route.itemId = "b";
  f.render();
  f.state.route.itemId = null;
  f.render();
  f.filter.focus();
  f.flushCloseEvents();
  assert.equal(f.document.activeElement, f.filter);
  assert.equal(f.state.feedReturnFocus, null);
});

test("an old programmatic close cannot clear a reopened detail or its return record", () => {
  const f = fixture();
  f.title("b").focus();
  f.state.route.itemId = "b";
  f.render();
  f.state.route.itemId = null;
  f.render();
  f.title("c").focus();
  f.state.route.itemId = "c";
  f.render();
  f.flushCloseEvents();
  assert.equal(f.dialog.open, true);
  assert.equal(f.state.route.itemId, "c");
  assert.equal(f.state.feedReturnFocus.itemId, "c");
  assert.equal(f.document.activeElement, f.close);
  f.closeDialog();
  assert.equal(f.document.activeElement, f.title("c"));
});
