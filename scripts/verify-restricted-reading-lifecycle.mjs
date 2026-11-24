import assert from "node:assert/strict";
import test from "node:test";
import { mountPluginPage } from "../src/common/js/plugin-page.js";

test("restricted-reading answer and MP modals inherit theme and close through their API", (t) => {
  const calls = [];
  const modal = (name) => ({
    close: () => calls.push(name + ":close"),
    classList: { toggle: (token, active) => calls.push([name, token, active]) },
  });
  const original = { window: globalThis.window, document: globalThis.document, MutationObserver: globalThis.MutationObserver };
  Object.assign(globalThis, {
    window: {},
    document: {
      body: {},
      documentElement: { dataset: { colorScheme: "dark" } },
      querySelectorAll(selector) {
        if (!selector.includes("content-restrict")) return [];
        assert.ok(!selector.includes("pay"));
        return [modal("answer"), modal("mp")];
      }
    },
    MutationObserver: class { observe() {} disconnect() { calls.push("disposed"); } }
  });
  t.after(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  });
  const leave = mountPluginPage({}, { assets: [], galleries: [], contacts: [] }, new AbortController().signal, true);
  leave();
  assert.deepEqual(calls, [
    ["answer", "color-scheme-dark", true], ["mp", "color-scheme-dark", true],
    "disposed", "answer:close", "mp:close",
  ]);
});
