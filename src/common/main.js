/**
 * Sky Blog Theme - 主应用入口文件
 *
 * 功能：统一管理所有CSS和JS资源的导入和初始化
 * 职责：
 *   1. 导入所有公共样式文件
 *   2. 导入Alpine.js及其组件
 *   3. 初始化全局工具函数
 *   4. 启动Alpine.js响应式系统
 *   5. 初始化 swup PJAX（页面无刷新切换）
 *
 * 构建产物：templates/assets/js/main.js + templates/assets/css/main.css
 *
 * @author Sky
 * @version 1.0.0
 */

/* ===================================================
 * 样式文件导入
 * 按加载顺序排列，确保样式优先级正确
 * ==================================================*/
import "./css/tailwind.css"; // Tailwind CSS 4 + DaisyUI 5 配置
import "./css/nav-enhancements.css"; // 导航栏增强样式
import "./css/base.css"; // 全局基础样式和变量
import "./css/floating-dock.css"; // 悬浮控制栏样式
import "./css/loading-screen.css"; // 页面加载屏幕
import "./css/toc.css"; // TOC 目录导航公共样式

/* ===================================================
 * 脚本文件导入
 * ==================================================*/
import "./js/base.js"; // 全局工具函数和事件处理
import { skyDebug } from "./js/debug.js";

/* ===================================================
 * Alpine.js 响应式框架
 * ==================================================*/
import { initializeAll } from "./js/alpine-modules.js"; // Alpine组件注册
import Alpine from "alpinejs"; // Alpine核心

// 挂载Alpine到全局对象，供模板使用
window.Alpine = Alpine;

/**
 * Alpine.js 初始化钩子
 * 在Alpine启动前注册所有组件
 */
document.addEventListener("alpine:init", () => {
  initializeAll();
});

// 启动Alpine响应式系统
Alpine.start();

/* ===================================================
 * Swup PJAX — 页面无刷新切换
 * 受 theme-script.html 中 window.__skyPjaxEnabled 控制
 * ==================================================*/
import Swup from "swup";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupScriptsPlugin from "@swup/scripts-plugin";

function isRouteOrDescendant(url, route) {
  try {
    const resolved = new URL(url, window.location.href);
    return (
      resolved.origin === window.location.origin &&
      (resolved.pathname === route || resolved.pathname.startsWith(`${route}/`))
    );
  } catch {
    return false;
  }
}

