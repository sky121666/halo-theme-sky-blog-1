import { loadPluginScript, rememberDocumentPluginScript } from "./plugin-assets.js";
import { skyDebug } from "./debug.js";

const contactAsset = "/plugins/PluginContactForm/assets/static/contact-form-display.iife.js";
const contactHosts = "body > halo-contact-form-auto-loader, body > halo-contact-form-auto-display";
const restrictionHosts = "body > content-restrict-answer-modal, body > content-restrict-mp-modal";
const pluginResources = [
  /^\/plugins\/PluginCommentWidget\/assets\/.*\.js$/,
  /^\/plugins\/PluginSearchWidget\/assets\/.*\.js$/,
  /^\/plugins\/restricted-reading\/assets\/static\/content-restrict-widget\.iife\.js$/,
  /^\/plugins\/ai-assistant\/assets\/static\/ai-summary\/index\.js$/,
  /^\/plugins\/(editor-hyperlink-card|vote|lottery)\/assets\/static\/.*\.js$/,
  /^\/contact-form\/embed\.js$/,
];
const ncmAssets = "/plugins/plugin-ncm/assets/static/";
const ncmScriptAttributes = new Map([
  [ncmAssets + "mini-player/appearance.js", ["data-ncm-appearance-source"]],
  [ncmAssets + "mini-player/player.js", [
    "data-ncm-mini-player", "data-ncm-resume", "data-ncm-position-wide", "data-ncm-position-compact",
  ]],
  [ncmAssets + "card.js", ["data-ncm-card-js", "data-endpoint"]],
]);

function sameOriginUrl(value) {
  try {
    const url = new URL(value, location.href);
    if (url.origin === location.origin) return url;
  } catch {
    // The upstream asset declaration may be invalid.
  }
  return null;
}

export function isNcmPlayerStylesheet(element) {
  return element.localName === "link" && element.getAttribute("rel") === "stylesheet" &&
    sameOriginUrl(element.getAttribute("href"))?.pathname === ncmAssets + "mini-player/theme.css";
}

function readShiki(source) {
  if (!source.includes("renderCodeBlock(")) return undefined;
  const path = source.match(/from\s+['"]([^'"]+\/shiki-code\.js(?:\?[^'"]*)?)['"]/);
  if (!path) return undefined;
  const options = {};
  for (const name of ["lightTheme", "darkTheme", "variant", "fontSize"]) {
    const value = source.match(new RegExp(name + ":\\s*['\"]([^'\"]+)['\"]"));
    if (value) options[name] = value[1];
  }
  const excluded = source.match(/excludedLanguages:\s*\[([^\]]*)\]/)?.[1] || "";
  const excludedLanguages = Array.from(excluded.matchAll(/['"]([^'"]+)['"]/g),
    (item) => item[1].toLowerCase());
  return { path: path[1], options, excludedLanguages };
}

