import assert from "node:assert/strict";
import { test } from "node:test";
import { initializePageCover } from "../src/pages/page/cover.js";

class Cover extends EventTarget {
  hidden = false;
  complete = false;
  naturalWidth = 0;
}

test("a cached broken cover is hidden instead of leaving a broken banner", () => {
  const image = new Cover();
  image.complete = true;
  initializePageCover(image);
  assert.equal(image.hidden, true);
});

test("a cover that fails after initialization is hidden", () => {
  const image = new Cover();
  initializePageCover(image);
  image.dispatchEvent(new Event("error"));
  assert.equal(image.hidden, true);
});

test("a successfully loaded cover remains visible", () => {
  const image = new Cover();
  image.complete = true;
  image.naturalWidth = 1200;
  initializePageCover(image);
  assert.equal(image.hidden, false);
});

test("leaving the page removes the pending error handler", () => {
  const image = new Cover();
  const cleanup = initializePageCover(image);
  cleanup();
  image.dispatchEvent(new Event("error"));
  assert.equal(image.hidden, false);
});

test("a page without a cover needs no special handling", () => {
  assert.doesNotThrow(() => initializePageCover(null)());
});
