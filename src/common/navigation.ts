import type { Alpine } from "alpinejs";
import Swup from "swup";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupA11yPlugin from "@swup/a11y-plugin";
import SwupProgressPlugin from "@swup/progress-plugin";
import SwupScrollPlugin from "@swup/scroll-plugin";

import { skyDebug } from "./js/debug.js";
import { mountPageEffects } from "./js/base.js";
import { mountArticleContent } from "../static/js/article-content.js";
import { ignoreDocumentVisit, resolveThemeUrl } from "./js/navigation-policy.js";
import { prepareWidgets, mountWidgets } from "./js/widgets.js";
import { isNcmPlayerStylesheet, mountPluginPage, preparePluginPage } from "./js/plugin-page.js";
import { collectionCanonical } from "./js/collection-canonical.js";

interface PageContext {
  content: HTMLElement;
  extras: HTMLElement;
  signal: AbortSignal;
  initial: boolean;
}

interface PageModule {
  registerAlpine?(alpine: Alpine): void;
  mount?(context: PageContext): void | (() => void);
}

const containers = ["#swup", "#swup-page-extras"];
const entries = new Set([
  "about",
  "archives",
  "author",
  "bangumi",
  "categories",
  "doc",
  "douban",
  "equipment",
  "index",
  "links",
  "moments",
  "page",
  "photos",
  "post",
  "steam",
]);

function getPage(doc: Document) {
  const content = doc.querySelector<HTMLElement>(containers[0]);
  const extras = doc.querySelector<HTMLElement>(containers[1]);
  const entry = content?.dataset.page;
  if (!content || !extras || !entry || !entries.has(entry)) return undefined;
  if (content.hasAttribute("data-plugin-page-layout") && !content.querySelector("[data-theme-swup]")) return undefined;
  return { content, extras, entry };
}

function syncCanonical(doc: Document, source: URL) {
  const target = getPage(doc);
  if (!target) return;
  const href = collectionCanonical(target.content, source, document.documentElement.dataset.siteUrl);
  if (!href) return;
  doc.querySelectorAll('link[rel~="canonical"]').forEach((link) => link.remove());
  const link = doc.createElement("link");
  link.rel = "canonical";
  link.href = href;
  link.dataset.themeCanonical = "";
  link.dataset.swupHeadMerge = "append";
  doc.head.append(link);
}