function readContacts(source) {
  const data = source.match(/^\s*var\s+autoContactFrom\s*=\s*(\[[\s\S]*\])\s*;?\s*$/)?.[1];
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function readGallery(source) {
  if (!source.includes("lightGallery(node")) return undefined;
  const root = source.match(/const galleries\s*=\s*document\.querySelectorAll\([\x60'"]([^\x60'"]+)[\x60'"]\)/)?.[1];
  const selector = source.match(/selector:\s*['"]([^'"]+)['"]/)?.[1];
  if (!root || !selector) return undefined;
  try {
    document.createDocumentFragment().querySelector(root);
    document.createDocumentFragment().querySelector(selector);
    return { root, selector };
  } catch {
    return undefined;
  }
}

export function preparePluginPage(doc, initial) {
  let shiki;
  const galleries = [];
  const contacts = [];
  const assets = [];
  for (const script of doc.querySelectorAll("script")) {
    if (script.hasAttribute("src")) {
      const url = sameOriginUrl(script.getAttribute("src"));
      if (!url) continue;
      const { pathname } = url;
      const ncmAttributes = script.parentElement === doc.head ? ncmScriptAttributes.get(pathname) : undefined;
      if (ncmAttributes && script.hasAttribute(ncmAttributes[0])) {
        const attributes = Object.fromEntries(ncmAttributes
          .filter(name => script.hasAttribute(name))
          .map(name => [name, script.getAttribute(name)]));
        assets.push({ url: url.href, type: script.type === "module" ? "module" : "", attributes });
        if (initial) script.setAttribute("data-theme-plugin-resource", "");
        else script.remove();
      } else if (/^\/plugins\/shiki\/assets\/static\/shiki-code\.js$/.test(pathname)) {
        assets.push({ url: url.href, type: "module" });
      } else if (pluginResources.some((match) => match.test(pathname))) {
        assets.push({ url: url.href, type: script.type === "module" ? "module" : "" });
      }
      continue;
    }
    const source = script.textContent || "";
    shiki ||= readShiki(source);
    contacts.push(...readContacts(source));
    const gallery = readGallery(source);
    if (gallery) galleries.push(gallery);
  }
  if (!initial && galleries.length) {
    doc.querySelectorAll('link[href*="/plugins/PluginLightGallery/assets/static/css/"]').forEach((style) => style.remove());
  }
  return { galleries, shiki, contacts, assets };
}

async function renderExtraShiki(content, options, signal) {
  const url = sameOriginUrl(options.path);
  if (!url || !/^\/plugins\/shiki\/assets\/static\/shiki-code\.js$/.test(url.pathname)) return;
  await import(/* @vite-ignore */ url.href);
  if (signal.aborted || !content.isConnected) return;
  for (const code of content.querySelectorAll("pre > code")) {
    if (code.closest("shiki-code") || !code.parentElement?.parentNode) continue;
    const lang = Array.from(code.classList).find((name) => /^(lang|language)-/.test(name));
    if (lang && options.excludedLanguages.includes(lang.replace(/^(lang|language)-/, "").toLowerCase())) continue;
    const block = document.createElement("shiki-code");
    for (const [name, value] of Object.entries(options.options)) {
      block.setAttribute(name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase()), value);
    }
    const pre = code.parentElement;
    pre.before(block);
    block.append(pre);
  }
}

async function showContactForms(contacts, signal) {
  if (!customElements.get("halo-contact-form-auto-display")) await loadPluginScript(contactAsset);
  if (signal.aborted) return;
  const positions = new Map();
  let popup = false;
  for (const config of contacts) {
    const options = config?.displayFormConfig;
    const mode = options?.displayForm;
    if (mode !== "aside_button" && mode !== "page_popup") continue;
    if (mode === "page_popup" && popup) continue;
    if (mode === "page_popup") popup = true;
    const position = options.displayPosition || "right_center";
    const offset = positions.get(position) || 0;
    positions.set(position, offset + 56);
    const element = document.createElement("halo-contact-form-auto-display");
    element.style.setProperty("--halo-contact-form-stack-offset", offset + "px");
    element.config = config;
    document.body.append(element);
  }
}

export function mountPluginPage(content, settings, signal, initial) {
  const run = (label, pending) => {
    void pending.catch((error) => {
      if (!signal.aborted) skyDebug.warn("plugin", label, error);
    });
  };
  if (initial) {
    for (const asset of settings.assets) rememberDocumentPluginScript(asset.url);
  } else {
    for (const asset of settings.assets) run("资源初始化失败", loadPluginScript(asset.url, asset.type, asset.attributes));
    if (settings.shiki) run("代码高亮初始化失败", renderExtraShiki(content, settings.shiki, signal));
    if (settings.contacts.length) run("联系表单初始化失败", showContactForms(settings.contacts, signal));
  }

  if (settings.galleries.length) {
    run("图片灯箱初始化失败", import("./gallery.js").then(({ mountGalleries }) => {
      if (!signal.aborted) mountGalleries(content, settings.galleries, signal, initial);
    }));
  }

  const syncRestrictedTheme = () => {
    const dark = document.documentElement.dataset.colorScheme === "dark";
    document.querySelectorAll(restrictionHosts).forEach((modal) => modal.classList.toggle("color-scheme-dark", dark));
  };
  const observer = new MutationObserver(syncRestrictedTheme);
  observer.observe(document.body, { childList: true });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-scheme"] });
  syncRestrictedTheme();

  return () => {
    observer.disconnect();
    document.querySelectorAll(restrictionHosts).forEach((modal) => modal.close?.());
    document.querySelectorAll(contactHosts).forEach((host) => host.remove());
    if ("autoContactFrom" in window) window.autoContactFrom = [];
    if ("contactFormTracking" in window) window.contactFormTracking = [];
  };
}
