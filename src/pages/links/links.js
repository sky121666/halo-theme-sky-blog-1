/**
 * 友情链接页脚本
 * 模板位置：templates/links.html
 */
import "./links.css";
import { skyDebug } from "../../common/js/debug.js";
import { notifySwupPageReady, registerPageLifecycle } from "../../common/js/page-runtime.js";

const LINK_SUBMIT_SCRIPT_PATH = "/plugins/link-submit/assets/static/link-submit-widget.iife.js";
const LINK_SUBMIT_STYLE_PATH = "/plugins/link-submit/assets/static/var.css";
const LINK_SUBMIT_LOAD_TIMEOUT = 8000;

function isLinkSubmitWidgetReady() {
  return typeof window.LinkSubmitWidget?.open === "function";
}

function resolvePluginAsset(value, expectedPath) {
  const url = new URL(value || expectedPath, window.location.origin);
  if (url.origin !== window.location.origin || url.pathname !== expectedPath) {
    throw new Error(`Unexpected Link Submit asset: ${url.href}`);
  }
  return url;
}

function findPluginAsset(selector, expectedPath) {
  return Array.from(document.querySelectorAll(selector)).find((element) => {
    const source = element.src || element.href;
    if (!source) return false;
    try {
      return new URL(source, window.location.href).pathname === expectedPath;
    } catch {
      return false;
    }
  });
}

function waitForLinkSubmitStylesheet(link) {
  if (link.sheet) return Promise.resolve(link);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutTimer);
      link.removeEventListener("load", handleLoad);
      link.removeEventListener("error", handleError);
      if (error) {
        link.remove();
        reject(error);
      } else {
        link.dataset.skyLinkSubmitLoaded = "true";
        resolve(link);
      }
    };
    const handleLoad = () => finish();
    const handleError = () => finish(new Error(`Unable to load ${link.href}`));
    const timeoutTimer = window.setTimeout(
      () => finish(new Error("Timed out waiting for Link Submit stylesheet")),
      LINK_SUBMIT_LOAD_TIMEOUT,
    );

    link.addEventListener("load", handleLoad, { once: true });
    link.addEventListener("error", handleError, { once: true });
    if (link.sheet) finish();
  });
}

function ensureLinkSubmitStylesheet(styleUrl) {
  const existing = findPluginAsset('link[rel="stylesheet"][href]', LINK_SUBMIT_STYLE_PATH);
  if (existing) return waitForLinkSubmitStylesheet(existing);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = styleUrl.href;
  link.dataset.skyLinkSubmitResource = "style";
  const ready = waitForLinkSubmitStylesheet(link);
  document.head.appendChild(link);
  return ready;
}

function waitForLinkSubmitWidget(script) {
  return new Promise((resolve, reject) => {
    if (isLinkSubmitWidgetReady()) {
      resolve(window.LinkSubmitWidget);
      return;
    }

    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      if (error) reject(error);
      else resolve(window.LinkSubmitWidget);
    };
    const checkReady = () => {
      if (isLinkSubmitWidgetReady()) finish();
    };
    const handleLoad = () => {
      script.dataset.skyLinkSubmitLoaded = "true";
      checkReady();
      if (!isLinkSubmitWidgetReady()) {
        finish(new Error("Link Submit script loaded without LinkSubmitWidget.open()"));
      }
    };
    const handleError = () => finish(new Error(`Unable to load ${script.src}`));
    const pollTimer = window.setInterval(checkReady, 50);
    const timeoutTimer = window.setTimeout(
      () => finish(new Error("Timed out waiting for LinkSubmitWidget.open()")),
      LINK_SUBMIT_LOAD_TIMEOUT,
    );

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    checkReady();
  });
}

function loadLinkSubmitWidget(trigger) {
  const scriptUrl = resolvePluginAsset(trigger.dataset.linkSubmitScript, LINK_SUBMIT_SCRIPT_PATH);
  const styleUrl = resolvePluginAsset(trigger.dataset.linkSubmitStyle, LINK_SUBMIT_STYLE_PATH);
  const styleReady = ensureLinkSubmitStylesheet(styleUrl);

  // Swup HeadPlugin 会在离开 Links 页时移除动态注入的样式，但已注册的
  // Web Component 与 window.LinkSubmitWidget 会继续存在。先恢复官方样式，
  // 再复用 Widget，避免 PJAX 返回后出现“弹窗能开但样式丢失”。
  if (isLinkSubmitWidgetReady()) {
    return styleReady.then(() => window.LinkSubmitWidget);
  }
  if (window.__skyLinkSubmitWidgetPromise) {
    return Promise.all([styleReady, window.__skyLinkSubmitWidgetPromise]).then(([, widget]) => widget);
  }

  let script = findPluginAsset("script[src]", LINK_SUBMIT_SCRIPT_PATH);
  const created = !script;
  if (!script) {
    script = document.createElement("script");
    script.src = scriptUrl.href;
    script.async = true;
    script.dataset.skyLinkSubmitResource = "script";
  }

  const widgetReady = waitForLinkSubmitWidget(script);
  window.__skyLinkSubmitWidgetPromise = widgetReady;
  widgetReady.catch(() => {
    if (!isLinkSubmitWidgetReady() && script?.isConnected) script.remove();
    if (window.__skyLinkSubmitWidgetPromise === widgetReady) {
      window.__skyLinkSubmitWidgetPromise = null;
    }
  });

  if (created) document.head.appendChild(script);
  return Promise.all([styleReady, widgetReady]).then(([, widget]) => widget);
}

function closeLinkSubmitModal() {
  const modal = document.querySelector("link-submit-modal");
  if (!modal) return;
  try {
    modal.open = false;
  } catch {
    modal.removeAttribute("open");
  }
}

registerPageLifecycle(
  () => {
    const root = document.querySelector("[data-links-page]");
    if (!root) return;

    const controller = new AbortController();
    const { signal } = controller;
    const trigger = root.querySelector("[data-link-submit-trigger]");
    const fallback = root.querySelector("[data-link-submit-fallback]");
    const status = root.querySelector("[data-link-submit-status]");

    const setStatus = (message = "") => {
      if (!status || signal.aborted) return;
      status.textContent = message;
      status.hidden = !message;
    };

    trigger?.addEventListener(
      "click",
      async () => {
        trigger.disabled = true;
        trigger.setAttribute("aria-busy", "true");
        setStatus("正在加载友链申请表单…");

        try {
          const widget = await loadLinkSubmitWidget(trigger);
          if (signal.aborted) return;
          if (typeof widget?.open !== "function") {
            throw new Error("LinkSubmitWidget.open() is unavailable");
          }
          if (fallback) fallback.hidden = true;
          setStatus();
          widget.open();
        } catch (error) {
          if (signal.aborted) return;
          skyDebug.error("links", "无法打开友链申请组件", error);
          if (fallback) fallback.hidden = false;
          setStatus("友链申请组件加载失败，请使用备用申请入口。");
          if (fallback && !fallback.disabled) fallback.focus();
          else status?.focus();
        } finally {
          if (!signal.aborted) {
            trigger.disabled = false;
            trigger.removeAttribute("aria-busy");
          }
        }
      },
      { signal },
    );

    return () => {
      controller.abort();
      closeLinkSubmitModal();
    };
  },
  { entry: "links" },
);

notifySwupPageReady();
