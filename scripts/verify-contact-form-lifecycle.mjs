import assert from "node:assert/strict";
import test from "node:test";
import { mountPluginPage } from "../src/common/js/plugin-page.js";

test("leaving a page removes both automatic hosts, retaining manual widgets", (t) => {
  const removed = [];
  const automatic = ["halo-contact-form-auto-loader", "halo-contact-form-auto-display"]
    .map((name) => ({ remove: () => removed.push(name) }));
  const manual = { remove() { assert.fail("manual widget must remain in its page"); } };
  const state = { autoContactFrom: [{ formId: "old" }], contactFormTracking: [{}] };
  const originals = [globalThis.window, globalThis.document, globalThis.MutationObserver];
  Object.assign(globalThis, {
    window: state,
    document: {
      body: {},
      documentElement: { dataset: {} },
      querySelectorAll(selector) {
        if (selector.includes("body > halo-contact-form-auto")) return automatic;
        if (selector.includes("halo-contact-form")) return [manual];
        return [];
      },
    },
    MutationObserver: class { observe() {} disconnect() {} },
  });
  t.after(() => {
    for (const [index, name] of ["window", "document", "MutationObserver"].entries()) {
      if (originals[index] === undefined) delete globalThis[name];
      else globalThis[name] = originals[index];
    }
  });
  const leave = mountPluginPage({}, { assets: [], galleries: [], contacts: [] }, new AbortController().signal, true);
  leave();
  assert.deepEqual(removed, ["halo-contact-form-auto-loader", "halo-contact-form-auto-display"]);
  assert.deepEqual(state.autoContactFrom, []);
  assert.deepEqual(state.contactFormTracking, []);
});
