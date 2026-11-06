import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const main = fs.readFileSync(new URL("src/common/main.js", root), "utf8");
const start = main.indexOf('    const pjaxScripts = document.querySelectorAll("script[data-pjax], script.pjax");');
const end = main.indexOf("    // 快速路径", start);
assert.ok(start >= 0 && end > start, "the production script replay boundary must exist");
const replay = main.slice(start, end);
const lifecycleFile = new URL("src/common/js/plugin-script-lifecycle.js", root);
const createLifecycle = fs.existsSync(lifecycleFile) ? (await import(lifecycleFile)).createPluginScriptLifecycle : null;
const bootstrap = (
  theme = "github-dark",
) => `import { renderCodeBlock } from '/plugins/shiki/assets/static/shiki-code.js?version=1.5.1';
window.addEventListener('pjax:complete', () => renderCodeBlock({ darkTheme: '${theme}' }));`;

function fixture({ initial = [], initialReady = true } = {}) {
  let renders = 0;
  let pageConfigurations = 0;
  let lateReadyCalls = 0;
  let sources = [];
  const timers = new Map();
  let timerId = 0;
  const pendingScripts = [];
  const completionSignals = [];
  const registeredSignals = [];
  class CompletionTarget extends EventTarget {
    addEventListener(type, callback, options) {
      if (type.startsWith("sky:shiki-bootstrap-ready:")) registeredSignals.push(type);
      return super.addEventListener(type, callback, options);
    }
    dispatchEvent(event) {
      if (event.type.startsWith("sky:shiki-bootstrap-ready:")) completionSignals.push(event.type);
      return super.dispatchEvent(event);
    }
  }
  const window = new CompletionTarget();
  class Script extends EventTarget {
    constructor(code = "", src = "") {
      super();
      this.textContent = code;
      this.src = src;
      this.type = "module";
      this.attributes = [
        { name: "type", value: "module" },
        { name: "data-pjax", value: "" },
      ];
      this.parentNode = {
        replaceChild: (next) => {
          if (next.textContent.includes("renderCodeBlock")) {
            pendingScripts.push(next);
          } else pageConfigurations++;
        },
      };
    }
    setAttribute(name, value) {
      this[name] = value;
    }
    getAttribute(name) {
      return this[name] || null;
    }
  }
  const document = {
    querySelectorAll: () => sources,
    createElement: () => new Script(),
  };
  const initialScripts = initial.map((code) => new Script(code));
  const lifecycle = createLifecycle?.({
    initialScripts,
    completionTarget: window,
    onLateReady: () => {
      lateReadyCalls++;
    },
    isShikiReady: () => initialReady,
    setTimer: (fn) => {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimer: (id) => timers.delete(id),
  });
  Object.assign(window, {
    __skyPluginScriptLifecycle: lifecycle,
    __skyLoadedPluginScripts: new Set(),
    __skyLoadingPluginScripts: new Set(),
  });
  const context = vm.createContext({
    document,
    window,
    Event,
    renderCodeBlock: () => {
      renders++;
    },
    skyDebug: { event() {}, error() {} },
    debugState: { id: 1 },
    debugPath: (v) => v,
  });
  const execute = (script) => vm.runInContext(script.textContent.replace(/^import[^;]*;\s*/m, ""), context);
  if (initialReady) initialScripts.forEach(execute);
  return {
    lifecycle,
    timers,
    window,
    initialScripts,
    completionSignals,
    registeredSignals,
    executeInitial: (index = 0) => execute(initialScripts[index]),
    failInitial: (index = 0) => initialScripts[index].dispatchEvent(new Event("error")),
    lateReadyCalls: () => lateReadyCalls,
    run(codes) {
      sources = codes.map((code) => new Script(code));
      vm.runInContext(`(() => {${replay}})()`, context);
    },
    executePending() {
      // Inline module execution does not emit an element load event in Chromium.
      // Only production instrumentation appended to this clone can signal success.
      pendingScripts.splice(0).forEach(execute);
    },
    failPending() {
      pendingScripts.splice(0).forEach((script) => script.dispatchEvent(new Event("error")));
    },
    renderCalls() {
      renders = 0;
      window.dispatchEvent(new Event("pjax:complete"));
      return renders;
    },
    configurations: () => pageConfigurations,
    incoming(code) {
      return { querySelectorAll: () => (code ? [new Script(code)] : []) };
    },
  };
}

function readiness(lifecycle) {
  let resolved = false;
  lifecycle.ready().then(() => {
    resolved = true;
  });
  return async () => {
    await nextTurn();
    return resolved;
  };
}

test("PJAX keeps the existing Shiki bootstrap listener while replaying per-page Contact Form config", async () => {
  const f = fixture({ initial: [bootstrap()] });
  for (let i = 0; i < 3; i++) {
    f.run([bootstrap(), "window.autoContactFrom = [];"]);
    f.executePending();
  }
  assert.equal(f.renderCalls(), 1, "persistent Shiki listeners must not grow on each navigation");
  assert.equal(f.configurations(), 3, "page-specific config must still update on every navigation");
});

test("inline module completion releases readiness without an element load event", async () => {
  const f = fixture();
  f.run([bootstrap()]);
  const isReady = readiness(f.lifecycle);
  assert.equal(await isReady(), false, "compatibility events must wait for the new module listener");
  f.executePending();
  assert.equal(await isReady(), true, "executing the clone's completion signal must release the existing wait");
  assert.equal(f.lateReadyCalls(), 0, "ordinary success must not request a second compatibility event");
  f.run([bootstrap()]);
  f.executePending();
  assert.equal(f.renderCalls(), 1);
});

test("changed Shiki settings require a full document instead of adding a second anonymous listener", () => {
  const f = fixture({ initial: [bootstrap()] });
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap("nord"))), true);
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), false);
  assert.equal(f.lifecycle?.requiresReload(f.incoming(null)), true);
});

