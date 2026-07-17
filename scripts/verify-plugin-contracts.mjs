#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pluginContracts } from "./plugin-contracts.mjs";
import { compareVersions } from "./version-utils.mjs";

const root = process.cwd();
const failures = [];

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => failures.push(message);
const unquote = (value) =>
  String(value || "")
    .trim()
    .replace(/^`|`$/g, "");

const duplicates = pluginContracts
  .map((contract) => contract.plugin)
  .filter((plugin, index, all) => all.indexOf(plugin) !== index);
if (duplicates.length > 0) fail(`duplicate plugin contracts: ${[...new Set(duplicates)].join(", ")}`);

for (const [left, right, expected] of [
  ["1.0.0-beta.10", "1.0.0-beta.2", 1],
  ["1.0.0-beta.2", "1.0.0-beta.10", -1],
  ["1.0.0", "1.0.0-rc.1", 1],
  ["1.16.0", "1.16.1", -1],
  ["1.4.1-beta.1", "1.4.1-beta.1", 0],
]) {
  if (compareVersions(left, right) !== expected) {
    fail(`version comparison failed: ${left} vs ${right}`);
  }
}

const allowedStatuses = new Set(["confirmed", "compatible-tested", "inferred"]);
for (const contract of pluginContracts) {
  if (!allowedStatuses.has(contract.status)) {
    fail(`${contract.plugin}: unsupported contract status ${contract.status}`);
  }
  if (contract.status === "compatible-tested" && !contract.testedVersion) {
    fail(`${contract.plugin}: compatible-tested requires testedVersion`);
  }
  if (contract.testedVersion && contract.status !== "compatible-tested") {
    fail(`${contract.plugin}: testedVersion requires compatible-tested status`);
  }
  if (contract.testedVersion && compareVersions(contract.testedVersion, contract.contractVersion) < 0) {
    fail(`${contract.plugin}: testedVersion must not be lower than contractVersion`);
  }
  for (const evidence of contract.evidence
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)) {
    if (!fs.existsSync(path.join(root, evidence))) {
      fail(`${contract.plugin}: evidence path does not exist: ${evidence}`);
    }
  }
}

const matrix = read("docs/system/adaptation/plugin-adaptation.md");
const matrixTable = matrix.split("## 当前适配矩阵")[1]?.split("状态含义：")[0] || "";
for (const contract of pluginContracts) {
  const lines = matrixTable.split(/\r?\n/).filter((candidate) => {
    const columns = candidate.split("|").map((value) => value.trim());
    return unquote(columns[1]) === contract.plugin;
  });
  if (lines.length === 0) {
    fail(`matrix row missing: ${contract.plugin}`);
    continue;
  }
  if (lines.length > 1) {
    fail(`duplicate matrix rows: ${contract.plugin}`);
    continue;
  }

  const [line] = lines;
  const columns = line.split("|").map((value) => value.trim());
  const matrixContract = unquote(columns[3]);
  const matrixTested = columns[4] === "-" ? "" : unquote(columns[4]);
  const matrixStatus = unquote(columns[5]);
  if (matrixContract !== contract.contractVersion) {
    fail(`${contract.plugin}: matrix contract ${matrixContract} != ${contract.contractVersion}`);
  }
  if (matrixTested !== (contract.testedVersion || "")) {
    fail(`${contract.plugin}: matrix tested ${matrixTested || "-"} != ${contract.testedVersion || "-"}`);
  }
  if (matrixStatus !== contract.status) {
    fail(`${contract.plugin}: matrix status ${matrixStatus} != ${contract.status}`);
  }
}

const momentHeader = read("templates/modules/index/header/moments.html");
if (/th:utext="\$\{content\.raw\}"/.test(momentHeader)) {
  fail("unsafe moment raw HTML output is forbidden; render content.raw as text");
}

