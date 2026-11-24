import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const sidebarPages = [
  ["index"], ["article"], ["category_settings", "category"], ["tag_settings", "tag"],
  ["archive_settings", "archive"], ["author_settings", "author"], ["links_settings", "links"],
  ["moments_settings", "moments"], ["equipment_settings", "equipment"],
];
const dockPages = [
  ...sidebarPages,
  ["about_settings", "about"],
  ["photos_settings", "photos"],
];
const appearanceKeys = ["default_theme", "light_theme", "dark_theme"];
const coverKeys = ["list_style", "cover_fallback_enable", "cover_fallback_mode", "cover_fallback_url"];
const defaultPlatforms = ["wechat", "weibo", "x", "qq"];

function take(source, key) {
  const value = source[key];
  delete source[key];
  return value;
}

function takeFields(source, keys) {
  return Object.fromEntries(
    keys.filter(key => Object.hasOwn(source, key)).map(key => [key, take(source, key)]),
  );
}

function dockOverride(host, config, preservePageEnable = false) {
  if (config?.enable_custom_dock !== true) return undefined;
  return {
    host,
    display: preservePageEnable ? "on" : "inherit",
    style: ["bottom", "side"].includes(config.dock_style) ? config.dock_style : "inherit",
    override_menu: true,
    dock_menu: config.post_dock_menu || config.dock_menu || "primary",
    back_to_top: config.enable_back_to_top === false ? "off" : "on",
  };
}

function normalizeIdList(owner, field, idField) {
  if (!Array.isArray(owner?.[field])) return;
  const ids = owner[field]
    .map(item => typeof item === "string" ? item : item?.[idField])
    .filter(id => typeof id === "string" && id !== "");
  owner[field] = [...new Set(ids)];
}

function normalizeDisplayModes(rows, fields) {
  for (const row of rows ?? []) {
    for (const field of fields) {
      if (typeof row?.[field] === "boolean") {
        row[field] = row[field] ? "on" : "off";
      }
    }
  }
}

function normalizeCurrentSettings(config) {
  const { components, pages } = config;
  normalizeIdList(components.sidebar_settings, "widgets", "widget");
  for (const row of [...(components.sidebar_suites ?? []), ...(components.sidebar_overrides ?? [])]) {
    normalizeIdList(row, "widgets", "widget");
  }
  normalizeIdList(pages.index?.index_layout, "modules", "id");
  normalizeDisplayModes(components.sidebar_overrides, ["display"]);
  normalizeDisplayModes(components.dock_suites, ["back_to_top"]);
  normalizeDisplayModes(components.dock_overrides, ["display", "back_to_top"]);
  return config;
}