test("failed bootstrap can retry without treating a failed module as initialized", async () => {
  const f = fixture();
  f.run([bootstrap()]);
  const isReady = readiness(f.lifecycle);
  f.failPending();
  assert.equal(await isReady(), true);
  f.run([bootstrap()]);
  assert.equal(f.timers.size, 1, "the retry must register its own pending module");
  f.failPending();
});

test("uncertain timed-out module cannot be replayed in the same document", async () => {
  const f = fixture();
  f.run([bootstrap()]);
  const isReady = readiness(f.lifecycle);
  [...f.timers.values()].forEach((fn) => fn());
  assert.equal(await isReady(), true, "timeout releases the current wait without confirming success");
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), true);
  assert.equal(f.lateReadyCalls(), 0);
  f.run([bootstrap()]);
  f.executePending();
  assert.equal(f.renderCalls(), 1, "an unresolved import must not be injected again while it may still execute");
});

test("inline completion after the wait timeout confirms the bootstrap and reports late readiness once", async () => {
  const f = fixture();
  f.run([bootstrap()]);
  const isReady = readiness(f.lifecycle);
  [...f.timers.values()].forEach((fn) => fn());
  assert.equal(await isReady(), true);
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), true, "timeout alone is not proof of success");

  f.executePending();
  assert.equal(
    f.lifecycle?.requiresReload(f.incoming(bootstrap())),
    false,
    "actual execution must remove timeout uncertainty instead of forcing an unrelated full reload",
  );
  assert.equal(f.lateReadyCalls(), 1, "late success must let the owner recover a missed compatibility event");
  assert.equal(f.completionSignals.length, 1, "the clone must emit its own completion signal");
  f.window.dispatchEvent(new Event(f.completionSignals[0]));
  assert.equal(f.lateReadyCalls(), 1, "duplicate completion must not repeat the recovery callback");
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap("nord"))), true);
  assert.equal(f.lifecycle?.requiresReload(f.incoming(null)), true);
  f.run([bootstrap()]);
  f.executePending();
  assert.equal(f.renderCalls(), 1, "late success must keep the single installed anonymous listener");
});

test("an observed error after the wait timeout releases the failed bootstrap for a safe retry", async () => {
  const f = fixture();
  f.run([bootstrap()]);
  const isReady = readiness(f.lifecycle);
  [...f.timers.values()].forEach((fn) => fn());
  assert.equal(await isReady(), true);

  f.failPending();
  assert.equal(f.lateReadyCalls(), 0, "failure must not report a renderable bootstrap");
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), false, "a definite import failure can be retried");
  f.run([bootstrap()]);
  const retryReady = readiness(f.lifecycle);
  assert.equal(await retryReady(), false, "the new registration must wait for its own module result");
  f.executePending();
  assert.equal(await retryReady(), true);
  assert.equal(f.lateReadyCalls(), 0, "an on-time retry must not inherit the failed registration's timeout");
  assert.equal(f.renderCalls(), 1);
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), false);
});