export async function startNavigation(alpine: Alpine, assetBase: string) {
  syncCanonical(document, new URL(window.location.href));
  const registered = new Set<PageModule>();
  const modules = new Map<string, Promise<PageModule>>();
  let stopPage: (() => void) | undefined;
  const loadPage = (entry: string) => {
    const existing = modules.get(entry);
    if (existing) return existing;
    const url = new URL(assetBase);
    url.pathname = url.pathname.replace(/[^/]+$/, entry + ".js");
    const pending = (import(/* @vite-ignore */ url.href) as Promise<PageModule>).catch((error: unknown) => {
      modules.delete(entry);
      throw error;
    });
    modules.set(entry, pending);
    return pending;
  };

  async function prepare(doc: Document, entry: string, initial: boolean) {
    syncCanonical(doc, new URL(doc.URL || window.location.href));
    const [page, plugins] = await Promise.all([
      loadPage(entry),
      preparePluginPage(doc, initial),
      prepareWidgets(doc, alpine),
    ]);
    if (!registered.has(page)) {
      page.registerAlpine?.(alpine);
      registered.add(page);
    }
    return { page, plugins };
  }

  function mount(
    target: NonNullable<ReturnType<typeof getPage>>,
    prepared: Awaited<ReturnType<typeof prepare>>,
    initial: boolean,
  ) {
    const controller = new AbortController();
    const { signal } = controller;
    const { content, extras } = target;
    const disposeEffects = mountPageEffects();
    mountWidgets(content, signal);
    mountWidgets(extras, signal);
    const disposeArticle = mountArticleContent();
    let disposePage: void | (() => void);
    let disposePlugins: void | (() => void);
    stopPage = () => {
      controller.abort();
      disposePage?.();
      disposePlugins?.();
      disposeArticle?.();
      disposeEffects();
    };
    try {
      disposePage = prepared.page.mount?.({ content, extras, signal, initial });
      disposePlugins = mountPluginPage(content, prepared.plugins, signal, initial);
    } catch (error) {
      stopPage();
      stopPage = undefined;
      throw error;
    }
  }

  const initial = getPage(document);
  if (!initial) {
    await prepareWidgets(document, alpine);
    alpine.start();
    mountPageEffects();
    mountArticleContent();
    return;
  }
  let prepared: Awaited<ReturnType<typeof prepare>>;
  try {
    prepared = await prepare(document, initial.entry, true);
  } catch (error) {
    skyDebug.error("navigation", "页面资源初始化失败", error);
    alpine.start();
    return;
  }
  alpine.start();
  try {
    mount(initial, prepared, true);
  } catch (error) {
    skyDebug.error("navigation", "页面初始化失败", error);
    return;
  }

  const swup = new Swup({
    containers,
    native: true,
    animationSelector: false,
    animateHistoryBrowsing: true,
    requestHeaders: { Accept: "text/html, application/xhtml+xml" },
    cache: false,
    timeout: 12000,
    ignoreVisit: (url, { el, event } = {}) =>
      event?.defaultPrevented === true || ignoreDocumentVisit(url, window.location.href, el),
    resolveUrl: (url) => resolveThemeUrl(url, window.location.origin),
    plugins: [
      new SwupHeadPlugin({
        awaitAssets: true,
        persistTags: (element) =>
          element.hasAttribute("data-theme-plugin-resource") ||
          element.hasAttribute("data-progressbar-styles") ||
          isNcmPlayerStylesheet(element) ||
          (element instanceof HTMLLinkElement &&
            /\/assets\/css\/gallery-[^/]+\.css$/.test(new URL(element.href).pathname)),
      }),
      new SwupA11yPlugin({
        announcements: { visit: "已进入 {title}", url: "已打开 {url}" },
      }),
      new SwupScrollPlugin({ animateScroll: { betweenPages: false, samePageWithHash: false, samePage: false } }),
      new SwupProgressPlugin({ delay: 300, transition: 160 }),
    ],
  });

  // Fetch current server-rendered markup after template reloads.
  swup.hooks.replace("fetch:request", (_visit, { url, options }) => fetch(url, { ...options, cache: "no-store" }));

  // Let only the last link activation in the same turn start a Swup visit.
  let pendingClick: MouseEvent | undefined;
  swup.hooks.replace("link:click", (visit, args, followLink) => {
    const { event } = args;
    event.preventDefault();
    pendingClick = event;
    queueMicrotask(() => {
      if (pendingClick !== event) return;
      pendingClick = undefined;
      followLink?.(visit, args);
    });
  });

  const pending = new WeakMap<object, Awaited<ReturnType<typeof prepare>>>();
  const isCurrentVisit = (visit: typeof swup.visit) => !visit.done && swup.visit === visit;
  const cancelInactivePage = (visit: typeof swup.visit) => {
    if (isCurrentVisit(visit) || visit.meta.ncmMusic === true) return;
    stopPage?.();
    stopPage = undefined;
  };
  swup.hooks.on("visit:start", (visit) => {
    visit.animation.wait = true;
  });

  swup.hooks.replace("visit:transition", async (visit, args, transition) => {
    if (!isCurrentVisit(visit)) return;
    if (visit.meta.ncmMusic === true) {
      await transition?.(visit, args);
      return;
    }
    const incoming = visit.to.document;
    const target = incoming && getPage(incoming);
    if (!incoming || !target) throw new Error("目标响应未提供可替换的主题页面");
    visit.a11y.focus = { selector: containers[0], wait: !visit.to.hash };
    try {
      const page = await prepare(incoming, target.entry, false);
      if (!isCurrentVisit(visit)) return;
      pending.set(visit, page);
    } catch (error) {
      if (!isCurrentVisit(visit)) return;
      throw error;
    }
    try {
      await transition?.(visit, args);
    } finally {
      pending.delete(visit);
    }
  });

  swup.hooks.before(
    "content:replace",
    (visit) => {
      if (visit.meta.ncmMusic === true) return;
      stopPage?.();
      stopPage = undefined;
      const nextBody = visit.to.document?.body;
      if (!nextBody) return;
      for (const name of ["bg-base-100", "bg-base-200", "bg-base-300", "flex", "flex-col", "text-base-content"]) {
        document.body.classList.toggle(name, nextBody.classList.contains(name));
      }
    },
    { priority: 100 },
  );

  swup.hooks.on("content:replace", (visit) => {
    const target = getPage(document);
    const prepared = pending.get(visit);
    if (target && prepared) mount(target, prepared, false);
  });

  swup.hooks.replace("visit:fail", (visit, args, fallback) => {
    if (!isCurrentVisit(visit)) return;
    if (visit.history.popstate || visit.history.action === "replace") {
      window.location.reload();
      return;
    }
    return fallback?.(visit, args);
  });

  swup.hooks.on("visit:abort", cancelInactivePage);

  const announceSwup = () => document.dispatchEvent(new CustomEvent("ncm:swup-ready", { detail: swup }));
  document.addEventListener("ncm:request-swup", announceSwup);
  swup.hooks.once("disable", () => document.removeEventListener("ncm:request-swup", announceSwup));
  announceSwup();
}
