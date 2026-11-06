#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/static/js/article-content.js", import.meta.url), "utf8");
const normalizeSource = source.match(
  /function normalizeNestedShikiBlocks\(\) \{[\s\S]*?(?=\n {2}function observeShikiStructure\()/,
)?.[0];
assert.ok(normalizeSource, "production Shiki normalization function must be available");

// Model only the element-tree operations owned by normalization. Custom-element
// rendering and browser layout remain part of the real-page verification.
function element(tag, children = [], textContent = "") {
  const node = {
    tagName: tag.toUpperCase(),
    children,
    textContent,
    parentElement: null,
    get childElementCount() {
      return this.children.length;
    },
    get firstElementChild() {
      return this.children[0] || null;
    },
    querySelectorAll(selector) {
      assert.equal(selector, "shiki-code > shiki-code");
      return this.children.flatMap((child) => [
        ...(this.tagName === "SHIKI-CODE" && child.tagName === "SHIKI-CODE" ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    },
    replaceWith(replacement) {
      const parent = this.parentElement;
      if (!parent) return;
      const index = parent.children.indexOf(this);
      const previousParent = replacement.parentElement;
      if (previousParent) {
        previousParent.children.splice(previousParent.children.indexOf(replacement), 1);
      }
      parent.children.splice(index, 1, replacement);
      replacement.parentElement = parent;
      this.parentElement = null;
    },
  };
  children.forEach((child) => {
    child.parentElement = node;
  });
  return node;
}

function normalize(content) {
  const context = vm.createContext({
    document: {
      getElementById(id) {
        assert.equal(id, "article-content");
        return content;
      },
    },
    skyDebug: { warn() {} },
  });
  // A timeout makes the regression report a failure rather than hang the runner.
  assert.doesNotThrow(
    () => vm.runInContext(`${normalizeSource}\nnormalizeNestedShikiBlocks();`, context, { timeout: 500 }),
    "normalization must finish even when a nested host cannot be safely unwrapped",
  );
}

test("unwraps a nested Shiki chain while preserving the actual code and surrounding content", () => {
  const pre = element("pre", [], "const answer = 42;\nconsole.log(answer);");
  const inner = element("shiki-code", [pre]);
  const outer = element("shiki-code", [element("shiki-code", [inner])]);
  const heading = element("h2", [], "代码示例");
  const content = element("article", [heading, outer]);

  normalize(content);

  assert.deepEqual(content.children, [heading, inner]);
  assert.deepEqual(inner.children, [pre]);
  assert.equal(pre.textContent, "const answer = 42;\nconsole.log(answer);");
});

test("leaves a multi-child nested host intact and still normalizes an independent safe chain", () => {
  const pre = element("pre", [], "keep this code");
  const inner = element("shiki-code", [pre]);
  const caption = element("span", [], "保留说明");
  const blocked = element("shiki-code", [inner, caption]);
  const safe = element("shiki-code", [element("pre", [], "other code")]);
  const content = element("article", [blocked, element("shiki-code", [safe])]);

  normalize(content);

  assert.deepEqual(content.children, [blocked, safe]);
  assert.deepEqual(blocked.children, [inner, caption]);
  assert.deepEqual(inner.children, [pre]);
  assert.equal(pre.textContent, "keep this code");
  assert.equal(caption.textContent, "保留说明");
});

test("keeps non-nested Shiki and native code blocks unchanged", () => {
  const highlighted = element("shiki-code", [element("pre", [], "highlighted")]);
  const native = element("pre", [], "excluded language");
  const content = element("article", [highlighted, native]);

  normalize(content);

  assert.deepEqual(content.children, [highlighted, native]);
  assert.equal(highlighted.children[0].textContent, "highlighted");
  assert.equal(native.textContent, "excluded language");
});