if (window.__skyPjaxEnabled !== false) {
  const SKY_PJAX_CONTAINERS = ["#swup", "#swup-scripts", "#swup-page-extras"];
  const swup = new Swup({
    containers: SKY_PJAX_CONTAINERS,
    // Only wait for the dedicated PJAX containers. The default selector
    // (`[class*="transition-"]`) matches decorative homepage animations
    // like the typewriter subtitle and can stall navigation for seconds.
    animationSelector: "#swup, .transition-fade",
    requestHeaders: {},
    ignoreVisit: (url, { el } = {}) => {
      return (
        Boolean(el?.closest("[data-no-swup]")) ||
        isRouteOrDescendant(url, "/login") ||
        isRouteOrDescendant(url, "/signup") ||
        isRouteOrDescendant(url, "/uc") ||
        isRouteOrDescendant(url, "/console") ||
        isRouteOrDescendant(url, "/logout") ||
        isRouteOrDescendant(url, "/dishes") ||
        isRouteOrDescendant(url, "/schedule-calendar")
      );
    },
    plugins: [new SwupHeadPlugin(), new SwupScriptsPlugin({ head: false, body: true, optin: true })],
  });

  window.__swup = swup;

  const MANAGED_BODY_CLASSES = ["text-base-content", "flex", "flex-col", "bg-base-100", "bg-base-200", "bg-base-300"];
  let navigationId = 0;
  let pageGeneration = 0;
  const visitDebugState = new WeakMap();
  const debugPath = (value) => {
    try {
      const url = new URL(value || window.location.href, window.location.href);
      return url.pathname;
    } catch {
      return String(value || "");
    }
  };
  const getVisitDebug = (visit) => {
    if (!visit || typeof visit !== "object") {
      return { id: 0, startedAt: performance.now(), from: debugPath(), to: debugPath() };
    }
    let state = visitDebugState.get(visit);
    if (!state) {
      state = {
        id: ++navigationId,
        startedAt: performance.now(),
        from: debugPath(visit.from?.url),
        to: debugPath(visit.to?.url),
      };
      visitDebugState.set(visit, state);
    }
    return state;
  };
  const finishVisitDebug = (visit, event) => {
    const state = getVisitDebug(visit);
    skyDebug.event("pjax", event, {
      id: state.id,
      from: state.from,
      to: state.to,
      durationMs: Math.round(performance.now() - state.startedAt),
    });
  };

  swup.hooks.on("visit:start", (visit) => {
    const state = getVisitDebug(visit);
    skyDebug.event("pjax", "visit:start", {
      id: state.id,
      from: state.from,
      to: state.to,
      history: visit.history?.action || "push",
    });
  });
  swup.hooks.on("page:view", (visit) => finishVisitDebug(visit, "page:view"));
  swup.hooks.on("visit:end", (visit) => finishVisitDebug(visit, "visit:end"));
  swup.hooks.on("visit:abort", (visit) => finishVisitDebug(visit, "visit:abort"));
  swup.hooks.on("fetch:error", (visit, detail) => {
    const state = getVisitDebug(visit);
    skyDebug.error("pjax", "fetch:error", { id: state.id, path: debugPath(detail.url), status: detail.status });
  });
  swup.hooks.on("fetch:timeout", (visit, detail) => {
    const state = getVisitDebug(visit);
    skyDebug.warn("pjax", "fetch:timeout", { id: state.id, path: debugPath(detail.url) });
  });
  skyDebug.event("pjax", "init", { containers: SKY_PJAX_CONTAINERS.length });

  // 是否已收到页面就绪信号（内联脚本同步执行时设置）
  let _currentSignaled = false;

  /**
   * 内联脚本信号入口（friends 等无独立页面 JS 的页面使用）。
   * module JS 内 notifySwupPageReady() 也调用此函数，但 load 事件才是主要触发源。
   */
  window.__completeSwupPageInit = (detail = {}) => {
    const source = detail.source || "inline";
    if (source === "inline") _currentSignaled = true;
    skyDebug.event("pjax", "page:ready-signal", { source });
  };

  // main.js 作为 defer module 执行时，首屏中位于 halo:footer 的插件脚本已经运行。
  // 先登记这些脚本，避免第一次 PJAX 切页时把常驻插件核心重复执行一遍。
  window.__skyLoadedPluginScripts =
    window.__skyLoadedPluginScripts ||
    new Set(
      Array.from(document.querySelectorAll("script[data-pjax][src], script.pjax[src]"))
        .map((script) => script.src)
        .filter(Boolean),
    );
  window.__skyLoadingPluginScripts = window.__skyLoadingPluginScripts || new Set();
  // HeadPlugin 会同步 head 标签，但浏览器不会执行通过 DOM 替换插入的外部脚本。
  // 记录首屏已由浏览器执行的脚本；后续只重放 PJAX 首次引入或版本 URL 变化的脚本。
  window.__skyLoadedHeadScripts =
    window.__skyLoadedHeadScripts ||
    new Set(
      Array.from(document.head.querySelectorAll("script[src]"))
        .map((script) => script.src)
        .filter(Boolean),
    );
  window.__skyLoadingHeadScripts = window.__skyLoadingHeadScripts || new Set();

  function replayNewHeadScripts(debugState) {
    const loadedHeadScripts = window.__skyLoadedHeadScripts;
    const loadingHeadScripts = window.__skyLoadingHeadScripts;
    const candidates = Array.from(document.head.querySelectorAll("script[src]")).filter(
      (script) =>
        !script.hasAttribute("data-swup-ignore-script") &&
        !loadedHeadScripts.has(script.src) &&
        !loadingHeadScripts.has(script.src),
    );

    skyDebug.event("pjax", "head-script:scan", { id: debugState.id, count: candidates.length });
    candidates.forEach((script) => {
      const source = script.src;
      loadingHeadScripts.add(source);
      const replacement = document.createElement("script");
      Array.from(script.attributes).forEach((attr) => replacement.setAttribute(attr.name, attr.value));
      replacement.async = script.hasAttribute("async");
      replacement.textContent = script.textContent;
      replacement.addEventListener(
        "load",
        () => {
          loadingHeadScripts.delete(source);
          loadedHeadScripts.add(source);
          skyDebug.event("pjax", "head-script:load", { id: debugState.id, path: debugPath(source) });
        },
        { once: true },
      );
      replacement.addEventListener(
        "error",
        () => {
          loadingHeadScripts.delete(source);
          loadedHeadScripts.delete(source);
          skyDebug.error("pjax", "head-script:error", { id: debugState.id, path: debugPath(source) });
        },
        { once: true },
      );
      script.replaceWith(replacement);
    });
  }

  function dispatchPjaxCompatibilityEvents(detail) {
    ["pjax:success", "pjax:complete", "pjax:end", "swup:contentReplaced"].forEach((name) => {
      document.dispatchEvent(
        new CustomEvent(name, {
          detail,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  }

  function getLightGalleryInlineScripts(includeExecuted = false) {
    return Array.from(document.querySelectorAll("script:not([src])")).filter((script) => {
      const code = script.textContent || "";
      return (
        code.includes("lightGallery(") &&
        code.includes("DOMContentLoaded") &&
        (includeExecuted || script.getAttribute("data-sky-lightgallery-inline-executed") !== "true")
      );
    });
  }

  function hasLightGalleryPluginMarkup() {
    return Boolean(
      document.querySelector('script[src*="/plugins/PluginLightGallery/assets/static/js/"]') ||
      getLightGalleryInlineScripts(true).length > 0,
    );
  }

  function runLightGalleryInlineScripts() {
    const scripts = getLightGalleryInlineScripts();
    if (scripts.length === 0) return getLightGalleryInlineScripts(true).length > 0;

    scripts.forEach((script) => {
      script.setAttribute("data-sky-lightgallery-inline-executed", "true");
      const runner = document.createElement("script");
      runner.textContent = `
        (function () {
          var originalAddEventListener = document.addEventListener;
          document.addEventListener = function (type, listener, options) {
            if (type === 'DOMContentLoaded' && typeof listener === 'function') {
              listener.call(document, new Event('DOMContentLoaded'));
              return undefined;
            }
            return originalAddEventListener.call(this, type, listener, options);
          };
          try {
            ${script.textContent || ""}
          } finally {
            document.addEventListener = originalAddEventListener;
          }
        })();
      `;
      document.head.appendChild(runner);
      runner.remove();
    });

    return true;
  }

  function loadLightGalleryScript(src) {
    if (!src) return Promise.resolve();
    window.__skyLightGalleryLoadedScripts = window.__skyLightGalleryLoadedScripts || new Set();
    if (window.__skyLightGalleryLoadedScripts.has(src)) return Promise.resolve();

    return new Promise((resolve) => {
      const staleScript = Array.from(document.querySelectorAll("script[src]")).find(
        (script) => script.src === src && script.getAttribute("data-sky-lightgallery-executed") !== "true",
      );
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.setAttribute("data-sky-lightgallery-executed", "true");
      script.onload = () => {
        window.__skyLightGalleryLoadedScripts.add(src);
        skyDebug.event("lightgallery", "script:load", { path: debugPath(src) });
        resolve();
      };
      script.onerror = () => {
        skyDebug.error("lightgallery", "script:error", { path: debugPath(src) });
        resolve();
      };
      if (staleScript?.parentNode) {
        staleScript.parentNode.replaceChild(script, staleScript);
      } else {
        document.head.appendChild(script);
      }
    });
  }

  function ensureLightGalleryReady() {
    if (typeof window.lightGallery === "function") return Promise.resolve(true);
    if (window.__skyLightGalleryReadyPromise) return window.__skyLightGalleryReadyPromise;

    const scripts = Array.from(
      document.querySelectorAll('script[src*="/plugins/PluginLightGallery/assets/static/js/"]'),
    )
      .map((script) => script.src)
      .filter(Boolean)
      .sort((a, b) => {
        const aCore = a.includes("/lightgallery.min.js") || a.includes("/lightgallery.js");
        const bCore = b.includes("/lightgallery.min.js") || b.includes("/lightgallery.js");
        if (aCore === bCore) return 0;
        return aCore ? -1 : 1;
      });

    if (scripts.length === 0) return Promise.resolve(false);

    window.__skyLightGalleryReadyPromise = scripts
      .reduce((chain, src) => chain.then(() => loadLightGalleryScript(src)), Promise.resolve())
      .then(() => typeof window.lightGallery === "function")
      .finally(() => {
        window.__skyLightGalleryReadyPromise = null;
      });

    return window.__skyLightGalleryReadyPromise;
  }

  let lightGalleryInitToken = 0;

  function scheduleLightGalleryPjaxInit() {
    const token = ++lightGalleryInitToken;
    let attempts = 0;

    skyDebug.event("lightgallery", "init:scheduled", { token });

    const run = () => {
      if (token !== lightGalleryInitToken) return;
      if (!hasLightGalleryPluginMarkup()) return;

      attempts += 1;
      ensureLightGalleryReady().then((ready) => {
        if (token !== lightGalleryInitToken) return;
        if (ready && runLightGalleryInlineScripts()) {
          skyDebug.event("lightgallery", "init:complete", { token, attempts });
          return;
        }
        if (attempts < 50) window.setTimeout(run, 100);
        else skyDebug.warn("lightgallery", "init:timeout", { token, attempts });
      });
    };

    requestAnimationFrame(run);
  }

  window.SkyLightGallery = {
    init: scheduleLightGalleryPjaxInit,
    initNow: () => ensureLightGalleryReady().then((ready) => ready && runLightGalleryInlineScripts()),
  };

  document.addEventListener("sky:page-load", (event) => {
    if (event.detail?.pjax) scheduleLightGalleryPjaxInit();
  });

  /** Alpine 恢复动作，rAF 后执行确保 DOM paint 完成 */
  function _resumeAlpine(reason, expectedGeneration) {
    requestAnimationFrame(() => {
      if (expectedGeneration !== pageGeneration) {
        skyDebug.event("pjax", "alpine:resume-skip", {
          reason,
          expectedGeneration,
          currentGeneration: pageGeneration,
        });
        return;
      }
      const mode = window.Alpine?.flushAndStopDeferringMutations ? "flush" : "init-tree";
      if (window.Alpine?.flushAndStopDeferringMutations) {
        Alpine.flushAndStopDeferringMutations();
      } else if (window.Alpine) {
        SKY_PJAX_CONTAINERS.forEach((selector) => {
          const container = document.querySelector(selector);
          if (container) Alpine.initTree(container);
        });
      }
      window.SkyEvents?.onPageLoad();
      const pageDetail = { initial: false, pjax: true, url: window.location.href };
      window.SkyPjax?._runPage?.(pageDetail);
      dispatchPjaxCompatibilityEvents(pageDetail);
      skyDebug.event("pjax", "alpine:resume", { reason, mode, path: debugPath() });
    });
  }

  // ① DOM 替换前：重置状态，暂停 Alpine MutationObserver，销毁旧页面组件树
  swup.hooks.before(
    "content:replace",
    (visit) => {
      const debugState = getVisitDebug(visit);
      const incomingDocument = visit.to.document;
      const missingSelectors = SKY_PJAX_CONTAINERS.filter((selector) => !incomingDocument?.querySelector(selector));
      const supportsSkyPjax = missingSelectors.length === 0;
      skyDebug.event("pjax", "content:replace:before", {
        id: debugState.id,
        to: debugState.to,
        supportsSkyPjax,
        missingSelectors,
      });
      if (!supportsSkyPjax) {
        // 404、维护页和插件独立响应没有主题容器，必须在清理旧页面之前退出 PJAX。
        // Swup 此时已写入目标历史记录。先退回上一条正常文档，再整页打开目标，
        // 避免浏览器“返回”时只恢复 URL、却仍保留 404 / 插件独立页面的文档。
        const target = visit.to.url + (visit.to.hash || "");
        pageGeneration += 1;
        skyDebug.event("pjax", "full-reload:fallback", {
          id: debugState.id,
          target: debugPath(target),
          reason: "missing-pjax-containers",
        });
        visit.abort();
        swup.options.skipPopStateHandling = () => {
          window.location.assign(target);
          return true;
        };
        window.history.back();
        return undefined;
      }

      debugState.generation = ++pageGeneration;
      window.SkyEvents?.cleanupPageObservers?.();

      // body 不在 Swup 容器内；只同步主题拥有的页面类，保留插件或运行时追加的未知类。
      const incomingBody = incomingDocument.body;
      const changedBodyClasses = [];
      MANAGED_BODY_CLASSES.forEach((className) => {
        const enabled = incomingBody.classList.contains(className);
        if (document.body.classList.contains(className) !== enabled) changedBodyClasses.push(className);
        document.body.classList.toggle(className, enabled);
      });
      if (changedBodyClasses.length > 0) {
        skyDebug.event("pjax", "body:class-sync", { id: debugState.id, classes: changedBodyClasses });
      }

      window.SkyPjax?._cleanup?.({ pjax: true, url: window.location.href });
      skyDebug.event("pjax", "page:cleanup", { id: debugState.id, path: debugPath() });
      if (typeof window.__skyMusicSave === "function") window.__skyMusicSave();
      if (typeof window.__pageCleanup === "function") {
        window.__pageCleanup();
        window.__pageCleanup = null;
      }

      _currentSignaled = false;
      if (window.Alpine?.deferMutations) Alpine.deferMutations();
      if (window.Alpine) {
        SKY_PJAX_CONTAINERS.forEach((selector) => {
          const container = document.querySelector(selector);
          if (container) Alpine.destroyTree(container);
        });
      }
      skyDebug.event("pjax", "alpine:destroy", { id: debugState.id, containers: SKY_PJAX_CONTAINERS.length });
      return undefined;
    },
    { priority: -100 },
  );

  // ② DOM 替换后（ScriptsPlugin 已注入新脚本）
  //
  //  【信号机制】使用 script.load 事件而非 notifySwupPageReady() 作为主触发：
  //    - 首次导航（模块未缓存）：下载 → 执行（Alpine.data 注册完）→ load 触发 ✅
  //    - 再次导航（模块已缓存）：ES 模块不重新执行，但 Alpine.data 已在首次执行时
  //      注册并持久存在 → load 事件仍快速触发 ✅
  //    - 内联脚本页面（friends 等）：同步执行已置 _currentSignaled=true → 快速路径 ✅
  //
  //  【不阻塞 swup】handler 不返回 Promise → swup 立即继续 content:scroll / page:view
  swup.hooks.on("content:replace", (visit) => {
    const debugState = getVisitDebug(visit);
    const expectedGeneration = debugState.generation || pageGeneration;
    replayNewHeadScripts(debugState);
    // 只重放当前页面明确声明支持 PJAX 的脚本。
    // 兼容两类标记：
    //  - data-pjax：主题内约定
    //  - .pjax：Halo / 插件常见约定（后端传递的普通脚本常见是这个）
    //
    // halo:footer 注入区保持常驻，避免全局脚本生成的 DOM 在切页时被替换掉。
    const pjaxScripts = document.querySelectorAll("script[data-pjax], script.pjax");
    skyDebug.event("pjax", "script:scan", { id: debugState.id, count: pjaxScripts.length });
    const loadedPluginScripts = window.__skyLoadedPluginScripts;
    const loadingPluginScripts = window.__skyLoadingPluginScripts;
    pjaxScripts.forEach((script) => {
      // 避免重复加载已执行过的脚本源（主要针对外部 js，如 comment-widget 的全局核心代码）
      // 对于内联 script（无 src），每次都执行以初始化组件
      if (script.src) {
        if (loadedPluginScripts.has(script.src) || loadingPluginScripts.has(script.src)) {
          skyDebug.event("pjax", "script:skip", { id: debugState.id, path: debugPath(script.src) });
          return;
        }
        loadingPluginScripts.add(script.src);
      }
      const newScript = document.createElement("script");
      Array.from(script.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = script.textContent;
      if (script.src) {
        const source = script.src;
        newScript.addEventListener(
          "load",
          () => {
            loadingPluginScripts.delete(source);
            loadedPluginScripts.add(source);
            skyDebug.event("pjax", "script:load", { id: debugState.id, path: debugPath(source) });
          },
          { once: true },
        );
        newScript.addEventListener(
          "error",
          () => {
            loadingPluginScripts.delete(source);
            loadedPluginScripts.delete(source);
            skyDebug.error("pjax", "script:error", { id: debugState.id, path: debugPath(source) });
          },
          { once: true },
        );
      }
      script.parentNode.replaceChild(newScript, script);
    });
    // 快速路径：内联脚本同步执行已发信号
    if (_currentSignaled) {
      _resumeAlpine("inline-signal", expectedGeneration);
      return;
    }

    // 找到 ScriptsPlugin 刚注入的 type="module" 脚本
    const swupScriptsEl = document.getElementById("swup-scripts");
    const moduleScripts = swupScriptsEl ? Array.from(swupScriptsEl.querySelectorAll('script[type="module"][src]')) : [];

    if (moduleScripts.length === 0) {
      // 无 module 脚本且未收到内联信号（不应发生，兜底保护）
      setTimeout(() => _resumeAlpine("no-module-fallback", expectedGeneration), 100);
      return;
    }

    // 监听所有 module 脚本的 load/error 事件，全部 settled 后恢复 Alpine
    let resumed = false;
    let fallbackTimer = null;
    function tryResume(reason) {
      if (!resumed) {
        resumed = true;
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
        _resumeAlpine(reason, expectedGeneration);
      }
    }

    let pending = moduleScripts.length;
    moduleScripts.forEach((script) => {
      const settle = (event) => {
        const log = event.type === "error" ? skyDebug.error : skyDebug.event;
        log("pjax", `module:${event.type}`, {
          id: debugState.id,
          path: debugPath(script.src),
        });
        if (--pending <= 0) tryResume("module-settled");
      };
      script.addEventListener("load", settle, { once: true });
      script.addEventListener("error", settle, { once: true });
    });

    // 5s 安全兜底（网络极慢 / load 事件未触发等极端情况）
    fallbackTimer = window.setTimeout(() => {
      skyDebug.warn("pjax", "module:timeout", { id: debugState.id, pending });
      tryResume("module-timeout");
    }, 5000);

    // 不显式 return Promise → swup 立即继续，不阻塞导航管线
  });
} else {
  // PJAX 已关闭 — 设置 noop 桩，防止页面 JS 调用报错
  window.__swup = null;
  window.__completeSwupPageInit = () => {};
  skyDebug.event("pjax", "disabled", { path: window.location.pathname });
}

const notifyInitialSkyPjaxPage = () => {
  window.SkyPjax?._runPage?.({ initial: true, pjax: false, url: window.location.href });
  skyDebug.event("page", "initial:mount", { path: window.location.pathname });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", notifyInitialSkyPjaxPage, { once: true });
} else {
  queueMicrotask(notifyInitialSkyPjaxPage);
}