export function migrateThemeSettings(current) {
  const config = structuredClone(current);
  delete config.music;
  if (config.components) delete config.components.music;

  if (config.components && config.pages && config.plugins) return normalizeCurrentSettings(config);

  const general = config.general ?? {};
  const visual = config.visual ?? {};
  const nav = take(config, "nav") ?? {};
  const about = config.about_settings ?? {};
  const github = about.github ?? {};

  if (about.profile) general.profile = take(about, "profile");
  general.github = takeFields(github, ["username", "stats_host", "locale", "stats_theme"]);
  visual.global_background = take(general, "global_background");
  visual.font_settings = take(general, "font_settings");
  visual.theme_settings = takeFields(nav.theme_settings ?? {}, appearanceKeys);

  const components = {
    nav,
    footer: take(config, "footer") ?? {},
    sidebar_settings: take(general, "sidebar_settings") ?? {},
    sidebar_suites: [],
    sidebar_overrides: [],
    floating_dock: take(general, "floating_dock") ?? {},
    dock_suites: [],
    dock_overrides: [],
    share_settings: {},
    share_suites: [],
    share_overrides: [],
    post_lists: {},
  };

  const archive = config.archive_settings?.sidebar_settings;
  if (archive?.archive_sidebar_config) {
    components.sidebar_settings.archive_sidebar_config = take(archive, "archive_sidebar_config");
  }
  if (config.bangumi_settings?.card_settings) {
    components.sidebar_settings.bangumi_card_config = take(config.bangumi_settings, "card_settings");
  }

  for (const [key, host = key] of sidebarPages) {
    if (!config[key]) continue;
    const sidebar = take(config[key], "sidebar_settings");
    if (!sidebar) continue;
    if (sidebar.show_sidebar === false) {
      components.sidebar_overrides.push({ host, display: "off" });
    }
    if (sidebar.enable_custom_sidebar !== true) continue;
    const row = components.sidebar_overrides.find(item => item.host === host);
    const settings = {
      position: sidebar.sidebar_position || "right",
      override_widgets: Array.isArray(sidebar.sidebar_widgets),
      widgets: sidebar.sidebar_widgets ?? [],
    };
    if (row) Object.assign(row, settings);
    else components.sidebar_overrides.push({ host, display: "inherit", ...settings });
  }

  for (const [key, host = key] of dockPages) {
    if (!config[key]) continue;
    let old;
    if (key === "article") {
      const article = config[key].dock_settings ?? {};
      old = takeFields(article, ["enable_custom_dock", "dock_style", "post_dock_menu", "enable_back_to_top"]);
    } else {
      old = take(config[key], "floating_dock");
    }
    const override = dockOverride(host, old, key !== "article");
    if (override) components.dock_overrides.push(override);
  }
  for (const [name, host] of [["docs_settings", "docsList"], ["doc_catalog_settings", "docsCatalog"], ["doc_settings", "docsBody"]]) {
    const document = config.docsme?.[name];
    if (!document) continue;
    const old = takeFields(document, ["enable_custom_dock", "dock_style", "dock_menu", "enable_back_to_top"]);
    const override = dockOverride(host, old);
    if (override) components.dock_overrides.push(override);
  }

  const platforms = [
    [config.article?.post_interaction, "article"],
    [config.moments_settings, "momentsDetail"],
    [config.docsme?.doc_settings, "docsBody"],
  ].map(([owner, host]) => [host, owner ? take(owner, "share_settings")?.share_item_ids : undefined]);
  const globalPlatforms = platforms[0][1] ?? defaultPlatforms;
  components.share_settings.share_item_ids = globalPlatforms;
  for (const [host, ids] of platforms) {
    if (ids != null && JSON.stringify(ids) !== JSON.stringify(globalPlatforms)) {
      components.share_overrides.push({ host, share_item_ids: ids });
    }
  }

  components.post_lists.index = takeFields(config.index?.post_settings ?? {}, coverKeys);
  for (const [key, host] of [["category_settings", "category"], ["tag_settings", "tag"]]) {
    if (!config[key]) continue;
    components.post_lists[host] = {
      ...takeFields(config[key].basic_info ?? {}, ["list_style"]),
      cover_fallback: take(config[key], "cover_fallback"),
    };
  }

  const pages = {};
  for (const [key, host] of [
    ["index", "index"], ["article", "article"], ["category_settings", "category"], ["tag_settings", "tag"],
    ["archive_settings", "archive"], ["author_settings", "author"], ["about_settings", "about"], ["auth", "auth"],
  ]) {
    const page = take(config, key);
    if (page) pages[host] = page;
  }
  const plugins = {};
  for (const [key, host] of [
    ["links_settings", "links"], ["photos_settings", "photos"], ["moments_settings", "moments"],
    ["docsme", "docsme"], ["bangumi_settings", "bangumi"], ["equipment_settings", "equipment"],
  ]) {
    const plugin = take(config, key);
    if (plugin) plugins[host] = plugin;
  }
  return normalizeCurrentSettings({ ...config, general, visual, components, pages, plugins });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = JSON.parse(await readFile(process.argv[2], "utf8"));
  const groups = source.kind === "ConfigMap"
    ? Object.fromEntries(Object.entries(source.data ?? {}).map(([key, value]) => [key, JSON.parse(value)]))
    : source;
  const migrated = migrateThemeSettings(groups);
  const output = source.kind === "ConfigMap"
    ? { ...source, data: Object.fromEntries(Object.entries(migrated).map(([key, value]) => [key, JSON.stringify(value)])) }
    : migrated;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