const momentList = read("templates/modules/moments/content.html");
const momentDetail = read("templates/modules/moments/detail.html");
const momentsScript = read("src/pages/moments/moments.js");
const emojiScript = read("src/static/emoji/emoji-selector.js");
const mainScript = read("src/common/main.js");
const authorContent = read("templates/modules/author/content.html");
for (const [file, source] of [
  ["templates/modules/moments/content.html", momentList],
  ["templates/modules/moments/detail.html", momentDetail],
]) {
  if (!source.includes("作者已注销") || !source.includes("moment.owner?.name")) {
    fail(`${file}: Moments 1.16.1 deleted-author fallback is missing`);
  }
  if ((source.match(/data-no-swup/g) || []).length < 2) {
    fail(`${file}: Moments image links must opt out of Swup before LightGallery handles them`);
  }
}
if (!mainScript.includes('Boolean(el?.closest("[data-no-swup]"))')) {
  fail("custom Swup ignoreVisit must preserve the standard data-no-swup escape hatch");
}
if (!momentsScript.includes("window.SkyLightGallery?.initNow?.()")) {
  fail("Moments PJAX lifecycle must actively initialize LightGallery");
}
if (!momentList.includes("data-emoji-trigger")) {
  fail("Moments emoji trigger must expose a stable outside-click contract");
}
for (const marker of [
  "window.__skyEmojiSelectorCleanup?.()",
  "document.addEventListener('sky:page-cleanup', cleanupEmojiSelector",
  "e.target.closest('[data-emoji-trigger]')",
]) {
  if (!emojiScript.includes(marker)) fail(`Moments emoji PJAX marker is missing: ${marker}`);
}
if (
  !/hasMomentsPlugin\s*=\s*\$\{pluginFinder\.available\('PluginMoments',\s*'>=1\.16\.1'\)\}/.test(authorContent) ||
  !/authorMoments\s*=\s*\$\{hasMomentsPlugin\s*\?\s*momentFinder\.list\(\{/.test(authorContent)
) {
  fail("Author Moments tab must guard momentFinder with PluginMoments >=1.16.1 availability");
}
if (/authorMoments\s*=\s*\$\{momentFinder\.list\(/.test(authorContent)) {
  fail("Author Moments tab must not call momentFinder without an availability guard");
}
if (
  !authorContent.includes('data-plugin-moments-contract="PluginMoments>=1.16.1"') ||
  !authorContent.includes("data-plugin-moments-available=${hasMomentsPlugin}")
) {
  fail("Author Moments page must expose its runtime compatibility gate for smoke verification");
}

const linksContent = read("templates/modules/links/content.html");
for (const marker of [
  "data-link-group-navigation",
  "simpleGroups",
  'th:each="linkGroup : ${groups}"',
  "linkGroup.metadata.name == group",
  "displayLinks=${#strings.isEmpty(group) ? linkGroup.links : links}",
  "data-links-empty",
]) {
  if (!linksContent.includes(marker)) fail(`PluginLinks group route marker is missing: ${marker}`);
}
if (/th:each="group(?:,|\s)/.test(linksContent)) {
  fail("PluginLinks page must not shadow the route variable 'group' with a loop variable");
}
if (!linksContent.includes("pluginFinder.available('link-submit', '>=1.0.7')")) {
  fail("Link Submit UI must be gated by link-submit >=1.0.7 availability");
}
if (linksContent.includes("pluginFinder.available('link-submit')")) {
  fail("Link Submit UI must not use an unversioned plugin availability check");
}
if (linksContent.includes('onclick="LinkSubmitWidget.open()"')) {
  fail("Link Submit trigger must not call the widget before its official resources are ready");
}
for (const marker of [
  "data-link-submit-trigger",
  "data-link-submit-fallback",
  "data-link-submit-status",
  "/plugins/link-submit/assets/static/link-submit-widget.iife.js?version=1.0.7",
  "/plugins/link-submit/assets/static/var.css?version=1.0.7",
]) {
  if (!linksContent.includes(marker)) fail(`Link Submit safe trigger marker is missing: ${marker}`);
}
if (!linksContent.includes("applyUrl != '#' and applyUrl != '/#'")) {
  fail("Link Submit fallback must ignore placeholder apply URLs '#' and '/#'");
}
if (linksContent.includes("link-submit-modal") || linksContent.includes("安装插件")) {
  fail("Link Submit must not be reimplemented by the theme or expose plugin installation to site visitors");
}
const linksScript = read("src/pages/links/links.js");
for (const marker of [
  'typeof window.LinkSubmitWidget?.open === "function"',
  "window.__skyLinkSubmitWidgetPromise",
  "findPluginAsset",
  "waitForLinkSubmitStylesheet",
  "window.__skyLinkSubmitWidgetPromise = widgetReady",
  "Promise.all([styleReady, widgetReady])",
  "loadLinkSubmitWidget(trigger)",
  "fallback.hidden = false",
  "closeLinkSubmitModal()",
]) {
  if (!linksScript.includes(marker)) fail(`Link Submit runtime guard marker is missing: ${marker}`);
}
const linkSubmitLoader = linksScript.slice(linksScript.indexOf("function loadLinkSubmitWidget"));
if (
  linkSubmitLoader.indexOf("const styleReady = ensureLinkSubmitStylesheet(styleUrl)") >
  linkSubmitLoader.indexOf("if (isLinkSubmitWidgetReady())")
) {
  fail("Link Submit must restore its official stylesheet before reusing the PJAX-persistent widget");
}
for (const forbidden of [
  "anonymous.link.submit.kunkunyu.com",
  "linkSubmitForm",
  "LINK_SUBMIT_API",
  "LINK_GROUPS_API",
]) {
  if (linksScript.includes(forbidden)) {
    fail(`Link Submit plugin backend must not be reimplemented in theme JavaScript: ${forbidden}`);
  }
}

const doubanScript = read("src/pages/douban/douban.js");
const doubanContent = read("templates/modules/douban/content.html");
for (const marker of [
  "JAVA_INT_MAX = 2147483647",
  "MAX_PAGE_SIZE = 1000",
  "if (!/^[1-9]\\d*$/.test(raw))",
  "Number.isSafeInteger(parsed)",
  "maxPageForSize(size)",
  'syncQueryState(state, "replace")',
]) {
  if (!doubanScript.includes(marker)) fail(`Douban query boundary marker is missing: ${marker}`);
}
for (const marker of [
  "data-douban-error-title",
  "data-douban-error-description",
  "data-douban-retry",
  "data-douban-reset",
]) {
  if (!doubanContent.includes(marker)) fail(`Douban recoverable error marker is missing: ${marker}`);
}

const indexContent = read("templates/modules/index/content.html");
const indexMomentsHeader = read("templates/modules/index/header/moments.html");
const tabsGroup = read("templates/modules/widgets/tabs_group.html");
const friendsContent = read("templates/modules/friends/content.html");
const linksWidget = read("templates/modules/widgets/links.html");
for (const [name, source] of [
  ["home content", indexContent],
  ["home Moments header", indexMomentsHeader],
]) {
  if (!source.includes("pluginFinder.available('PluginMoments', '>=1.16.1')")) {
    fail(`${name} must gate PluginMoments at the 1.16.1 contract`);
  }
  if (source.includes("pluginFinder.available('PluginMoments', '>=1.16.0')")) {
    fail(`${name} must not use the stale PluginMoments 1.16.0 availability gate`);
  }
}
for (const marker of [
  "moment-item rounded-xl p-3 md:p-4",
  "(momentStat.index == 1 ? ' hidden md:flex' : '')",
  "(momentStat.index == 2 ? ' hidden lg:flex' : ' flex')",
]) {
  if (!indexMomentsHeader.includes(marker)) {
    fail(`home Moments header dynamic class expression is missing: ${marker}`);
  }
}
if (indexMomentsHeader.includes(")} hidden h-24")) {
  fail("home Moments header Thymeleaf class expression was split by formatting");
}
if (
  !indexContent.includes(
    "th:class=\"${theme.config.index.background_settings?.enable_header != false} ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8 lg:pt-24 lg:pb-12' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8 lg:pt-8 lg:pb-12'\"",
  )
) {
  fail("Home shell conditional class expression must remain valid after formatting");
}
if (!indexContent.includes("hasLinksPlugin = ${pluginFinder.available('PluginLinks', '>=2.0.0')}")) {
  fail("Home Friends enhancements must independently gate PluginLinks >=2.0.0");
}
if (!tabsGroup.includes("hasLinksPlugin ? linkFinder.groupBy() : {}")) {
  fail("Home Friends group labels must not call linkFinder when PluginLinks is unavailable");
}
if (
  (tabsGroup.match(/this\.nextElementSibling\.hidden = false;/g) || []).length < 2 ||
  (friendsContent.match(/this\.nextElementSibling\.hidden = false;/g) || []).length < 2
) {
  fail("Every Friends list style must provide an empty/error avatar fallback");
}
for (const marker of ["function applyLimit()", 'document.readyState === "loading"', "applyLimit();"]) {
  if (!linksWidget.includes(marker)) fail(`Home Links PJAX limit marker is missing: ${marker}`);
}

const photosScript = read("src/pages/photos/photos.js");
const photosContent = read("templates/modules/photos/content.html");
const galleryWidget = read("templates/modules/widgets/gallery.html");
for (const marker of [
  'event.key !== "Enter" && event.key !== " "',
  'img.setAttribute("data-src", src)',
  "window.lgData?.[id]",
  'typeof instance.refresh === "function"',
  "instance.destroy(true)",
  "window.lightGallery(photoGrid, settings)",
  "syncLightGalleryItems();",
]) {
  if (!photosScript.includes(marker)) fail(`Photos dynamic LightGallery marker is missing: ${marker}`);
}
for (const marker of ["data-photo-lightbox-trigger", 'role="button"', 'tabindex="0"', "data-src="]) {
  if (!photosContent.includes(marker)) fail(`Photos keyboard/lightbox template marker is missing: ${marker}`);
}
if (!galleryWidget.includes("@{/photos(group=${group.metadata.name})}")) {
  fail("Photo group links must use Thymeleaf query parameter encoding");
}
if (galleryWidget.includes("/photos?group=${group.metadata.name}")) {
  fail("Photo group links must not concatenate an unencoded group query");
}

const docsme = read("templates/modules/doc-content.html");
if (!docsme.includes('group="doc.halo.run"') || !docsme.includes('kind="DocTree"')) {
  fail("Docsme comment subject must use doc.halo.run / DocTree");
}
if (!docsme.includes("name=${docTree.metadata.name}")) {
  fail("Docsme comment subject must use docTree.metadata.name");
}

const steam = read("templates/modules/steam/content.html");
const sidebarTemplate = read("templates/modules/widgets/sidebar.html");
const steamCard = read("templates/modules/widgets/steam-card.html");
if (!steam.includes("game.delisted")) fail("Steam 1.0 contract must render delisted state");
if (/games\.items\.filter\([^\n]*headerImageUrl/.test(steam)) {
  fail("Steam games with missing headerImageUrl must not be filtered out");
}
if (steam.includes('th:if="${enableGameLink}"')) {
  fail("Steam cards must remain visible when external game links are disabled");
}
if (!sidebarTemplate.includes("widgetType eq 'steam_card' and pluginFinder.available('steam', '>=1.0.0')")) {
  fail("Steam sidebar card must be gated by the Steam plugin runtime name at >=1.0.0");
}
for (const marker of ["new AbortController()", "controller.signal", "destroy()", "this._abortController?.abort()"]) {
  if (!steamCard.includes(marker)) fail(`Steam sidebar PJAX cancellation marker is missing: ${marker}`);
}

const bangumiContent = read("templates/modules/bangumi/content.html");
const bangumiCard = read("templates/modules/widgets/bangumi-card.html");
for (const marker of [
  "prefers-reduced-motion: reduce",
  "stopAutoPlay()",
  "destroy()",
  "clearInterval(this.timer)",
  "cover=${bangumi.spec.cover ?: ''}",
  "this.nextElementSibling.hidden = false;",
]) {
  if (!bangumiCard.includes(marker)) fail(`Bangumi sidebar lifecycle/fallback marker is missing: ${marker}`);
}
for (const marker of ["cover=${bangumi.spec.cover ?: ''}", "this.nextElementSibling.hidden = false;"]) {
  if (!bangumiContent.includes(marker)) fail(`Bangumi list cover fallback marker is missing: ${marker}`);
}

const alpineModules = read("src/common/js/alpine-modules.js");
for (const marker of ["_titleAbortController", "this._abortController?.abort()", "signal: controller.signal"]) {
  if (!alpineModules.includes(marker)) fail(`Online widget PJAX cancellation marker is missing: ${marker}`);
}

const articleCss = read("src/static/css/article-content.css");
const voteVariables = [
  "--vote-text-title-color",
  "--vote-text-description-color",
  "--vote-text-selected-color",
  "--vote-text-voted-color",
  "--vote-text-error-color",
  "--vote-text-button-color",
  "--vote-icon-color",
  "--vote-background-primary-color",
  "--vote-background-secondary-color",
  "--vote-background-tertiary-color",
  "--vote-background-selected-color",
  "--vote-background-voted-color",
  "--vote-background-progress-color",
  "--vote-background-progress-voted-color",
  "--vote-background-button-color",
  "--vote-background-button-hover-color",
  "--vote-background-tag-color",
  "--vote-background-voted-tag-color",
  "--vote-border-color",
  "--vote-border-selected-color",
  "--vote-border-voted-color",
  "--vote-pk-option1-bg",
  "--vote-pk-option2-bg",
  "--vote-pk-progress-text-color",
  "--vote-shadow",
];
for (const variable of voteVariables) {
  if (!articleCss.includes(`${variable}:`)) fail(`Vote 1.1.3 theme variable is missing: ${variable}`);
}

const themeScript = read("templates/modules/theme-script.html");
const articleScript = read("src/static/js/article-content.js");
for (const marker of [
  "normalizeNestedShikiBlocks()",
  "observeShikiStructure()",
  "content.querySelectorAll('shiki-code > shiki-code')",
  "outer.replaceWith(inner)",
  "shikiStructureObserver.observe(content, { childList: true, subtree: true })",
]) {
  if (!articleScript.includes(marker)) fail(`Shiki PJAX idempotency marker is missing: ${marker}`);
}
if (!articleCss.includes("#article-content text-diagram")) {
  fail("Text Diagram 1.5.2 content container styling is missing");
}
if (!themeScript.includes('setAttribute("data-color-scheme", themeMode)')) {
  fail("Text Diagram dark selector contract requires html[data-color-scheme]");
}
if (!articleScript.includes("/plugins/text-diagram/assets/static/mermaid.min.js")) {
  fail("Text Diagram PJAX fallback must load the plugin-owned Mermaid resource");
}
if (articleScript.includes("sourceElement?.getAttribute('src')")) {
  fail("Text Diagram fallback must not execute a script URL copied from article DOM");
}
if (!articleScript.includes("new URL(TEXT_DIAGRAM_MERMAID_SRC, window.location.origin).href")) {
  fail("Text Diagram fallback must load an exact same-origin plugin resource path");
}
if (
  !articleScript.includes("TEXT_DIAGRAM_MERMAID_SELECTOR = 'text-diagram[data-type=\"mermaid\"]'") ||
  !articleScript.includes("!node.getAttribute('data-processed')") ||
  !articleScript.includes("await mermaid.run({ nodes: connectedNodes })")
) {
  fail("Text Diagram PJAX fallback must render only unprocessed Mermaid nodes");
}
if (
  !articleScript.includes("generation !== articleContentGeneration") ||
  !articleScript.includes("window.SkyPjax.onCleanup")
) {
  fail("Text Diagram PJAX fallback must abandon not-yet-started stale renders after page cleanup");
}
if (
  !articleScript.includes("typeof candidate?.initialize === 'function'") ||
  !articleScript.includes("window.__skyTextDiagramRenderQueue")
) {
  fail("Text Diagram fallback must use a compatible Mermaid API and serialize global renders");
}
if (
  !articleScript.includes("new MutationObserver") ||
  !articleScript.includes("rerenderTextDiagramsForTheme") ||
  !articleScript.includes("node.removeAttribute('data-processed')")
) {
  fail("Text Diagram fallback must rerender generated SVG after color-scheme changes");
}

const baseCss = read("src/common/css/base.css");
for (const variable of [
  "--link-submit-widget-base-font-size",
  "--link-submit-widget-base-font-family",
  "--link-submit-widget-base-rounded",
  "--link-submit-widget-base-bg-color",
  "--link-submit-widget-modal-layer-color",
  "--link-submit-widget-form-bg-color",
  "--link-submit-widget-form-border-color",
  "--link-submit-widget-form-text-color",
  "--link-submit-widget-form-label-color",
  "--link-submit-widget-form-placeholder-color",
  "--link-submit-widget-form-button-bg-color",
  "--link-submit-widget-form-button-text-color",
  "--link-submit-widget-form-button-hover-bg-color",
]) {
  if (!baseCss.includes(`${variable}:`)) fail(`Link Submit 1.0.7 theme variable is missing: ${variable}`);
}
if (read("src/pages/links/links.css").includes("#link-submit-modal")) {
  fail("obsolete theme-owned Link Submit modal CSS must be removed");
}
const contactFormVariables = [
  "--halo-contact-form-font-family",
  "--halo-contact-form-font-size",
  "--halo-contact-form-line-height",
  "--halo-contact-form-border-radius",
  "--halo-contact-form-width-submit",
  "--halo-contact-form-color-primary",
  "--halo-contact-form-color-label",
  "--halo-contact-form-color-input",
  "--halo-contact-form-color-placeholder",
  "--halo-contact-form-color-input-selection",
  "--halo-contact-form-color-border",
  "--halo-contact-form-color-danger",
  "--halo-contact-form-color-help",
  "--halo-contact-form-color-button",
  "--halo-contact-form-color-button-hover",
  "--halo-contact-form-focus-ring-color",
  "--halo-contact-form-error-ring-color",
  "--halo-contact-form-error-ring-focus-color",
  "--halo-contact-form-bg-input",
  "--halo-contact-form-bg-decorator",
  "--halo-contact-form-auto-color-modal-bg",
];
for (const variable of contactFormVariables) {
  if (!baseCss.includes(`${variable}:`)) fail(`Contact Form 1.6.4 theme variable is missing: ${variable}`);
}
for (const host of ["halo-contact-form", "halo-contact-form-single", "halo-contact-form-auto-loader"]) {
  if (!baseCss.includes(host)) fail(`Contact Form 1.6.4 theme variables must cover host: ${host}`);
}
if (
  !baseCss.includes('html[data-color-scheme="dark"] body') ||
  !baseCss.includes(":is(halo-contact-form, halo-contact-form-single, halo-contact-form-auto-loader)")
) {
  fail("Contact Form 1.6.4 high-specificity light/dark host selectors are missing");
}
if (!/import\s+["']\.\/css\/base\.css["']/.test(read("src/common/main.js"))) {
  fail("Contact Form variables must be loaded globally through base.css");
}
for (const selector of [
  "#article-content hyperlink-card",
  "#article-content hyperlink-inline-card",
  "#article-content lottery-card",
  "#article-content content-restrict-widget",
  "#article-content .katex-display",
]) {
  if (!articleCss.includes(selector)) fail(`content plugin host rule is missing: ${selector}`);
}
const commonMain = read("src/common/main.js");
if (!commonMain.includes("script[data-pjax], script.pjax")) {
  fail("KaTeX and content plugin inline scripts require the PJAX script replay contract");
}
for (const marker of [
  'const SKY_PJAX_CONTAINERS = ["#swup", "#swup-scripts", "#swup-page-extras"]',
  "incomingDocument?.querySelector(selector)",
  "visit.abort()",
  "swup.options.skipPopStateHandling",
  "window.location.assign(target)",
  "window.history.back()",
  "{ priority: -100 }",
  "window.__skyLoadedPluginScripts ||",
  "window.__skyLoadingPluginScripts || new Set()",
  "window.__skyLoadedHeadScripts ||",
  "window.__skyLoadingHeadScripts || new Set()",
  "replayNewHeadScripts(debugState)",
  'document.head.querySelectorAll("script[src]")',
  'script.hasAttribute("data-swup-ignore-script")',
  'replacement.async = script.hasAttribute("async")',
  'skyDebug.event("pjax", "head-script:load"',
  "loadingPluginScripts.add(script.src)",
  "loadingPluginScripts.delete(source)",
  "loadedPluginScripts.add(source)",
  "MANAGED_BODY_CLASSES",
  "document.body.classList.toggle(className, enabled)",
  "new SwupHeadPlugin()",
]) {
  if (!commonMain.includes(marker)) fail(`PJAX boundary/script lifecycle marker is missing: ${marker}`);
}
if (/persist(?:Assets|Tags)\s*:/.test(commonMain)) {
  fail("Swup HeadPlugin must diff versioned assets instead of persisting stale main.css");
}
if (commonMain.includes("{ after: true }")) {
  fail("unsupported Swup hook option after:true must not be used");
}
if (/document\.body\.className\s*=/.test(commonMain)) {
  fail("PJAX body sync must preserve third-party runtime classes");
}
const compatibilityEvents = commonMain.slice(
  commonMain.indexOf("function dispatchPjaxCompatibilityEvents"),
  commonMain.indexOf("function getLightGalleryInlineScripts"),
);
if (compatibilityEvents.includes("swup:page:view")) {
  fail("Swup already dispatches swup:page:view; the compatibility bridge must not duplicate it");
}
const heatmapTemplate = read("templates/modules/widgets/heatmap.html");
for (const marker of [
  "_themeObserver?.disconnect()",
  "_resizeObserver?.disconnect()",
  "cancelIdleCallback",
  "cancelAnimationFrame(this._renderFrame)",
  "clearTimeout(this._resizeTimer)",
]) {
  if (!heatmapTemplate.includes(marker)) fail(`PJAX heatmap cleanup marker is missing: ${marker}`);
}
if ((heatmapTemplate.match(/\bdestroy\(\)\s*\{/g) || []).length < 2) {
  fail("both GitHub and article heatmaps must release observers and scheduled callbacks on Alpine destroy");
}
const baseScript = read("src/common/js/base.js");
for (const marker of [
  "cleanupPageObservers()",
  "this._imageObserver?.disconnect()",
  "this._animationObserver?.disconnect()",
  "this._loadingImageObserver?.disconnect()",
  "this.initLoadingImageObserver()",
  'document.getElementById("swup") || document.body',
]) {
  if (!baseScript.includes(marker)) fail(`PJAX base observer lifecycle marker is missing: ${marker}`);
}
if (!commonMain.includes("window.SkyEvents?.cleanupPageObservers?.()")) {
  fail("PJAX cleanup must release base observers before replacing the page containers");
}
const navTemplate = read("templates/modules/nav.html");
if ((navTemplate.match(/@click="open = false"/g) || []).length < 2) {
  fail("desktop and mobile submenu links must close their persistent Alpine state before PJAX navigation");
}
if ((navTemplate.match(/@sky:page-load\.window="open = false"/g) || []).length < 2) {
  fail("desktop and mobile submenu state must reset after PJAX navigation and history traversal");
}
for (const marker of [
  "_pageLoadHandler: null",
  'document.addEventListener("sky:page-load", this._pageLoadHandler)',
  'document.removeEventListener("sky:page-load", this._pageLoadHandler)',
  'document.getElementById("mobile-menu-drawer")',
]) {
  if (!alpineModules.includes(marker)) fail(`persistent navbar cleanup marker is missing: ${marker}`);
}
for (const route of ["/dishes", "/schedule-calendar"]) {
  if (!commonMain.includes(`isRouteOrDescendant(url, ${JSON.stringify(route)})`)) {
    fail(`${route}: independent plugin page must bypass theme PJAX`);
  }
}
if (
  !commonMain.includes("resolved.pathname === route") ||
  !commonMain.includes("resolved.pathname.startsWith(`${route}/`)")
) {
  fail("independent plugin route matching must not swallow similarly prefixed non-plugin pages");
}
const pjaxLayouts = [
  "templates/modules/about/layout.html",
  "templates/modules/archives/layout.html",
  "templates/modules/author/layout.html",
  "templates/modules/bangumi/layout.html",
  "templates/modules/categories/layout.html",
  "templates/modules/doc-layout.html",
  "templates/modules/douban/layout.html",
  "templates/modules/equipments/layout.html",
  "templates/modules/friends/layout.html",
  "templates/modules/index/layout.html",
  "templates/modules/links/layout.html",
  "templates/modules/moments/layout.html",
  "templates/modules/page/layout.html",
  "templates/modules/photos/layout.html",
  "templates/modules/post/layout.html",
  "templates/modules/steam/layout.html",
  "templates/modules/tags/layout.html",
];
const gridFragmentMarker = "modules/global-background :: grid(${enableCustomBg}, ${bgStyle})";
const fontFragmentMarker = "modules/font-loader :: fonts";
for (const file of pjaxLayouts) {
  const source = read(file);
  const extrasIndex = source.indexOf('id="swup-page-extras"');
  const scriptsIndex = source.indexOf('id="swup-scripts"');
  const gridIndex = source.indexOf(gridFragmentMarker);
  const gridCount = source.split(gridFragmentMarker).length - 1;
  const fontCount = source.split(fontFragmentMarker).length - 1;
  if (
    extrasIndex === -1 ||
    scriptsIndex === -1 ||
    gridCount !== 1 ||
    gridIndex < extrasIndex ||
    gridIndex > scriptsIndex
  ) {
    fail(`${file}: global grid fragment must appear exactly once inside #swup-page-extras`);
  }
  if (fontCount !== 1) {
    fail(`${file}: global font-loader must appear exactly once`);
  }
  if (source.includes('class="bg-grid-pattern')) {
    fail(`${file}: duplicated grid markup must use the shared global-background fragment`);
  }
}
const fontLoader = read("templates/modules/font-loader.html");
for (const marker of [
  'th:fragment="index-fonts"',
  'data-sky-font="lxgw-wenkai-bright"',
  'data-sky-font="siyuan-songti"',
  "/LXGWBright-SemiLight/result.css",
  "/思源屏显臻宋/result.css",
  "titleSettings?.show_title != true or subtitleFont != titleFont",
]) {
  if (!fontLoader.includes(marker)) fail(`declarative font contract marker is missing: ${marker}`);
}
if (fontLoader.includes('media="print"') || fontLoader.includes("onload=")) {
  fail("font link attributes must stay stable for Swup HeadPlugin outerHTML matching");
}
if (fontLoader.includes("<noscript")) {
  fail("ordinary font stylesheets already support no-JS and must not be duplicated by DOMParser during PJAX");
}
if (!read("templates/modules/index/layout.html").includes("modules/font-loader :: index-fonts")) {
  fail("index layout must declare its title/subtitle fonts in the incoming document head");
}
for (const file of ["templates/modules/theme-script.html", "templates/modules/index/header/title.html"]) {
  const source = read(file);
  if (
    source.includes('createElement("link")') ||
    source.includes("createElement('link')") ||
    source.includes("loadedFonts")
  ) {
    fail(`${file}: dynamic font injection is incompatible with Swup HeadPlugin`);
  }
}
for (const [file, marker] of [
  ["templates/modules/bangumi/layout.html", 'id="bangumi-bg-container"'],
  ["templates/modules/douban/layout.html", 'class="douban-bg pointer-events-none fixed inset-0 z-0"'],
  ["templates/modules/steam/layout.html", 'x-data="{ gameBg: null }"'],
]) {
  const source = read(file);
  const extrasIndex = source.indexOf('id="swup-page-extras"');
  const markerIndex = source.indexOf(marker);
  if (extrasIndex === -1 || markerIndex < extrasIndex) {
    fail(`${file}: page-specific background/state must live inside #swup-page-extras`);
  }
}
if (!read("src/pages/steam/steam.css").includes('[data-color-scheme="light"] .steam-game-bg>img')) {
  fail("Steam PJAX background must keep its light color-scheme contrast rule");
}
const postFooter = read("templates/modules/post/article-footer.html");
if (
  !hasTagAttributes(postFooter, "halo:comment", {
    group: "content.halo.run",
    kind: "Post",
  }) ||
  !postFooter.includes("name=${post.metadata.name}")
) {
  fail("Restricted Reading comment unlock requires the canonical Post comment subject");
}
const singlePageContent = read("templates/modules/page/content.html");
if (
  !hasTagAttributes(singlePageContent, "halo:comment", {
    group: "content.halo.run",
    kind: "SinglePage",
  }) ||
  !singlePageContent.includes("name=${singlePage.metadata.name}") ||
  !singlePageContent.includes("singlePage.spec.allowComment")
) {
  fail("Restricted Reading comment unlock requires the canonical enabled SinglePage comment subject");
}
const maintenance = read("templates/maintenance.html");
for (const marker of [
  'id="maintenance-page"',
  'data-plugin-contract="maintenance@1.1.0"',
  "th:text=\"${#strings.defaultString(title, '站点正在维护')}\"",
  "th:utext=\"${#strings.defaultString(description, '我们正在进行短暂维护，请稍后再来。')}\"",
]) {
  if (!maintenance.includes(marker)) fail(`Maintenance 1.1.0 template marker is missing: ${marker}`);
}
if (maintenance.includes("/assets/js/main.js")) {
  fail("Maintenance page must not depend on the theme PJAX application");
}
if (!maintenance.includes('class="maintenance-home"') || !maintenance.includes('th:href="@{/}"')) {
  fail("Maintenance page must provide a keyboard-accessible home link");
}

const postCss = read("src/pages/post/post.css");
for (const variable of [
  "--halo-asw-primary-1-color",
  "--halo-asw-text-1-color",
  "--halo-asw-muted-1-color",
  "--halo-asw-base-rounded",
]) {
  if (!postCss.includes(`${variable}:`)) fail(`AI Assistant 1.5.1 summary variable is missing: ${variable}`);
}
if (!postCss.includes('html[data-color-scheme="dark"] ai-summary-widget')) {
  fail("AI Assistant summary dark color-scheme selector is missing");
}

const sidebar = read("templates/modules/widgets/sidebar.html");
if (
  !sidebar.includes("widgetType eq 'bangumi_card' and pluginFinder.available('plugin-bilibili-bangumi', '>=1.4.0')")
) {
  fail("Bangumi sidebar widget must not render when plugin-bilibili-bangumi is unavailable or disabled");
}
if (!sidebar.includes("widgetType eq 'online_stats' and pluginFinder.available('online', '>=1.0.5')")) {
  fail("Online stats widget must not render when plugin-online is unavailable or disabled");
}

const pageVerifier = read("scripts/verify-plugin-pages.mjs");
const versionVerifier = read("scripts/check-plugin-versions.mjs");
for (const marker of [
  'name: "Dishes External Route"',
  "data-dishes-site-title",
  "dishes-csrf-header",
  "window.__DISHES_CSRF__",
  "window.__DISHES_PUBLIC_BASE__",
  "/plugins/dishes/assets/dishes-frontend/assets/index.css",
  "/plugins/dishes/assets/dishes-frontend/app.js",
  'name: "Schedule External Route"',
  "/apis/api.schedule.calendar.sunny.dev/v1alpha1/summary",
  'name: "Feed XML"',
  'name: "Sitemap XML"',
  'name: "Robots Sitemap"',
]) {
  if (!pageVerifier.includes(marker)) fail(`external plugin route smoke marker is missing: ${marker}`);
}
if (!pageVerifier.includes("process.env.HALO_BASE_URL || process.env.SMOKE_BASE_URL")) {
  fail("plugin page verifier must use the same HALO_BASE_URL contract as the version verifier");
}
if (!versionVerifier.includes("outsideThemeContract: untracked")) {
  fail("plugin version verifier must report installed plugins outside the theme contract matrix");
}
for (const { env, markers, matchAll = false } of [
  {
    env: "VOTE_PAGE_URL",
    markers: ["<vote-block", "/plugins/vote/assets/static/vote.iife.js"],
    matchAll: true,
  },
  { env: "TEXT_DIAGRAM_PAGE_URL", markers: ["<text-diagram"] },
  { env: "CONTACT_FORM_PAGE_URL", markers: ["<halo-contact-form"] },
  { env: "AI_SUMMARY_PAGE_URL", markers: ["<ai-summary-widget"] },
  { env: "SHIKI_PAGE_URL", markers: ["<shiki-code", "shiki-code.js?version="], matchAll: true },
  {
    env: "HYPERLINK_CARD_PAGE_URL",
    markers: [
      "<hyperlink-card",
      "<hyperlink-inline-card",
      "/plugins/editor-hyperlink-card/assets/static/index.iife.js?version=1.9.2",
    ],
    matchAll: true,
  },
  {
    env: "LOTTERY_PAGE_URL",
    markers: ["<lottery-card", "/plugins/lottery/assets/static/lottery-card.js?version=1.0.2"],
    matchAll: true,
  },
  {
    env: "RESTRICTED_READING_PAGE_URL",
    markers: [
      "<content-restrict-widget",
      "/plugins/restricted-reading/assets/static/content-restrict-widget.iife.js?version=1.8.1",
    ],
    matchAll: true,
  },
  {
    env: "MAINTENANCE_PAGE_URL",
    markers: ['id="maintenance-page"', 'data-plugin-contract="maintenance@1.1.0"'],
    matchAll: true,
  },
]) {
  const start = pageVerifier.indexOf(`env: "${env}"`);
  const end = start === -1 ? -1 : pageVerifier.indexOf("\n  },", start);
  const block = start === -1 || end === -1 ? "" : pageVerifier.slice(start, end);
  if (!block) {
    fail(`plugin page verifier check is missing: ${env}`);
    continue;
  }
  for (const marker of markers) {
    const literals = [JSON.stringify(marker), `'${marker.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`];
    if (!literals.some((literal) => block.includes(literal))) {
      fail(`${env}: expected marker is missing: ${marker}`);
    }
  }
  if (matchAll && !block.includes('match: "all"')) {
    fail(`${env}: all markers must be required`);
  }
}
if (!pageVerifier.includes("function stripNonRenderedMarkup(html)")) {
  fail("plugin page verifier must exclude comments, scripts and styles before matching real custom elements");
}
const contactLoaderStart = pageVerifier.indexOf('name: "Contact Form Loader Reference"');
const contactLoaderEnd = contactLoaderStart === -1 ? -1 : pageVerifier.indexOf("\n  },", contactLoaderStart);
const contactLoaderBlock =
  contactLoaderStart === -1 || contactLoaderEnd === -1 ? "" : pageVerifier.slice(contactLoaderStart, contactLoaderEnd);
if (!contactLoaderBlock.includes("/plugins/PluginContactForm/assets/static/contact-form-loader.iife.js?version=")) {
  fail("Contact Form loader reference check is missing");
}

const settingsLines = read("settings.yaml").split(/\r?\n/);
for (let index = 0; index < settingsLines.length; index += 1) {
  const match = settingsLines[index].match(/^(\s+)if:\s/);
  if (!match) continue;
  const propertyIndent = match[1].length;
  const nodeIndent = propertyIndent - 2;
  let start = index - 1;
  while (start >= 0) {
    const indent = settingsLines[start].match(/^\s*/)?.[0].length || 0;
    if (indent === nodeIndent && /^\s*-\s+(\$formkit|\$el|\$cmp):/.test(settingsLines[start])) break;
    start -= 1;
  }
  if (start < 0) continue;

  let end = index + 1;
  while (end < settingsLines.length) {
    const indent = settingsLines[end].match(/^\s*/)?.[0].length || 0;
    if (indent <= nodeIndent && settingsLines[end].trim()) break;
    end += 1;
  }
  const keyPattern = new RegExp(`^\\s{${propertyIndent}}key:\\s+`);
  if (!settingsLines.slice(start + 1, end).some((lineValue) => keyPattern.test(lineValue))) {
    fail(`settings.yaml:${index + 1}: conditional FormKit node is missing a stable key`);
  }
}

const packageVersion = JSON.parse(read("package.json")).version;
const templateFiles = listFiles(path.join(root, "templates"))
  .filter((file) => file.endsWith(".html"))
  .filter((file) => !file.includes(`${path.sep}templates${path.sep}assets${path.sep}`));
for (const file of templateFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(`?v=${packageVersion}`) || source.includes(`+ '${packageVersion}'`)) {
    fail(`${path.relative(root, file)}: cache version must use theme.spec.version`);
  }
  if (source.includes("PluginMoments v1.16.0")) {
    fail(`${path.relative(root, file)}: stale PluginMoments contract comment`);
  }
}

if (failures.length > 0) {
  console.error("Plugin/source contract verification failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Plugin/source contracts verified: ${pluginContracts.length} plugins`);

function hasTagAttributes(source, tagName, attributes) {
  const tags = source.match(new RegExp(`<${tagName}\\b[^>]*>`, "g")) || [];
  return tags.some((tag) => Object.entries(attributes).every(([name, value]) => tag.includes(`${name}="${value}"`)));
}

function listFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(fullPath));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}