test("a stale timeout from a failed registration cannot mark a successful retry uncertain", async () => {
  const f = fixture();
  f.run([bootstrap()]);
  const staleTimeout = [...f.timers.values()][0];
  f.failPending();
  assert.equal(await readiness(f.lifecycle)(), true);

  f.run([bootstrap("nord")]);
  const retryReady = readiness(f.lifecycle);
  f.executePending();
  assert.equal(await retryReady(), true);
  staleTimeout();
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap("nord"))), false);
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), true);
  f.run([bootstrap("nord")]);
  f.executePending();
  assert.equal(f.renderCalls(), 1, "stale work must not clear or replace the new registration");
});

test("an initial import that failed before the theme loaded requires a fresh document", () => {
  const f = fixture({ initial: [bootstrap()], initialReady: false });
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), true);
});

test("initial inline execution without an observed readiness signal stays conservative", () => {
  const f = fixture({ initial: [bootstrap()], initialReady: false });
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), true);
  f.executeInitial();
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), true);
  assert.equal(f.lifecycle?.requiresReload(f.incoming(null)), true);
  f.run([bootstrap()]);
  f.executePending();
  assert.equal(f.renderCalls(), 1);
});

test("an observed initial import error allows a new bootstrap to register and become ready", async () => {
  const f = fixture({ initial: [bootstrap()], initialReady: false });
  f.failInitial();
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), false);
  f.run([bootstrap()]);
  const isReady = readiness(f.lifecycle);
  f.executePending();
  assert.equal(await isReady(), true);
  assert.equal(f.renderCalls(), 1);
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), false);
});

test("an older initial script error cannot clear a newer unresolved initial registration", () => {
  const f = fixture({ initial: [bootstrap(), bootstrap("nord")], initialReady: false });
  f.failInitial();
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap("nord"))), true);
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), true);
  f.run([bootstrap("nord")]);
  f.executeInitial(1);
  f.executePending();
  assert.equal(f.renderCalls(), 1);
});

test("an unknown completion token cannot release pending readiness or confirm a timed-out bootstrap", async () => {
  const f = fixture();
  f.run([bootstrap()]);
  const isReady = readiness(f.lifecycle);
  f.window.dispatchEvent(new Event("sky:shiki-bootstrap-ready:unknown"));
  assert.equal(await isReady(), false);
  [...f.timers.values()].forEach((fn) => fn());
  assert.equal(await isReady(), true);
  f.window.dispatchEvent(new Event("sky:shiki-bootstrap-ready:unknown"));
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), true);
  assert.equal(f.lateReadyCalls(), 0);
  f.executePending();
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap())), false);
  assert.equal(f.lateReadyCalls(), 1);
});

test("a failed registration's old completion token cannot complete or confirm its replacement", async () => {
  const f = fixture();
  f.run([bootstrap()]);
  const oldSignal = f.registeredSignals[0];
  assert.equal(typeof oldSignal, "string", "the tracked module must own a completion listener");
  [...f.timers.values()].forEach((fn) => fn());
  f.failPending();
  f.run([bootstrap("nord")]);
  const retryReady = readiness(f.lifecycle);
  f.window.dispatchEvent(new Event(oldSignal));
  assert.equal(await retryReady(), false, "a previous token cannot release the new module's wait");
  assert.equal(f.lateReadyCalls(), 0, "the superseded registration cannot request late recovery");
  [...f.timers.values()].forEach((fn) => fn());
  f.window.dispatchEvent(new Event(oldSignal));
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap("nord"))), true);
  assert.equal(f.lateReadyCalls(), 0);
  f.executePending();
  assert.equal(await retryReady(), true);
  assert.equal(f.lifecycle?.requiresReload(f.incoming(bootstrap("nord"))), false);
  assert.equal(f.lateReadyCalls(), 1);
  assert.equal(f.renderCalls(), 1);
});
