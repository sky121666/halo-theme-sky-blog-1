import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { applyLinksStateToUrl, normalizeLinksUrl } from "../src/apps/links/runtime.js";

// Compile offline fixtures as ordinary Java programs. JShell's remote execution
// requires loopback access and can hang in restricted runners before assertions run.
function runJavaFixture(commands, classpath) {
  const directory = mkdtempSync(join(tmpdir(), "sky-ui-java-"));
  const executable = (name) => (process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", name) : name);
  const imports = commands.filter((line) => line.startsWith("import "));
  const classes = commands.filter((line) => line.startsWith("class ")).map((line) => `static ${line}`);
  const body = commands.filter((line) => !line.startsWith("import ") && !line.startsWith("class ") && line !== "/exit");
  const source = `${imports.join("\n")}\npublic class UiFixture {\n${classes.join("\n")}\npublic static void main(String[] args) throws Exception {\n${body.join("\n")}\n}\n}`;
  const file = join(directory, "UiFixture.java");
  try {
    writeFileSync(file, source);
    const options = { encoding: "utf8", timeout: 30000 };
    const compiled = spawnSync(
      executable("javac"),
      ["-encoding", "UTF-8", "-cp", classpath, "-d", directory, file],
      options,
    );
    if (compiled.error || compiled.status !== 0) return compiled;
    return spawnSync(
      executable("java"),
      ["-cp", `${directory}${process.platform === "win32" ? ";" : ":"}${classpath}`, "UiFixture"],
      options,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const main = read("src/common/main.js");
const fallbackStart = main.indexOf("      if (!supportsSkyPjax || pluginBootstrapChanged) {");
const fallback = main.slice(fallbackStart, main.indexOf("\n      debugState.generation", fallbackStart));

function missingContainerVisit(popstate) {
  const actions = [];
  const visit = {
    to: { url: "/independent", hash: "#section" },
    history: { popstate },
    abort: () => actions.push("abort"),
  };
  const swup = { options: {} };
  runInNewContext(`(() => { ${fallback} })()`, {
    supportsSkyPjax: false,
    pluginBootstrapChanged: false,
    visit,
    swup,
    pageGeneration: 0,
    debugState: { id: 1 },
    skyDebug: { event() {} },
    debugPath: (path) => path,
    window: {
      location: {
        assign: (url) => actions.push(["assign", url]),
        reload: () => actions.push("reload"),
      },
      history: { back: () => actions.push("back") },
    },
  });
  return { actions, swup };
}

test("PJAX 历史访问缺少容器时直接恢复目标，不能再后退一条历史", () => {
  const { actions } = missingContainerVisit(true);
  assert.deepEqual(actions, ["abort", "reload"]);
});

test("普通 PJAX 访问保留上一文档历史，再整页打开独立页面", () => {
  const { actions, swup } = missingContainerVisit(false);
  assert.deepEqual(actions, ["abort", "back"]);
  assert.equal(swup.options.skipPopStateHandling(), true);
  assert.deepEqual(actions.at(-1), ["assign", "/independent#section"]);
});

function pageModuleFixture(count = 1) {
  const timers = new Map();
  const actions = [];
  const modules = Array.from({ length: count }, (_, i) =>
    Object.assign(new EventTarget(), {
      src: `https://halo.test/assets/js/page-${i}.js`,
    }),
  );
  let hook;
  let timerId = 0;
  const window = {
    location: { href: "https://halo.test/current", reload: () => actions.push("reload") },
    __skyLoadedPluginScripts: new Set(),
    __skyLoadingPluginScripts: new Set(),
    setTimeout(fn) {
      const id = ++timerId;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const context = {
    window,
    document: {
      querySelectorAll: () => [],
      getElementById: () => ({ querySelectorAll: () => modules }),
    },
    swup: {
      hooks: {
        on(_name, callback) {
          hook = callback;
        },
      },
    },
    getVisitDebug: () => ({ generation: 1 }),
    pageGeneration: 1,
    latestVisit: null,
    pendingPageAction: null,
    pendingPluginAction: null,
    cancelPageModuleWait: null,
    URL,
    replayNewHeadScripts() {},
    skyDebug: { event() {}, error() {}, warn() {} },
    debugPath: (value) => value,
    _currentSignaled: false,
    _resumeAlpine: (_reason, generation) => {
      if (generation === context.pageGeneration) actions.push("resume");
    },
  };
  const helperStart = main.indexOf("  function canApplyPageAction(");
  const helperEnd = main.indexOf("  const visitDebugState", helperStart);
  const start = main.indexOf('  swup.hooks.on("content:replace", (visit) => {');
  runInNewContext(
    `${main.slice(helperStart, helperEnd)}\n${main.slice(start, main.indexOf("\n} else {\n  // PJAX", start))}`,
    context,
  );
  hook({});
  return { context, modules, timers, actions, timeout: () => [...timers.values()].forEach((fn) => fn()) };
}

test("PJAX 页面模块全部加载完成才恢复一次初始化", () => {
  const f = pageModuleFixture(2);
  f.modules[0].dispatchEvent(new Event("load"));
  assert.deepEqual(f.actions, []);
  f.modules[1].dispatchEvent(new Event("load"));
  assert.deepEqual(f.actions, ["resume"]);
  assert.equal(f.timers.size, 0);
});

test("PJAX 模块超时通过当前URL整页恢复，不把缺失模块当作初始化完成", () => {
  const f = pageModuleFixture();
  f.timeout();
  assert.deepEqual(f.actions, ["reload"]);
  f.modules[0].dispatchEvent(new Event("load"));
  assert.deepEqual(f.actions, ["reload"], "late load must not initialize the discarded document");
});

test("PJAX 模块加载失败不对未注册的Alpine组件求值", () => {
  const f = pageModuleFixture(2);
  f.modules[0].dispatchEvent(new Event("error"));
  f.modules[1].dispatchEvent(new Event("load"));
  f.timeout();
  assert.deepEqual(f.actions, ["reload"]);
});

for (const failure of ["timeout", "error"]) {
  test(`旧页面模块${failure}不能刷新后来访问的页面`, () => {
    const f = pageModuleFixture();
    f.context.pageGeneration = 2;
    if (failure === "timeout") f.timeout();
    else f.modules[0].dispatchEvent(new Event("error"));
    assert.deepEqual(f.actions, []);
  });
}

// Exercise the actual visit hooks and rAF resume together. A navigation can have
// started and changed the URL while its response has not replaced the old DOM.
function slowNavigationFixture({ deferPlugins = false, initialPath = "/old", onMount } = {}) {
  const hooks = new Map();
  const frames = new Map();
  const timers = new Map();
  const actions = [];
  const compatibilityEvents = [];
  const eventNames = [];
  const pluginWaits = [];
  let onLateReady;
  let nextId = 0;
  let now = 0;
  let modules = [];
  let domPath = new URL(initialPath, "https://halo.test").pathname;
  const classes = { contains: () => false, toggle() {} };
  const container = {};
  const incomingDocument = { querySelector: () => container, body: { classList: classes } };
  const invoke = (name, visit, before = false) => {
    for (const handler of hooks.get(`${before ? "before:" : ""}${name}`) || []) handler(visit, {});
  };
  const register = (name, handler) => {
    const handlers = hooks.get(name) || [];
    handlers.push(handler);
    hooks.set(name, handlers);
  };
  const swup = {
    navigating: false,
    visit: null,
    options: {},
    hooks: {
      on: register,
      before: (name, handler) => register(`before:${name}`, handler),
    },
  };
  const location = {
    href: new URL(initialPath, "https://halo.test").href,
    reload: () => actions.push({ type: "reload", url: location.href, domPath }),
  };
  const setTimer = (fn, delay = 0) => {
    const id = ++nextId;
    timers.set(id, { fn, at: now + delay });
    return id;
  };
  const window = {
    location,
    __skyLoadedPluginScripts: new Set(),
    __skyLoadingPluginScripts: new Set(),
    __skyPluginScriptLifecycle: {
      requiresReload: () => false,
      ready() {
        if (!deferPlugins) return Promise.resolve();
        let resolve;
        const promise = new Promise((complete) => {
          resolve = complete;
        });
        pluginWaits.push({ resolve });
        return promise;
      },
    },
    setTimeout: setTimer,
    clearTimeout: (id) => timers.delete(id),
    SkyPjax: {
      _cleanup() {},
      _runPage(detail) {
        actions.push({ type: "mount", url: detail.url, domPath });
        onMount?.({ detail, window, changeUrl });
      },
    },
    Alpine: { deferMutations() {}, destroyTree() {}, flushAndStopDeferringMutations() {} },
  };
  const context = {
    window,
    document: {
      body: { classList: classes },
      querySelectorAll: () => [],
      querySelector: () => container,
      getElementById: () => ({ querySelectorAll: () => modules }),
      dispatchEvent(event) {
        eventNames.push(event.type);
        if (event.type === "pjax:complete") {
          compatibilityEvents.push({ url: event.detail.url, currentUrl: location.href, domPath });
        }
        return true;
      },
    },
    swup,
    Alpine: window.Alpine,
    SKY_PJAX_CONTAINERS: ["#swup", "#swup-scripts", "#swup-page-extras"],
    URL,
    CustomEvent,
    performance: { now: () => now },
    skyDebug: { event() {}, error() {}, warn() {} },
    replayNewHeadScripts() {},
    createPluginScriptLifecycle({ onLateReady: callback }) {
      onLateReady = callback;
      return window.__skyPluginScriptLifecycle;
    },
    requestAnimationFrame: (fn) => {
      const id = ++nextId;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: setTimer,
    clearTimeout: (id) => timers.delete(id),
  };
  const stateStart = main.indexOf("  const MANAGED_BODY_CLASSES");
  const stateEnd = main.indexOf("  // main.js 作为 defer module", stateStart);
  const lifecycleStart = main.indexOf("  window.__skyPluginScriptLifecycle = createPluginScriptLifecycle({");
  const lifecycleEnd = main.indexOf("\n  });", lifecycleStart);
  const compatibilityStart = main.indexOf("  function dispatchPjaxCompatibilityEvents(");
  const compatibilityEnd = main.indexOf("  function getLightGalleryInlineScripts(", compatibilityStart);
  const resumeStart = main.indexOf("  function _resumeAlpine(");
  const resumeEnd = main.indexOf("\n} else {\n  // PJAX", resumeStart);
  assert.ok(lifecycleStart >= 0 && lifecycleEnd > lifecycleStart, "the production lifecycle callback must exist");
  assert.ok(
    compatibilityStart >= 0 && compatibilityEnd > compatibilityStart,
    "the production event dispatcher must exist",
  );
  runInNewContext(
    `${main.slice(stateStart, stateEnd)}\n${main.slice(lifecycleStart, lifecycleEnd + "\n  });".length)}\n${main.slice(compatibilityStart, compatibilityEnd)}\n${main.slice(resumeStart, resumeEnd)}`,
    context,
  );
  assert.equal(typeof onLateReady, "function", "the fixture must use the production late-readiness callback");

  function changeUrl(value) {
    location.href = new URL(value, location.href).href;
  }

  function begin(path) {
    const visit = {
      state: 1,
      from: { url: new URL(location.href).pathname + new URL(location.href).search },
      to: { url: path, hash: "" },
      history: { action: "push", popstate: false },
      get done() {
        return this.state >= 7;
      },
      abort() {
        this.state = 8;
      },
    };
    swup.navigating = true;
    swup.visit = visit;
    invoke("visit:start", visit);
    visit.state = 3;
    changeUrl(path);
    return visit;
  }

  function replace(visit) {
    visit.state = 6;
    visit.to.document = incomingDocument;
    invoke("content:replace", visit, true);
    domPath = new URL(visit.to.url, location.href).pathname;
    modules = [Object.assign(new EventTarget(), { src: `https://halo.test/assets${domPath}.js` })];
    invoke("content:replace", visit);
    invoke("page:view", visit);
    invoke("visit:end", visit);
    visit.state = 7;
    swup.navigating = false;
    delete visit.to.document;
    return modules[0];
  }

  function abort(visit, { restoreUrl = true } = {}) {
    // Swup emits visit:abort BEFORE it sets ABORTED. Restoring the original URL
    // is a caller precondition for a cancelled visit that retains the old DOM;
    // bare visit.abort() does not restore history or emit this hook in Swup 4.
    if (restoreUrl) changeUrl(visit.from.url);
    invoke("visit:abort", visit);
    visit.state = 8;
    swup.navigating = false;
  }

  async function flush() {
    // visit:abort resumes a retained page on one frame; _resumeAlpine mounts
    // it on the next. Drain those real frame boundaries without firing timers.
    for (let turn = 0; turn < 20; turn += 1) {
      await Promise.resolve();
      if (frames.size === 0) return;
      for (const [id, fn] of [...frames]) {
        if (frames.delete(id)) fn();
      }
      await Promise.resolve();
    }
    assert.fail("navigation fixture did not settle within 20 animation frames");
  }

  function tick(ms) {
    now += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.at > now) continue;
      timers.delete(id);
      timer.fn();
    }
  }

  const oldModule = replace(begin(initialPath));
  return {
    begin,
    replace,
    abort,
    changeUrl,
    flush,
    tick,
    actions,
    compatibilityEvents,
    eventNames,
    pluginWaits,
    oldModule,
    window,
    swup,
    lateReady: () => onLateReady(),
  };
}

for (const event of ["timeout", "error", "load"]) {
  test(`慢资源切页：新 visit 已开始但未替换 DOM 时，旧 ${event} 不干扰新访问`, async () => {
    const f = slowNavigationFixture();
    f.begin("/new");
    if (event === "timeout") f.tick(5000);
    else f.oldModule.dispatchEvent(new Event(event));
    await f.flush();
    assert.deepEqual(f.actions, [], "old page must neither reload nor mount under the new URL");
  });
}

test("慢资源切页：已排队的旧页面 rAF 在新访问开始后不能挂载到新 URL", async () => {
  const f = slowNavigationFixture();
  f.oldModule.dispatchEvent(new Event("load"));
  f.begin("/new");
  await f.flush();
  assert.deepEqual(f.actions, []);
});

test("慢资源切页：旧模块 ready 与迟到 load/error 不能替新页面宣告就绪", async () => {
  const f = slowNavigationFixture();
  const current = f.replace(f.begin("/new"));
  f.window.__completeSwupPageInit({ source: "module" });
  f.oldModule.dispatchEvent(new Event("load"));
  f.oldModule.dispatchEvent(new Event("error"));
  await f.flush();
  assert.deepEqual(f.actions, []);
  current.dispatchEvent(new Event("load"));
  await f.flush();
  assert.deepEqual(f.actions, [{ type: "mount", url: "https://halo.test/new", domPath: "/new" }]);
});

test("慢资源切页：新访问中止并恢复原 URL 后，已完成的旧模块恢复原页面一次", async () => {
  const f = slowNavigationFixture();
  const visit = f.begin("/new");
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  assert.deepEqual(f.actions, [], "do not mount the retained DOM as the pending destination");
  f.abort(visit);
  await f.flush();
  assert.deepEqual(f.actions, [{ type: "mount", url: "https://halo.test/old", domPath: "/old" }]);
});

for (const failure of ["timeout", "error"]) {
  test(`慢资源切页：旧 ${failure} 等到新访问中止且原 URL 恢复后才恢复原页面`, async () => {
    const f = slowNavigationFixture();
    const visit = f.begin("/new");
    if (failure === "timeout") f.tick(5000);
    else f.oldModule.dispatchEvent(new Event("error"));
    await f.flush();
    assert.deepEqual(f.actions, [], "pending navigation must not be replaced by a stale recovery");
    f.abort(visit);
    await f.flush();
    assert.deepEqual(f.actions, [{ type: "reload", url: "https://halo.test/old", domPath: "/old" }]);
  });
}

test("慢资源切页：新访问中止但尚未恢复原 URL 时，不把旧 DOM 标为新页面", async () => {
  const f = slowNavigationFixture();
  const visit = f.begin("/new");
  f.abort(visit, { restoreUrl: false });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  assert.ok(!f.actions.some((action) => action.type === "mount" && action.url === "https://halo.test/new"));
});

test("慢资源切页：中止被取代的访问不能在下一次访问开始后触发旧页面恢复", async () => {
  const f = slowNavigationFixture();
  const superseded = f.begin("/new");
  f.tick(5000);
  assert.deepEqual(f.actions, []);
  // Swup 4 emits abort for the superseded visit, then starts its replacement.
  f.abort(superseded, { restoreUrl: false });
  const latest = f.begin("/latest");
  await f.flush();
  assert.deepEqual(f.actions, []);
  const current = f.replace(latest);
  current.dispatchEvent(new Event("load"));
  await f.flush();
  assert.deepEqual(f.actions, [{ type: "mount", url: "https://halo.test/latest", domPath: "/latest" }]);
});

test("慢资源切页：被暂缓的超时随后收到真实 load，中止新访问后无需重载原页", async () => {
  const f = slowNavigationFixture();
  const visit = f.begin("/new");
  f.tick(5000);
  assert.deepEqual(f.actions, []);
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  assert.deepEqual(f.actions, []);
  f.abort(visit);
  await f.flush();
  assert.deepEqual(f.actions, [{ type: "mount", url: "https://halo.test/old", domPath: "/old" }]);
});

test("慢插件切页：旧页面挂载后的延迟兼容事件等待新访问中止并恢复原 URL，且只派发一次", async () => {
  const f = slowNavigationFixture({ deferPlugins: true });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  assert.deepEqual(f.actions, [{ type: "mount", url: "https://halo.test/old", domPath: "/old" }]);
  assert.equal(f.pluginWaits.length, 1);
  assert.deepEqual(f.compatibilityEvents, []);

  const visit = f.begin("/new");
  f.pluginWaits[0].resolve();
  await f.flush();
  assert.deepEqual(
    f.compatibilityEvents,
    [],
    "old DOM must not receive plugin compatibility events under the pending URL",
  );
  f.abort(visit);
  await f.flush();
  const expected = [{ url: "https://halo.test/old", currentUrl: "https://halo.test/old", domPath: "/old" }];
  assert.deepEqual(f.compatibilityEvents, expected);
  await f.flush();
  assert.deepEqual(
    f.compatibilityEvents,
    expected,
    "resuming the retained page must consume its queued plugin event once",
  );
  assert.equal(f.actions.length, 1, "plugin readiness must not mount the already mounted page again");
});

test("慢插件切页：新访问中止但原 URL 尚未恢复时不派发旧页面兼容事件", async () => {
  const f = slowNavigationFixture({ deferPlugins: true });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  const visit = f.begin("/new");
  f.pluginWaits[0].resolve();
  await f.flush();
  f.abort(visit, { restoreUrl: false });
  await f.flush();
  assert.deepEqual(f.compatibilityEvents, []);
  assert.deepEqual(f.actions, [{ type: "mount", url: "https://halo.test/old", domPath: "/old" }]);
});

for (const resolvedBeforeReplace of [true, false]) {
  test(`慢插件切页：旧插件在新 DOM 替换${resolvedBeforeReplace ? "前" : "后"}完成时丢弃旧事件，保留新页面事件`, async () => {
    const f = slowNavigationFixture({ deferPlugins: true });
    f.oldModule.dispatchEvent(new Event("load"));
    await f.flush();
    const visit = f.begin("/new");
    if (resolvedBeforeReplace) {
      f.pluginWaits[0].resolve();
      await f.flush();
      assert.deepEqual(f.compatibilityEvents, []);
    }
    const current = f.replace(visit);
    current.dispatchEvent(new Event("load"));
    await f.flush();
    assert.equal(f.pluginWaits.length, 2);
    if (!resolvedBeforeReplace) f.pluginWaits[0].resolve();
    await f.flush();
    assert.deepEqual(
      f.compatibilityEvents,
      [],
      "late old-page readiness must neither dispatch nor substitute for the new plugin wait",
    );
    f.pluginWaits[1].resolve();
    await f.flush();
    const expected = [{ url: "https://halo.test/new", currentUrl: "https://halo.test/new", domPath: "/new" }];
    assert.deepEqual(f.compatibilityEvents, expected);
    await f.flush();
    assert.deepEqual(f.compatibilityEvents, expected);
    assert.deepEqual(f.actions, [
      { type: "mount", url: "https://halo.test/old", domPath: "/old" },
      { type: "mount", url: "https://halo.test/new", domPath: "/new" },
    ]);
  });
}

const regularCompatibilityEvents = ["pjax:success", "pjax:complete", "pjax:end", "swup:contentReplaced"];

test("Shiki 晚就绪：常规事件已派发后只补发 pjax:complete，不重建表单或重挂载页面", async () => {
  const f = slowNavigationFixture({ deferPlugins: true });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  f.pluginWaits[0].resolve();
  await f.flush();
  assert.deepEqual(f.eventNames, regularCompatibilityEvents);

  f.lateReady();
  await f.flush();
  assert.deepEqual(f.eventNames, [...regularCompatibilityEvents, "pjax:complete"]);
  assert.deepEqual(f.compatibilityEvents, [
    { url: "https://halo.test/old", currentUrl: "https://halo.test/old", domPath: "/old" },
    { url: "https://halo.test/old", currentUrl: "https://halo.test/old", domPath: "/old" },
  ]);
  assert.equal(f.actions.length, 1, "late plugin readiness must not remount the existing page");
});

test("Shiki 晚就绪：新导航等待时暂存补发，取消并恢复旧 URL 后只派发一次", async () => {
  const f = slowNavigationFixture({ deferPlugins: true });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  f.pluginWaits[0].resolve();
  await f.flush();
  const visit = f.begin("/new");
  f.lateReady();
  await f.flush();
  assert.deepEqual(
    f.eventNames,
    regularCompatibilityEvents,
    "do not send old-page completion under the destination URL",
  );

  f.abort(visit);
  await f.flush();
  assert.deepEqual(f.eventNames, [...regularCompatibilityEvents, "pjax:complete"]);
  assert.deepEqual(f.compatibilityEvents.at(-1), {
    url: "https://halo.test/old",
    currentUrl: "https://halo.test/old",
    domPath: "/old",
  });
  await f.flush();
  assert.equal(f.eventNames.length, 5, "a restored page must consume the queued completion only once");
  assert.equal(f.actions.length, 1);
});

test("Shiki 晚就绪：取消但未恢复旧 URL 时不得向新地址投递旧 DOM 事件", async () => {
  const f = slowNavigationFixture({ deferPlugins: true });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  f.pluginWaits[0].resolve();
  await f.flush();
  const visit = f.begin("/new");
  f.lateReady();
  f.abort(visit, { restoreUrl: false });
  await f.flush();
  assert.deepEqual(f.eventNames, regularCompatibilityEvents);
  assert.equal(f.compatibilityEvents.length, 1);
});

for (const completedBeforeReplace of [true, false]) {
  test(`Shiki 晚就绪：新 DOM 替换${completedBeforeReplace ? "前" : "后"}到达的旧完成信号不得投递到新页面`, async () => {
    const f = slowNavigationFixture({ deferPlugins: true });
    f.oldModule.dispatchEvent(new Event("load"));
    await f.flush();
    f.pluginWaits[0].resolve();
    await f.flush();
    const visit = f.begin("/new");
    if (completedBeforeReplace) f.lateReady();
    const current = f.replace(visit);
    if (!completedBeforeReplace) f.lateReady();
    await f.flush();
    assert.deepEqual(
      f.eventNames,
      regularCompatibilityEvents,
      "discard stale completion while the new page module is pending",
    );

    current.dispatchEvent(new Event("load"));
    await f.flush();
    assert.equal(f.pluginWaits.length, 2);
    assert.deepEqual(f.eventNames, regularCompatibilityEvents);
    f.pluginWaits[1].resolve();
    await f.flush();
    assert.deepEqual(f.eventNames, [...regularCompatibilityEvents, ...regularCompatibilityEvents]);
    assert.deepEqual(f.compatibilityEvents.at(-1), {
      url: "https://halo.test/new",
      currentUrl: "https://halo.test/new",
      domPath: "/new",
    });
  });
}

test("Shiki 晚就绪：已有等待中的全量插件事件时不提前或重复投递", async () => {
  const f = slowNavigationFixture({ deferPlugins: true });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  f.lateReady();
  await f.flush();
  assert.deepEqual(f.eventNames, [], "late recovery must leave the existing full compatibility wait intact");

  f.pluginWaits[0].resolve();
  await f.flush();
  assert.deepEqual(f.eventNames, regularCompatibilityEvents);
  assert.equal(f.compatibilityEvents.length, 1);
  assert.equal(f.actions.length, 1);
});

test("Shiki 晚就绪：已有全量事件因新导航暂存时不能降级为单个事件", async () => {
  const f = slowNavigationFixture({ deferPlugins: true });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  const visit = f.begin("/new");
  f.pluginWaits[0].resolve();
  await f.flush();
  f.lateReady();
  await f.flush();
  assert.deepEqual(f.eventNames, []);

  f.abort(visit);
  await f.flush();
  assert.deepEqual(
    f.eventNames,
    regularCompatibilityEvents,
    "restoration must keep every originally queued plugin event",
  );
  assert.equal(f.compatibilityEvents.length, 1);
  assert.equal(f.actions.length, 1);
});

test("同页查询：Links 挂载同步规范 URL 后兼容事件使用当前 URL 派发一次", async () => {
  const f = slowNavigationFixture({
    deferPlugins: true,
    initialPath: "/links?view=links",
    onMount: ({ window, changeUrl }) => changeUrl(normalizeLinksUrl(window.location.href).url),
  });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  assert.equal(
    f.window.location.href,
    "https://halo.test/links",
    "use the real Links canonical URL normalizer during mount",
  );
  assert.deepEqual(f.compatibilityEvents, []);
  f.pluginWaits[0].resolve();
  await f.flush();
  const expected = [{ url: "https://halo.test/links", currentUrl: "https://halo.test/links", domPath: "/links" }];
  assert.deepEqual(f.compatibilityEvents, expected);
  await f.flush();
  assert.deepEqual(f.compatibilityEvents, expected);
  assert.equal(f.actions.length, 1);
});

test("同页查询：等待插件期间 Links 筛选改变查询参数后使用最新 URL 派发一次", async () => {
  const f = slowNavigationFixture({ deferPlugins: true, initialPath: "/links" });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  f.changeUrl(applyLinksStateToUrl(f.window.location.href, { group: "engineering" }));
  const url = "https://halo.test/links?group=engineering";
  assert.equal(f.window.location.href, url);
  f.pluginWaits[0].resolve();
  await f.flush();
  const expected = [{ url, currentUrl: url, domPath: "/links" }];
  assert.deepEqual(f.compatibilityEvents, expected);
  await f.flush();
  assert.deepEqual(f.compatibilityEvents, expected);
  assert.equal(f.actions.length, 1);
});

test("同页查询：筛选后新 visit 仍阻止旧事件，中止并恢复筛选 URL 后只派发一次", async () => {
  const f = slowNavigationFixture({ deferPlugins: true, initialPath: "/links" });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  f.changeUrl(applyLinksStateToUrl(f.window.location.href, { group: "engineering" }));
  const url = "https://halo.test/links?group=engineering";
  // The same pathname must not make a real pending visit look like a local filter.
  const visit = f.begin("/links?group=another");
  f.pluginWaits[0].resolve();
  await f.flush();
  assert.deepEqual(
    f.compatibilityEvents,
    [],
    "a pending visit owns its destination even when it only differs by query",
  );
  f.abort(visit);
  assert.equal(f.window.location.href, url);
  await f.flush();
  const expected = [{ url, currentUrl: url, domPath: "/links" }];
  assert.deepEqual(f.compatibilityEvents, expected);
  await f.flush();
  assert.deepEqual(f.compatibilityEvents, expected);
  assert.equal(f.actions.length, 1, "restoring the local filter must not remount the retained DOM");
});

test("同页查询：中止恢复时插件尚未就绪，之后改变筛选仍能按最新 URL 派发一次", async () => {
  const f = slowNavigationFixture({ deferPlugins: true, initialPath: "/links?group=engineering" });
  f.oldModule.dispatchEvent(new Event("load"));
  await f.flush();
  const visit = f.begin("/new");
  f.abort(visit);
  await f.flush();
  assert.equal(f.window.location.href, "https://halo.test/links?group=engineering");
  assert.deepEqual(f.compatibilityEvents, [], "cancellation must not declare the still-loading plugin ready");
  f.changeUrl(applyLinksStateToUrl(f.window.location.href, { group: "design" }));
  const url = "https://halo.test/links?group=design";
  assert.equal(f.window.location.href, url);
  f.pluginWaits[0].resolve();
  await f.flush();
  const expected = [{ url, currentUrl: url, domPath: "/links" }];
  assert.deepEqual(f.compatibilityEvents, expected);
  await f.flush();
  assert.deepEqual(f.compatibilityEvents, expected);
  assert.equal(f.actions.length, 1, "cancellation and later filtering must retain the mounted page");
});

const alpine = read("src/common/js/alpine-modules.js");
const shareSource = alpine.slice(
  alpine.indexOf("function createShareModal()"),
  alpine.indexOf("function createCommentDrawer()"),
);
const shareTemplate = read("templates/modules/share-modal.html");

function shareFixture() {
  const context = {};
  runInNewContext(`${shareSource}; globalThis.create = createShareModal`, context);
  const component = context.create();
  const document = { activeElement: null };
  context.document = document;
  const control = (visible = true) => ({
    getClientRects: () => (visible ? [{}] : []),
    closest: () => null,
    focus() {
      document.activeElement = this;
    },
  });
  const first = control();
  const hidden = control(false);
  const last = control();
  const dialog = {
    querySelectorAll: () => [first, hidden, last],
    contains: (node) => [first, last, dialog].includes(node),
    focus() {
      document.activeElement = this;
    },
  };
  component.$refs = { shareDialog: dialog };
  // Execute the actual old inline handlers on the pre-fix copy as well.
  if (!component.focusDialog) component.focusDialog = () => dialog.focus();
  if (!component.trapFocus) {
    const expression = shareTemplate.match(/@keydown.tab="([^"]*)"/)[1].replaceAll("&quot;", '"');
    component.trapFocus = (event) => runInNewContext(expression, { $refs: component.$refs, $event: event, document });
  }
  document.activeElement = dialog;
  return { component, document, first, last, dialog };
}

test("分享弹窗初始焦点进入首个可见控件", () => {
  const { component, document, first } = shareFixture();
  component.focusDialog();
  assert.equal(document.activeElement, first);
});

test("分享弹窗容器自身和首尾控件均能约束正反 Tab", () => {
  const { component, document, first, last, dialog } = shareFixture();
  const send = (shiftKey) => {
    let prevented = false;
    component.trapFocus({
      shiftKey,
      preventDefault() {
        prevented = true;
      },
    });
    return prevented;
  };
  document.activeElement = dialog;
  assert.equal(send(true), true);
  assert.equal(document.activeElement, last);
  assert.equal(send(false), true);
  assert.equal(document.activeElement, first);
  assert.equal(send(true), true);
  assert.equal(document.activeElement, last);
});

test("自定义归档路径能展开对应年份并高亮当前月份", () => {
  const source = read("templates/modules/widgets/archive-sidebar.html").match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
  const expanded = [];
  const classes = new Set();
  const month = {
    href: "https://halo.test/history/2025/08",
    classList: {
      add: (...items) => items.forEach((item) => classes.add(item)),
      remove: (...items) => items.forEach((item) => classes.delete(item)),
    },
  };
  const document = {
    readyState: "complete",
    querySelector: (selector) =>
      selector === ".archive-sidebar-widget"
        ? { dataset: { archivesBase: "/history/" } }
        : selector.includes('[data-year="2025"]')
          ? { _setExpandedState: (_, open) => expanded.push(open) }
          : null,
    querySelectorAll: (selector) => (selector.includes("archive-month-link") ? [month] : []),
  };
  runInNewContext(source, { document, window: { location: { pathname: "/history/2025/08" } }, URL });
  assert.deepEqual(expanded, [true]);
  assert.equal(classes.has("text-primary"), true);
});

function deferredShare() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function shareLifecycleFixture({ overflow = "", share, clipboard } = {}) {
  const ticks = [];
  const timers = new Map();
  const document = { title: "Demo", body: { style: { overflow } }, activeElement: null };
  const window = { location: { origin: "https://halo.test", href: "https://halo.test/docs/demo" } };
  const context = {
    document,
    window,
    navigator: { share, clipboard: { writeText: clipboard || (() => Promise.resolve()) } },
    setTimeout(callback) {
      const id = timers.size + 1;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  runInNewContext(`${shareSource}; globalThis.create = createShareModal`, context);
  const control = () => ({
    isConnected: true,
    getClientRects: () => [{}],
    closest: () => null,
    focus() {
      document.activeElement = this;
    },
  });
  const createComponent = () => {
    const component = context.create();
    const first = control();
    const overlay = {
      open: false,
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
    };
    const link = {
      selected: false,
      focus() {},
      select() {
        this.selected = true;
      },
    };
    component.$el = { dataset: {} };
    component.$refs = {
      shareOverlay: overlay,
      shareLink: link,
      shareDialog: { querySelectorAll: () => [first], focus: first.focus.bind(first) },
    };
    component.$nextTick = (callback) => ticks.push(callback);
    component.init();
    return { component, first, overlay, link };
  };
  const trigger = control();
  document.activeElement = trigger;
  return {
    ...createComponent(),
    createComponent,
    control,
    trigger,
    document,
    window,
    flushTicks() {
      while (ticks.length) ticks.shift()();
    },
  };
}

test("关闭分享统一恢复打开前的滚动样式与触发焦点，重复打开不覆盖入口", () => {
  const fixture = shareLifecycleFixture({ overflow: "auto" });
  const { component, document, trigger } = fixture;
  component.openModal(trigger);
  fixture.flushTicks();
  component.openModal();
  component.closeModal();
  fixture.flushTicks();
  assert.equal(document.body.style.overflow, "auto");
  assert.equal(document.activeElement, trigger);
});

test("原生分享等待真实 Promise 成功后关闭并恢复触发焦点", async () => {
  const pending = deferredShare();
  const fixture = shareLifecycleFixture({ share: () => pending.promise });
  const { component, document, trigger } = fixture;
  component.openModal(trigger);
  fixture.flushTicks();
  fixture.first.focus();
  const operation = component.handleShare("native");
  assert.equal(component.isOpen, true);
  pending.resolve();
  await operation;
  fixture.flushTicks();
  assert.equal(component.isOpen, false);
  assert.equal(document.body.style.overflow, "");
  assert.equal(document.activeElement, trigger);
});

test("取消原生分享时消费拒绝并恢复关闭状态和焦点", async () => {
  const fixture = shareLifecycleFixture({ share: () => Promise.reject(new Error("Share cancelled")) });
  const { component, document, trigger } = fixture;
  component.openModal(trigger);
  fixture.flushTicks();
  fixture.first.focus();
  await component.handleShare("native");
  fixture.flushTicks();
  assert.equal(component.isOpen, false);
  assert.equal(document.activeElement, trigger);
});

test("原生分享同步失败也能关闭并恢复入口", async () => {
  const fixture = shareLifecycleFixture({
    share() {
      throw new Error("Share unavailable");
    },
  });
  const { component, document, trigger } = fixture;
  component.openModal(trigger);
  fixture.first.focus();
  await assert.doesNotReject(async () => component.handleShare("native"));
  fixture.flushTicks();
  assert.equal(component.isOpen, false);
  assert.equal(document.activeElement, trigger);
});

test("关闭后重开时，上一轮原生分享迟到完成不能关闭新一轮弹窗", async () => {
  const pending = deferredShare();
  const fixture = shareLifecycleFixture({ share: () => pending.promise });
  const { component, document } = fixture;
  component.openModal(fixture.trigger);
  fixture.flushTicks();
  const operation = component.handleShare("native");
  component.closeModal();
  component.openModal(fixture.control());
  fixture.flushTicks();
  pending.resolve();
  await operation;
  fixture.flushTicks();
  assert.equal(component.isOpen, true);
  assert.equal(document.body.style.overflow, "hidden");
  assert.equal(document.activeElement, fixture.first);
});

test("分享组件销毁恢复它持有的滚动锁并清理全局旧组件", () => {
  const fixture = shareLifecycleFixture({ overflow: "scroll" });
  const { component, document, window } = fixture;
  component.openModal(fixture.trigger);
  fixture.flushTicks();
  component.destroy?.();
  fixture.flushTicks();
  assert.equal(document.body.style.overflow, "scroll");
  assert.equal(component.isOpen, false);
  assert.equal(window.__shareModal, undefined);
});

test("销毁旧组件及原生分享迟到回调不会解锁或抢焦点到新页面", async () => {
  const pending = deferredShare();
  const fixture = shareLifecycleFixture({ share: () => pending.promise });
  const { component, document } = fixture;
  component.openModal(fixture.trigger);
  fixture.flushTicks();
  const operation = component.handleShare("native");
  component.destroy?.();
  fixture.trigger.isConnected = false;
  const next = fixture.createComponent();
  next.component.openModal(fixture.control());
  fixture.flushTicks();
  pending.resolve();
  await operation;
  fixture.flushTicks();
  assert.equal(next.component.isOpen, true);
  assert.equal(document.body.style.overflow, "hidden");
  assert.equal(document.activeElement, next.first);
});

test("旧组件销毁只释放自己的滚动锁，后来组件关闭仍恢复原样式", () => {
  const fixture = shareLifecycleFixture({ overflow: "auto" });
  fixture.component.openModal(fixture.trigger);
  const next = fixture.createComponent();
  next.component.openModal(fixture.control());
  fixture.component.destroy?.();
  assert.equal(fixture.document.body.style.overflow, "hidden");
  next.component.closeModal();
  fixture.flushTicks();
  assert.equal(fixture.document.body.style.overflow, "auto");
});

test("外部已经改写滚动样式时，销毁分享不覆盖外部状态", () => {
  const fixture = shareLifecycleFixture({ overflow: "auto" });
  fixture.component.openModal(fixture.trigger);
  fixture.document.body.style.overflow = "clip";
  fixture.component.destroy?.();
  assert.equal(fixture.document.body.style.overflow, "clip");
});

test("离页后复制请求迟到完成不会再显示旧组件的复制成功状态", async () => {
  const pending = deferredShare();
  const fixture = shareLifecycleFixture({ clipboard: () => pending.promise });
  fixture.component.openModal(fixture.trigger);
  const operation = fixture.component.copyUrl();
  fixture.component.destroy?.();
  pending.resolve();
  await operation;
  assert.equal(fixture.component.copied, false);
});

test("Alpine 不同事件作用域仍识别同一组件的滚动锁和全局引用", () => {
  const context = {};
  const scopeSource = read("node_modules/alpinejs/src/scope.js").replace(/^export /gm, "");
  runInNewContext(`${scopeSource}; globalThis.merge = mergeProxies`, context);
  const fixture = shareLifecycleFixture({ overflow: "auto" });
  context.merge([{}, fixture.component]).openModal(fixture.trigger);
  context.merge([{}, fixture.component]).closeModal();
  fixture.flushTicks();
  assert.equal(fixture.document.body.style.overflow, "auto");
  context.merge([{}, fixture.component]).destroy();
  assert.equal(fixture.window.__shareModal, undefined);
});

test("普通字符串与 Jackson 文本节点序列化后的平台选择均可识别", () => {
  for (const shareItemIdsConfigured of [undefined, "true"]) {
    for (const shareItemIds of ["wechat,weibo,x,qq", '"wechat","weibo","x","qq"']) {
      const fixture = shareLifecycleFixture();
      Object.assign(fixture.component.$el.dataset, { shareItemIds, shareItemIdsConfigured });
      fixture.component.init();
      assert.deepEqual(
        Array.from(fixture.component.activeShareItems, (item) => item.id),
        ["wechat", "weibo", "x", "qq"],
      );
    }
  }
});

test("明确清空分享平台后仍能复制链接", async () => {
  const copied = [];
  const fixture = shareLifecycleFixture({ clipboard: (url) => copied.push(url) });
  Object.assign(fixture.component.$el.dataset, { shareItemIds: "", shareItemIdsConfigured: "true" });
  fixture.component.init();
  fixture.component.openModal(fixture.trigger);
  assert.deepEqual(Array.from(fixture.component.activeShareItems), []);
  await fixture.component.copyUrl();
  assert.deepEqual(copied, ["https://halo.test/docs/demo"]);
  assert.equal(fixture.component.copied, true);
});

test("缺失分享平台配置时保留默认平台", () => {
  for (const dataset of [{}, { shareItemIds: "", shareItemIdsConfigured: "false" }]) {
    const fixture = shareLifecycleFixture();
    fixture.component.$el.dataset = dataset;
    fixture.component.init();
    assert.deepEqual(
      Array.from(fixture.component.activeShareItems, (item) => item.id),
      Array.from(fixture.component.presetShareItems, (item) => item.id),
    );
  }
});

test("点击覆盖层关闭分享，点击弹窗内部不关闭", () => {
  const overlay = shareTemplate.match(/<div\b(?=[^>]*class="absolute inset-0 flex items-end)[^>]*>/)?.[0];
  assert.ok(overlay, "未找到覆盖遮罩的布局层");
  const directive = overlay.match(/@click((?:\.[\w-]+)*)="([^"]+)"/);
  const alpineSource = read("node_modules/alpinejs/src/utils/on.js")
    .replace(/^import .*$/gm, "")
    .replace("export default function on", "function on")
    .replace(/^export function /gm, "function ");
  const alpine = {};
  runInNewContext(`${alpineSource}; globalThis.on = on`, alpine);

  const fixture = shareLifecycleFixture();
  let listener;
  const layer = {
    addEventListener(_event, callback) {
      listener = callback;
    },
  };
  if (directive) {
    const modifiers = directive[1].split(".").filter(Boolean);
    alpine.on(layer, "click", modifiers, () =>
      runInNewContext(directive[2], { closeModal: () => fixture.component.closeModal() }),
    );
  }
  const click = (target) => listener?.({ type: "click", target });
  fixture.component.openModal(fixture.trigger);
  click(layer);
  assert.equal(fixture.component.isOpen, false, "覆盖层点击应关闭分享");
  fixture.component.openModal(fixture.trigger);
  click({});
  assert.equal(fixture.component.isOpen, true, "弹窗内部点击不能关闭分享");
});

const navbarSource = alpine.slice(
  alpine.indexOf("function createNavbarController()"),
  alpine.indexOf("function createThemeToggle()"),
);
const navbarTemplate = read("templates/modules/nav.html");
const navbarTags = [...navbarTemplate.matchAll(/<([a-z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map((match) => ({
  name: match[1],
  attributes: Object.fromEntries(
    [...match[0].matchAll(/([@:\w.-]+)="([^"]*)"/g)].map((attribute) => [
      attribute[1],
      attribute[2].replaceAll("&amp;", "&").replaceAll("&quot;", '"'),
    ]),
  ),
}));

function navbarFixture() {
  const document = new EventTarget();
  function element(parent, { inert = false } = {}) {
    const item = {
      parentElement: parent,
      children: [],
      style: {},
      visibility: "visible",
      inert,
      tabIndex: 0,
      isConnected: true,
      setAttribute() {},
      removeAttribute() {},
      matches: () => false,
      getClientRects: () => [{}],
      contains(target) {
        return target === this || this.children.some((child) => child.contains(target));
      },
      closest(selector) {
        return selector === "[inert]" ? (this.inert ? this : this.parentElement?.closest(selector)) : null;
      },
      isVisible() {
        return this.visibility !== "hidden" && (!this.parentElement || this.parentElement.isVisible());
      },
      focus() {
        if (!this.closest("[inert]") && this.isVisible()) document.activeElement = this;
      },
      blur() {
        document.activeElement = document.body;
      },
      querySelectorAll() {
        return this.children;
      },
      querySelector() {
        return null;
      },
    };
    parent?.children.push(item);
    return item;
  }
  document.body = element(null);
  document.body.style.overflow = "auto";
  const wrapper = element(document.body);
  const navbar = element(wrapper);
  const drawer = element(navbar);
  drawer.checked = false;
  const content = element(navbar);
  const trigger = element(content);
  const side = element(navbar);
  const backdrop = element(side);
  const panel = element(side, { inert: true });
  const first = element(panel);
  const last = element(panel);
  const background = element(wrapper);
  const protectedBackground = element(wrapper, { inert: true });
  document.activeElement = trigger;
  document.getElementById = (id) => (id === "mobile-menu-drawer" ? drawer : null);
  const media = Object.assign(new EventTarget(), { matches: false });
  const window = Object.assign(new EventTarget(), { matchMedia: () => media });
  let frameId = 0;
  const frames = new Map();
  const flushFrame = () => {
    const ready = [...frames.values()];
    frames.clear();
    ready.forEach((callback) => callback());
  };
  const context = {
    document,
    window,
    AbortController,
    getComputedStyle: (element) => ({ visibility: element.isVisible() ? "visible" : "hidden" }),
    requestAnimationFrame: (callback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  const focusSource = read("src/common/js/modal-focus.js").replace("export function", "function");
  runInNewContext(`${focusSource}; ${navbarSource}; globalThis.create = createNavbarController`, context);
  const component = context.create();
  const triggerTag = navbarTags.find(
    ({ name, attributes }) => name !== "input" && attributes["aria-label"] === "打开移动端菜单",
  );
  const inputTag = navbarTags.find(({ attributes }) => attributes.id === "mobile-menu-drawer");
  const rootTag = navbarTags.find(({ attributes }) => attributes["x-data"] === "navbarController");
  const ticks = [];
  component.$nextTick = (callback) => ticks.push(callback);
  component.$refs = {
    [triggerTag.attributes["x-ref"]]: trigger,
    mobileMenuPanel: panel,
    mobileMenuBackdrop: backdrop,
  };
  component.$el = navbar;
  component.init();
  const evaluate = (expression, scope = component, extras = {}) => {
    assert.ok(expression, "模板缺少交互或状态绑定");
    return runInNewContext(`with (scope) { ${expression} }`, { scope, ...extras });
  };
  return {
    component,
    document,
    drawer,
    trigger,
    triggerTag,
    inputTag,
    rootTag,
    panel,
    backdrop,
    first,
    last,
    background,
    protectedBackground,
    evaluate,
    flushTicks() {
      while (ticks.length) ticks.shift()();
      flushFrame();
    },
    flushFrame,
    pendingFrames: () => frames.size,
    activate: () => evaluate(triggerTag.attributes["@click"]),
    expanded: () => String(evaluate(triggerTag.attributes[":aria-expanded"])),
    modelValue: () => evaluate(inputTag.attributes["x-model"]),
    pageLoad: () => document.dispatchEvent(new Event("sky:page-load")),
    cleanup: () => document.dispatchEvent(new Event("sky:page-cleanup")),
    resize(desktop) {
      media.matches = desktop;
      media.dispatchEvent(new Event("change"));
    },
    key(key, shiftKey = false) {
      const event = Object.assign(new Event("keydown", { cancelable: true }), { key, shiftKey });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    },
  };
}

test("移动菜单使用原生按钮，打开与遮罩关闭共享 checkbox 和展开状态", () => {
  const fixture = navbarFixture();
  const { triggerTag, inputTag } = fixture;
  assert.equal(triggerTag.name, "button", "Enter 和 Space 需要原生按钮激活行为");
  assert.equal(triggerTag.attributes.type, "button");
  assert.equal(inputTag.attributes.tabindex, "-1", "隐藏 checkbox 不能占据键盘焦点");
  assert.ok(
    navbarTags.some(
      ({ name, attributes }) => name === "aside" && attributes.id === triggerTag.attributes["aria-controls"],
    ),
    "按钮应关联实际菜单面板",
  );
  assert.equal(fixture.modelValue(), false);
  assert.equal(fixture.expanded(), "false");
  fixture.activate();
  assert.equal(fixture.modelValue(), true);
  assert.equal(fixture.expanded(), "true");
  const backdrop = navbarTags.find(({ attributes }) => attributes["x-ref"] === "mobileMenuBackdrop");
  fixture.evaluate(backdrop.attributes["@click.prevent"]);
  assert.equal(fixture.expanded(), "false");
  fixture.activate();
  assert.equal(fixture.modelValue(), true);
  assert.equal(fixture.expanded(), "true");
});

test("PJAX 页面切换同时复位移动菜单状态与 checkbox，重开不受旧状态影响", () => {
  const fixture = navbarFixture();
  fixture.component.mobileMenuOpen = true;
  fixture.drawer.checked = true;
  const pageFocus = {};
  fixture.document.activeElement = pageFocus;
  fixture.pageLoad();
  assert.equal(fixture.component.mobileMenuOpen, false, "持久化导航的响应状态必须随 PJAX 一起关闭");
  assert.equal(fixture.drawer.checked, false);
  assert.equal(fixture.expanded(), "false");
  assert.equal(fixture.document.activeElement, pageFocus, "页面切换不能抢回旧导航焦点");
  fixture.activate();
  assert.equal(fixture.modelValue(), true);
  assert.equal(fixture.expanded(), "true");
});

test("移动子菜单先消费 Escape，收起后再次 Escape 关闭抽屉并恢复菜单按钮焦点", () => {
  const fixture = navbarFixture();
  const onSource = read("node_modules/alpinejs/src/utils/on.js")
    .replace(/^import .*$/gm, "")
    .replace("export default function on", "function on")
    .replace(/^export function /gm, "function ");
  const alpineEvents = {};
  runInNewContext(`${onSource}; globalThis.on = on`, alpineEvents);
  const handler = (tag, scope) => {
    const directive = Object.entries(tag.attributes).find(([name]) => name.startsWith("@keydown.escape"));
    assert.ok(directive, "模板应处理 Escape");
    let listener;
    alpineEvents.on(
      { addEventListener: (_name, callback) => (listener = callback) },
      "keydown",
      directive[0].split(".").slice(1),
      (event) => fixture.evaluate(directive[1], scope, { $event: event }),
    );
    return listener;
  };
  const submenuTag = navbarTags.find(
    ({ attributes }) => attributes["x-data"] === "{ open: false }" && !attributes["@click.outside"],
  );
  const submenu = {
    open: true,
    $refs: {
      trigger: {
        focus() {
          fixture.document.activeElement = this;
        },
      },
    },
  };
  const submenuKey = handler(submenuTag, submenu);
  const rootKey = handler(fixture.rootTag, fixture.component);
  const press = (key) => {
    let stopped = false;
    const event = {
      type: "keydown",
      key,
      stopPropagation: () => (stopped = true),
      preventDefault() {},
    };
    submenuKey(event);
    if (!stopped) rootKey(event);
  };
  fixture.component.mobileMenuOpen = true;
  fixture.drawer.checked = true;
  press("Enter");
  assert.equal(submenu.open, true);
  assert.equal(fixture.component.mobileMenuOpen, true);
  press("Escape");
  assert.equal(submenu.open, false);
  assert.equal(fixture.component.mobileMenuOpen, true);
  assert.equal(fixture.document.activeElement, submenu.$refs.trigger);
  press("Escape");
  assert.equal(fixture.component.mobileMenuOpen, false);
  assert.equal(fixture.drawer.checked, false);
  assert.equal(fixture.document.activeElement, fixture.trigger);
});

test("移动菜单将焦点移入面板，正反 Tab 留在菜单，Escape 恢复入口与滚动", () => {
  const f = navbarFixture();
  f.activate();
  f.flushTicks();
  assert.equal(f.document.activeElement, f.first);
  assert.equal(f.document.body.style.overflow, "hidden");
  assert.equal(f.background.inert, true);
  f.last.focus();
  assert.equal(f.key("Tab"), true);
  assert.equal(f.document.activeElement, f.first);
  assert.equal(f.key("Tab", true), true);
  assert.equal(f.document.activeElement, f.last);
  f.key("Escape");
  assert.equal(f.component.mobileMenuOpen, false);
  assert.equal(f.drawer.checked, false);
  assert.equal(f.panel.inert, true);
  assert.equal(f.document.activeElement, f.trigger);
  assert.equal(f.document.body.style.overflow, "auto");
  assert.equal(f.background.inert, false);
  assert.equal(f.protectedBackground.inert, true);
  assert.equal(f.key("Tab"), false);
});

test("移动抽屉过渡阶段仍隐藏时不启动模态，实际可见帧才移入焦点", () => {
  const f = navbarFixture();
  f.panel.visibility = "hidden";
  f.activate();
  f.flushTicks();
  assert.equal(f.document.activeElement, f.trigger);
  assert.equal(f.document.body.style.overflow, "auto");
  assert.equal(f.background.inert, false);
  assert.equal(f.panel.inert, true);
  assert.equal(f.pendingFrames(), 1);
  f.flushFrame();
  assert.equal(f.document.activeElement, f.trigger);
  assert.equal(f.pendingFrames(), 1);
  f.panel.visibility = "visible";
  f.flushFrame();
  assert.equal(f.document.activeElement, f.first);
  assert.equal(f.document.body.style.overflow, "hidden");
  assert.equal(f.background.inert, true);
  assert.equal(f.pendingFrames(), 0);
});

for (const action of ["close", "cleanup", "desktop", "destroy"]) {
  test(`移动抽屉等待可见期间 ${action} 取消迟到聚焦与滚动锁`, () => {
    const f = navbarFixture();
    f.panel.visibility = "hidden";
    f.activate();
    f.flushTicks();
    assert.equal(f.pendingFrames(), 1);
    if (action === "close") f.component.closeMobileMenu();
    else if (action === "cleanup") f.cleanup();
    else if (action === "desktop") f.resize(true);
    else f.component.destroy();
    const nextFocus = {};
    f.document.activeElement = nextFocus;
    f.panel.visibility = "visible";
    f.flushFrame();
    assert.equal(f.component.mobileMenuOpen, false);
    assert.equal(f.pendingFrames(), 0);
    assert.equal(f.document.activeElement, nextFocus);
    assert.equal(f.document.body.style.overflow, "auto");
    assert.equal(f.background.inert, false);
  });
}

test("移动菜单在 nextTick 前关闭并重开时只有新一轮等待可见", () => {
  const f = navbarFixture();
  f.panel.visibility = "hidden";
  f.activate();
  f.component.closeMobileMenu();
  f.activate();
  f.flushTicks();
  assert.equal(f.pendingFrames(), 1);
  f.panel.visibility = "visible";
  f.flushFrame();
  assert.equal(f.document.activeElement, f.first);
  assert.equal(f.pendingFrames(), 0);
});

test("遮罩关闭移动菜单时同时释放焦点与滚动锁", () => {
  const f = navbarFixture();
  f.activate();
  f.flushTicks();
  const backdrop = navbarTags.find(({ attributes }) => attributes["x-ref"] === "mobileMenuBackdrop");
  f.evaluate(backdrop.attributes["@click.prevent"]);
  assert.equal(f.component.mobileMenuOpen, false);
  assert.equal(f.document.activeElement, f.trigger);
  assert.equal(f.document.body.style.overflow, "auto");
  assert.equal(f.background.inert, false);
});

test("PJAX 清理移动菜单不抢回旧入口，迟到打开回调不能重锁页面", () => {
  const f = navbarFixture();
  f.activate();
  f.flushTicks();
  f.cleanup();
  assert.equal(f.component.mobileMenuOpen, false);
  assert.equal(f.document.body.style.overflow, "auto");
  assert.equal(f.background.inert, false);
  assert.notEqual(f.document.activeElement, f.trigger);
  f.activate();
  f.cleanup();
  f.flushTicks();
  f.pageLoad();
  assert.equal(f.panel.inert, true);
  assert.equal(f.document.body.style.overflow, "auto");
  f.activate();
  f.flushTicks();
  assert.equal(f.document.activeElement, f.first, "下一页面仍能正常重开菜单");
});

test("移动菜单切至桌面断点关闭，回到手机可以重开，销毁释放全部状态", () => {
  const f = navbarFixture();
  f.activate();
  f.flushTicks();
  f.resize(true);
  assert.equal(f.component.mobileMenuOpen, false);
  assert.equal(f.document.body.style.overflow, "auto");
  assert.equal(f.background.inert, false);
  assert.notEqual(f.document.activeElement, f.trigger, "桌面断点不聚焦隐藏的手机入口");
  f.activate();
  f.flushTicks();
  assert.equal(f.component.mobileMenuOpen, false);
  f.resize(false);
  f.activate();
  f.flushTicks();
  assert.equal(f.component.mobileMenuOpen, true);
  f.component.destroy();
  assert.equal(f.document.body.style.overflow, "auto");
  assert.equal(f.panel.inert, true);
  assert.equal(f.key("Tab"), false);
  f.resize(true);
});

test("用户菜单 Escape 恢复入口，焦点移出和页面切换关闭菜单", () => {
  const root = navbarTags.find(({ attributes }) => attributes["x-data"] === "{ userMenuOpen: false }");
  let focused = false;
  const scope = {
    userMenuOpen: true,
    $refs: {
      userMenuTrigger: {
        focus() {
          focused = true;
        },
      },
    },
  };
  const inside = {};
  const escape = { stopPropagation() {}, preventDefault() {} };
  const escapeContext = { ...scope, $event: escape };
  runInNewContext(root.attributes["@keydown.escape"], escapeContext);
  assert.equal(focused, true);
  assert.equal(escapeContext.userMenuOpen, false);
  for (const relatedTarget of [inside, null, {}]) {
    const context = { ...scope, $el: { contains: (target) => target === inside }, $event: { relatedTarget } };
    runInNewContext(root.attributes["@focusout"], context);
    assert.equal(context.userMenuOpen, relatedTarget === inside);
  }
  const context = { userMenuOpen: true };
  runInNewContext(root.attributes["@sky:page-load.document"], context);
  assert.equal(context.userMenuOpen, false);
});

test("建站日期为空、非法或在未来时隐藏整条天数，正常日期恢复显示", () => {
  const template = read("templates/modules/footer.html");
  const start = template.indexOf("function calculateSiteDays()");
  const script = template.slice(start, template.indexOf("/**", start));
  class ClockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [2026, 10, 6, 12]));
    }
  }
  for (const date of ["", "bad", "2026-02-30", "2099-01-01", "2026-11-07", "2026-11-06", "2024-02-29"]) {
    const row = {
      style: {
        display: "flex",
        removeProperty(name) {
          delete this[name];
        },
      },
    };
    const days = {};
    runInNewContext(
      `${script.replace("[[${theme.config.footer.brand_settings.site_start_date}]]", date)}; calculateSiteDays()`,
      {
        document: { getElementById: (id) => (id === "site-days" ? row : days) },
        Date: ClockDate,
      },
    );
    const valid = ["2026-11-06", "2024-02-29"].includes(date);
    assert.equal(row.style.display, valid ? undefined : "none", date);
    if (valid) assert.ok(Number.isFinite(days.textContent) && days.textContent >= 0, date);
    else assert.equal(days.textContent, undefined, date);
  }
});

const javaFixtureClasspath = process.env.SKY_UI_JAVA_FIXTURE_CLASSPATH;

test(
  "Thymeleaf 渲染真实 Jackson 和 Map 配置时遵守开关并保留平台",
  { skip: !javaFixtureClasspath && "未提供 SKY_UI_JAVA_FIXTURE_CLASSPATH" },
  async (t) => {
    const docTemplate = read("templates/modules/doc-content.html");
    const button = docTemplate.match(/<button\b(?=[^>]*aria-label="分享文档")[^>]*>/)?.[0];
    const buttonCondition = button?.match(/th:if="([^"]+)"/)?.[1];
    const hostCondition = docTemplate.match(/<th:block th:if="([^"]*enable_share[^"]*)">/)?.[1];
    const idsExpression = docTemplate.match(/shareItemIds=(\$\{[^}]+\})/)?.[1];
    const idsAttribute = shareTemplate.match(/th:data-share-item-ids="([^"]+)"/)?.[1];
    const configuredAttribute = shareTemplate.match(/th:data-share-item-ids-configured="([^"]+)"/)?.[1];
    assert.ok(buttonCondition && hostCondition && idsExpression && idsAttribute, "无法读取真实分享模板表达式");

    // 旧模板没有配置标记；仍渲染旧表达式，使空配置的 RED 来自实际组件行为。
    const configuredMarkup = configuredAttribute ? ` th:data-share-item-ids-configured="${configuredAttribute}"` : "";
    const template = `<html xmlns:th="https://www.thymeleaf.org">
      <button id="trigger" th:if="${buttonCondition}">share</button>
      <th:block th:if="${hostCondition}">
        <div id="host" th:with="shareItemIds=${idsExpression}" th:data-share-item-ids="${idsAttribute}"${configuredMarkup}></div>
      </th:block>
    </html>`;
    const configs = [
      {
        name: "disabled",
        config: { docsme: { doc_settings: { enable_share: false, share_settings: { share_item_ids: ["wechat"] } } } },
      },
      {
        name: "enabled",
        config: {
          docsme: {
            doc_settings: { enable_share: true, share_settings: { share_item_ids: ["wechat", "weibo", "x", "qq"] } },
          },
        },
      },
      {
        name: "default",
        config: { docsme: { doc_settings: { share_settings: { share_item_ids: ["native", "telegram"] } } } },
      },
      { name: "empty", config: { docsme: { doc_settings: { share_settings: { share_item_ids: [] } } } } },
      { name: "null", config: { docsme: { doc_settings: { share_settings: { share_item_ids: null } } } } },
      { name: "missing_ids", config: { docsme: { doc_settings: { share_settings: {} } } } },
      { name: "missing", config: {} },
    ];
    const encoded = (value) => Buffer.from(value).toString("base64");
    const commands = [
      "import org.thymeleaf.spring6.SpringTemplateEngine;",
      "import org.thymeleaf.templateresolver.StringTemplateResolver;",
      "import org.thymeleaf.context.Context;",
      "import com.fasterxml.jackson.databind.ObjectMapper;",
      "import java.util.Base64;",
      "class Theme { public Object config; Theme(Object data) { config = data; } public Object getConfig() { return config; } }",
      "var engine = new SpringTemplateEngine();",
      "engine.setTemplateResolver(new StringTemplateResolver());",
      "var mapper = new ObjectMapper();",
      `String template = new String(Base64.getDecoder().decode("${encoded(template)}"), java.nio.charset.StandardCharsets.UTF_8);`,
    ];
    for (const [index, { name, config }] of configs.entries()) {
      commands.push(
        `String data${index} = new String(Base64.getDecoder().decode("${encoded(JSON.stringify(config))}"), java.nio.charset.StandardCharsets.UTF_8);`,
      );
      for (const [type, method] of [
        ["jackson", `mapper.readTree(data${index})`],
        ["map", `mapper.readValue(data${index}, java.util.Map.class)`],
      ]) {
        commands.push(
          `{ var context = new Context(); context.setVariable("theme", new Theme(${method})); String result = engine.process(template, context); System.out.println("FIXTURE:${type}_${name}:" + Base64.getEncoder().encodeToString(result.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }`,
        );
      }
    }
    commands.push("/exit");
    const result = runJavaFixture(commands, javaFixtureClasspath);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const outputs = new Map(
      [...result.stdout.matchAll(/FIXTURE:([a-z_]+):([A-Za-z0-9+/=]+)/g)].map((match) => [
        match[1],
        Buffer.from(match[2], "base64").toString(),
      ]),
    );
    assert.equal(outputs.size, configs.length * 2, result.stdout + result.stderr);
    for (const type of ["jackson", "map"]) {
      for (const { name } of configs) {
        await t.test(`${type}/${name}`, () => {
          const output = outputs.get(`${type}_${name}`);
          const enabled = name !== "disabled";
          assert.equal(output.includes('id="trigger"'), enabled, `${type}/${name} 分享按钮`);
          assert.equal(output.includes('id="host"'), enabled, `${type}/${name} 分享宿主`);
          if (!enabled) return;
          const ids = output.match(/data-share-item-ids="([^"]*)"/)?.[1].replaceAll("&quot;", '"');
          const configured = output.match(/data-share-item-ids-configured="([^"]*)"/)?.[1];
          const fixture = shareLifecycleFixture();
          Object.assign(fixture.component.$el.dataset, { shareItemIds: ids, shareItemIdsConfigured: configured });
          fixture.component.init();
          const expected =
            name === "enabled"
              ? ["wechat", "weibo", "x", "qq"]
              : name === "default"
                ? ["native", "telegram"]
                : name === "empty"
                  ? []
                  : Array.from(fixture.component.presetShareItems, (item) => item.id);
          assert.deepEqual(
            Array.from(fixture.component.activeShareItems, (item) => item.id),
            expected,
          );
          if (configured !== undefined) {
            assert.equal(configured, String(["enabled", "default", "empty"].includes(name)));
          }
        });
      }
    }
  },
);

test(
  "Thymeleaf 手机菜单头部显示站点信息，并按配置避免空 Logo 和空链接",
  { skip: !javaFixtureClasspath && "未提供 SKY_UI_JAVA_FIXTURE_CLASSPATH" },
  async (t) => {
    const headerStart = navbarTemplate.lastIndexOf("<div", navbarTemplate.indexOf('class="sidebar-header-texture'));
    const headerEnd = navbarTemplate.indexOf("<!-- 统计数据行 -->", headerStart);
    assert.ok(headerStart >= 0 && headerEnd > headerStart, "无法读取真实手机菜单头部");
    // 只替换认证查询边界；显示条件、配置表达式及 Logo fragment 均运行生产模板。
    const header = `${navbarTemplate.slice(headerStart, headerEnd)}</div>`.replace(
      "${contributorFinder.getContributor(#authentication.name)}",
      "${fixtureUser}",
    );
    const logo = (settings = {}) => ({
      nav: {
        logo_settings: {
          logo_type: "none",
          custom_logo_title: "",
          logo_icon: null,
          logo_icon_html: "",
          logo_image: "",
          ...settings,
        },
      },
    });
    const cases = [
      { name: "none", config: logo(), title: "官方站点", subtitle: "官方副标题" },
      {
        name: "custom_title",
        config: logo({ custom_logo_title: "自定义品牌" }),
        title: "自定义品牌",
        subtitle: "官方副标题",
      },
      { name: "missing_nav", config: {}, title: "官方站点", subtitle: "官方副标题" },
      { name: "missing_settings", config: { nav: {} }, title: "官方站点", subtitle: "官方副标题" },
      { name: "system_empty", config: logo({ logo_type: "system" }), title: "官方站点", subtitle: "官方副标题" },
      {
        name: "system_image",
        config: logo({ logo_type: "system" }),
        siteLogo: "/site.svg",
        images: 1,
        title: "官方站点",
        subtitle: "官方副标题",
      },
      { name: "image_empty", config: logo({ logo_type: "image" }), title: "官方站点", subtitle: "官方副标题" },
      {
        name: "image_ready",
        config: logo({ logo_type: "image", logo_image: "/brand.png" }),
        images: 1,
        title: "官方站点",
        subtitle: "官方副标题",
      },
      { name: "svg_empty", config: logo({ logo_type: "svg" }), title: "官方站点", subtitle: "官方副标题" },
      {
        name: "svg_ready",
        config: logo({ logo_type: "svg", logo_icon_html: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>' }),
        svgs: 1,
        title: "官方站点",
        subtitle: "官方副标题",
      },
      { name: "iconify_missing", config: logo({ logo_type: "iconify" }), title: "官方站点", subtitle: "官方副标题" },
      {
        name: "iconify_empty_string",
        config: logo({ logo_type: "iconify", logo_icon: "" }),
        title: "官方站点",
        subtitle: "官方副标题",
      },
      {
        name: "iconify_empty_object",
        config: logo({ logo_type: "iconify", logo_icon: { value: "" } }),
        title: "官方站点",
        subtitle: "官方副标题",
      },
      {
        name: "iconify_svg",
        config: logo({
          logo_type: "iconify",
          logo_icon: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
        }),
        svgs: 1,
        title: "官方站点",
        subtitle: "官方副标题",
      },
      {
        name: "iconify_object",
        config: logo({ logo_type: "iconify", logo_icon: { value: '<span class="icon-[heroicons--star]"></span>' } }),
        glyphs: 1,
        title: "官方站点",
        subtitle: "官方副标题",
      },
      {
        name: "long_subtitle",
        config: logo(),
        siteSubtitle: "12345678901234567890123456789",
        title: "官方站点",
        subtitle: "123456789012345678901...",
      },
      { name: "empty_information", config: logo(), siteTitle: "", siteSubtitle: "", title: "", subtitle: "" },
      { name: "signed_in", config: {}, loggedIn: true, images: 1, title: "登录用户", subtitle: "" },
    ];
    const directory = mkdtempSync(join(tmpdir(), "sky-menu-header-"));
    try {
      mkdirSync(join(directory, "modules"));
      writeFileSync(join(directory, "header.html"), header);
      writeFileSync(join(directory, "modules/logo.html"), read("templates/modules/logo.html"));
      const encoded = (value) => Buffer.from(value).toString("base64");
      const decode = (value) =>
        `new String(Base64.getDecoder().decode("${encoded(value)}"), java.nio.charset.StandardCharsets.UTF_8)`;
      const commands = [
        "import org.thymeleaf.spring6.SpringTemplateEngine;",
        "import org.thymeleaf.templateresolver.FileTemplateResolver;",
        "import org.thymeleaf.context.Context;",
        "import org.thymeleaf.linkbuilder.AbstractLinkBuilder;",
        "import org.thymeleaf.context.IExpressionContext;",
        "import org.thymeleaf.spring6.expression.ThymeleafEvaluationContext;",
        "import org.springframework.context.support.StaticApplicationContext;",
        "import org.springframework.integration.json.JsonPropertyAccessor;",
        "import com.fasterxml.jackson.databind.ObjectMapper;",
        "import org.jsoup.Jsoup;",
        "import java.util.*;",
        "class Theme { public Object config; Theme(Object value) { config = value; } public Object getConfig() { return config; } }",
        "class Site { String title, subtitle, logo; Site(String t, String s, String l) { title=t; subtitle=s; logo=l; } public String getTitle() { return title; } public String getSubtitle() { return subtitle; } public String getLogo() { return logo; } }",
        'class User { boolean loggedIn; User(boolean value) { loggedIn=value; } public String getName() { return loggedIn ? "member" : "anonymousUser"; } public String getDisplayName() { return "登录用户"; } public String getAvatar() { return "/member.png"; } }',
        "var engine = new SpringTemplateEngine();",
        `var resolver = new FileTemplateResolver(); resolver.setPrefix(${decode(`${directory}/`)}); resolver.setSuffix(".html"); engine.setTemplateResolver(resolver);`,
        "engine.setLinkBuilder(new AbstractLinkBuilder() { public String buildLink(IExpressionContext c, String base, Map<String,Object> parameters) { return base; } });",
        "var mapper = new ObjectMapper();",
      ];
      for (const [index, fixture] of cases.entries()) {
        commands.push(`String data${index} = ${decode(JSON.stringify(fixture.config))};`);
        for (const [type, expression] of [
          ["jackson", `mapper.readTree(data${index})`],
          ["map", `mapper.readValue(data${index}, Map.class)`],
        ]) {
          commands.push(`{ var result = new LinkedHashMap<String,Object>(); try {
            var context = new Context(); context.setVariable("theme", new Theme(${expression}));
            context.setVariable("site", new Site(${decode(fixture.siteTitle ?? "官方站点")}, ${decode(fixture.siteSubtitle ?? "官方副标题")}, ${decode(fixture.siteLogo ?? "")}));
            context.setVariable("fixtureUser", new User(${fixture.loggedIn === true}));
            var evaluation = new ThymeleafEvaluationContext(new StaticApplicationContext(), null); evaluation.addPropertyAccessor(new JsonPropertyAccessor());
            context.setVariable(ThymeleafEvaluationContext.THYMELEAF_EVALUATION_CONTEXT_CONTEXT_VARIABLE_NAME, evaluation);
            var root = Jsoup.parse(engine.process("header", context)).selectFirst(".sidebar-header-texture");
            var links = root.select("a");
            result.put("title", String.join(" ", links.stream().map(e -> e.text()).filter(text -> !text.isBlank()).toList()));
            result.put("subtitle", root.select("p").text());
            result.put("links", links.size()); result.put("circles", root.select("a .rounded-full").size());
            result.put("images", root.select("img").size()); result.put("svgs", root.select("svg").size()); result.put("glyphs", root.select("[class*=icon-]").size());
            result.put("emptyLinks", links.stream().filter(e -> e.text().isBlank() && e.attr("aria-label").isBlank() && e.attr("title").isBlank() && e.select("img[alt]").stream().allMatch(img -> img.attr("alt").isBlank())).count());
          } catch (Exception error) { result.put("error", error.toString()); }
          System.out.println("MENU_HEADER:${type}_${fixture.name}:" + Base64.getEncoder().encodeToString(mapper.writeValueAsBytes(result))); }`);
        }
      }
      commands.push("/exit");
      const result = runJavaFixture(commands, javaFixtureClasspath);
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const outputs = new Map(
        [...result.stdout.matchAll(/MENU_HEADER:([a-z_]+):([A-Za-z0-9+/=]+)/g)].map((match) => [
          match[1],
          JSON.parse(Buffer.from(match[2], "base64").toString()),
        ]),
      );
      assert.equal(outputs.size, cases.length * 2, result.stdout + result.stderr);
      for (const type of ["jackson", "map"]) {
        for (const fixture of cases) {
          await t.test(`${type}/${fixture.name}`, () => {
            const output = outputs.get(`${type}_${fixture.name}`);
            assert.equal(output.error, undefined, output.error);
            assert.equal(output.title, fixture.title, "显示官方或定制标题，不能引用不存在的页面变量");
            assert.equal(output.subtitle, fixture.subtitle, "使用官方副标题并保持长度限制");
            const hasLogo = Boolean(fixture.images || fixture.svgs || fixture.glyphs);
            assert.equal(output.links, Number(Boolean(fixture.title)) + Number(hasLogo), "无 Logo 时不留下空链接");
            assert.equal(output.circles, Number(hasLogo), "无 Logo 时不留下空圆框");
            assert.equal(output.images, fixture.images || 0);
            assert.equal(output.svgs, fixture.svgs || 0);
            assert.equal(output.glyphs, fixture.glyphs || 0);
            assert.equal(output.emptyLinks, 0, "所有头部链接都应有可访问名称");
          });
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test("share opens in the browser modal top layer and releases it on close and destroy", () => {
  const f = shareLifecycleFixture();
  f.component.openModal(f.trigger);
  f.flushTicks();
  assert.equal(f.overlay.open, true, "native modalization blocks plugin floating layers and the background");
  f.component.closeModal();
  f.flushTicks();
  assert.equal(f.overlay.open, false);
  f.component.openModal(f.trigger);
  f.flushTicks();
  f.component.destroy();
  assert.equal(f.overlay.open, false);
});

test("clipboard refusal reports recovery, selects the link and a successful retry clears the error", async () => {
  let fail = true;
  const f = shareLifecycleFixture({
    clipboard: () => (fail ? Promise.reject(new Error("denied")) : Promise.resolve()),
  });
  f.component.openModal(f.trigger);
  f.flushTicks();
  await f.component.copyUrl();
  assert.ok(f.component.copyError, "the user must receive a recoverable failure message");
  assert.equal(f.component.copied, false);
  assert.equal(f.link.selected, true);
  fail = false;
  await f.component.copyUrl();
  assert.equal(f.component.copyError, "");
  assert.equal(f.component.copied, true);
});

test("a rejected clipboard request from a closed session cannot change a reopened share", async () => {
  const pending = deferredShare();
  const f = shareLifecycleFixture({ clipboard: () => pending.promise });
  f.component.openModal(f.trigger);
  f.flushTicks();
  const operation = f.component.copyUrl();
  f.component.closeModal();
  f.component.openModal(f.trigger);
  f.flushTicks();
  pending.reject(new Error("late denial"));
  await operation;
  assert.equal(f.component.copyError, "");
  assert.equal(f.link.selected, false);
});

test("an older copy refusal cannot overwrite a newer success in the same share session", async () => {
  const first = deferredShare(),
    second = deferredShare();
  let calls = 0;
  const f = shareLifecycleFixture({ clipboard: () => [first, second][calls++].promise });
  f.component.openModal(f.trigger);
  f.flushTicks();
  const old = f.component.copyUrl(),
    current = f.component.copyUrl();
  second.resolve();
  await current;
  first.reject(new Error("late denial"));
  await old;
  assert.equal(f.component.copied, true);
  assert.equal(f.component.copyError, "");
  assert.equal(f.link.selected, false, "stale failure must not steal focus or select text");
});

const categorySwitchTemplate = read("templates/modules/categories/category-switch.html");
const tagSwitchTemplate = read("templates/modules/tags/tag-switch.html");
for (const style of ["pills", "chips", "underline", "glass"]) {
  const start = tagSwitchTemplate.indexOf(`th:fragment="${style}(tags, currentTag)"`);
  const source = tagSwitchTemplate.slice(start, tagSwitchTemplate.indexOf("\n</div>", start));
  const limit = Number(source.match(/data-visible-limit="(\d+)"/)[1]);
  const initialize = source.match(/x-init="([^"]+)"/)[1].replaceAll("&amp;", "&");
  const showItem = source.match(/x-effect="([^"]+)"/)[1];
  for (const currentIndex of [-1, 0, 20]) {
    test(`${style} 标签条折叠后仍显示当前项 index=${currentIndex}`, () => {
      const items = Array.from({ length: 21 }, (_, index) => ({
        dataset: {},
        style: {},
        getAttribute: (name) => (name === "aria-current" && index === currentIndex ? "page" : null),
      }));
      const context = {
        expanded: false,
        hiddenCount: 0,
        $el: { dataset: { visibleLimit: String(limit) }, querySelectorAll: () => items },
      };
      runInNewContext(initialize, context);
      const visible = () =>
        items.filter(($el) => {
          runInNewContext(showItem, { ...context, $el });
          return $el.style.display !== "none";
        });
      assert.equal(visible().length, limit);
      assert.equal(context.hiddenCount, 21 - limit);
      if (currentIndex >= 0) assert.ok(visible().includes(items[currentIndex]));
      const toggle = source.match(/@click="([^"]+)"/)[1];
      runInNewContext(toggle, context);
      assert.equal(visible().length, 21);
      runInNewContext(toggle, context);
      assert.equal(visible().length, limit);
      if (currentIndex >= 0) assert.ok(visible().includes(items[currentIndex]));
      assert.match(source, /<button type="button"/);
      assert.match(source, /:aria-expanded="expanded"/);
    });
  }
}

for (const style of ["pills", "chips", "underline", "glass"]) {
  const start = categorySwitchTemplate.indexOf(`th:fragment="${style}(categories, currentCategory)"`);
  const source = categorySwitchTemplate.slice(start, categorySwitchTemplate.indexOf("\n</div>", start));
  const limit = Number(source.match(/data-visible-limit="(\d+)"/)[1]);
  const initialize = source.match(/x-init="([^"]+)"/)[1].replaceAll("&amp;", "&");
  const itemStart = categorySwitchTemplate.indexOf(`th:fragment="${style}-items(`);
  const showItem = categorySwitchTemplate.slice(itemStart).match(/x-effect="([^"]+)"/)[1];

  for (const currentIndex of [-1, 0, 20]) {
    test(`${style} 分类条限制实际项数并保留当前分类 index=${currentIndex}`, () => {
      const items = Array.from({ length: 21 }, (_, index) => ({
        dataset: {},
        style: {},
        getAttribute: (name) => (name === "aria-current" && index === currentIndex ? "page" : null),
      }));
      const context = {
        expanded: false,
        hiddenCount: 0,
        $el: { dataset: { visibleLimit: String(limit) }, querySelectorAll: () => items },
      };
      runInNewContext(initialize, context);
      const visible = () =>
        items.filter(($el) => {
          runInNewContext(showItem, { ...context, $el });
          return $el.style.display !== "none";
        });
      assert.equal(visible().length, limit, "a large subtree must not bypass the collapsed limit");
      assert.equal(context.hiddenCount, 21 - limit);
      if (currentIndex >= 0) assert.ok(visible().includes(items[currentIndex]));
      const toggle = source.match(/@click="([^"]+)"/)[1];
      runInNewContext(toggle, context);
      assert.equal(visible().length, 21, "every child is reachable after expansion");
      runInNewContext(toggle, context);
      assert.equal(visible().length, limit);
      if (currentIndex >= 0) assert.ok(visible().includes(items[currentIndex]), "current category survives collapse");
      assert.match(source, /<button type="button"/);
      assert.match(source, /:aria-expanded="expanded"/);
      assert.match(source, /:aria-label=/);
    });
  }

  test(`${style} 分类条没有溢出时不提供无效展开入口`, () => {
    const items = Array.from({ length: 3 }, () => ({ dataset: {}, style: {}, getAttribute: () => null }));
    const context = {
      expanded: false,
      hiddenCount: 0,
      $el: { dataset: { visibleLimit: String(limit) }, querySelectorAll: () => items },
    };
    runInNewContext(initialize, context);
    assert.equal(context.hiddenCount, 0);
    assert.ok(
      items.every(($el) => {
        runInNewContext(showItem, { ...context, $el });
        return $el.style.display !== "none";
      }),
    );
    assert.equal(runInNewContext(source.match(/<button[^>]*x-show="([^"]+)"/)[1], context), false);
  });
}

test("an older copy success cannot erase a newer refusal", async () => {
  const first = deferredShare(),
    second = deferredShare();
  let calls = 0;
  const f = shareLifecycleFixture({ clipboard: () => [first, second][calls++].promise });
  f.component.openModal(f.trigger);
  f.flushTicks();
  const old = f.component.copyUrl(),
    current = f.component.copyUrl();
  second.reject(new Error("current denial"));
  await current;
  const error = f.component.copyError;
  first.resolve();
  await old;
  assert.equal(f.component.copied, false);
  assert.equal(f.component.copyError, error);
});
