const groupIds = ["nav", "widgets", "home", "reading", "discovery", "personal", "integration", "system"];
const pageGroups = { "home-page": "index", "post-page": "article" };
const geometryDefaults = { offset: 2, blur: 8, spread: 0 };
const geometryPatterns = { offset: /^-?(?:[0-9]|1[0-6])$/, blur: /^(?:[0-9]|[1-3][0-9]|40)$/, spread: /^(?:[0-9]|1[0-2])$/ };
const defaultStates = { default: 100, hover: 125, pressed: 85, selected: 135, focus: 120 };
const percentPattern = /^(?:[0-9]{1,2}|1[0-9]{2}|200)$/;
const colorPattern = /^#[0-9a-f]{6}$/i;

function readGroup(data, key) {
  return JSON.parse(data[key] ?? "{}");
}

function boundedValues(defaults, values, patternForKey) {
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [
    key,
    patternForKey(key).test(values?.[key]) ? Number(values[key]) : fallback,
  ]));
}

function resolveAppearance(source, inherited) {
  const ownColor = ["primary", "neutral", "custom"].includes(source.color_mode);
  const appearance = {
    color_mode: ownColor ? source.color_mode : inherited.color_mode,
    strength: percentPattern.test(source.strength) ? Number(source.strength) : inherited.strength,
    advanced_geometry: source.advanced_geometry === true || inherited.advanced_geometry,
    geometry: boundedValues(
      inherited.geometry,
      source.advanced_geometry === true ? source.geometry : undefined,
      (key) => geometryPatterns[key],
    ),
  };
  const inheritPalette = !ownColor && inherited.color_mode === "custom";
  for (const field of ["light_custom_color", "dark_custom_color"]) {
    if (inheritPalette) appearance[field] = inherited[field];
    else if (colorPattern.test(source[field])) appearance[field] = source[field];
    else if (ownColor && source.color_mode === "custom") appearance[field] = "";
    else appearance[field] = inherited[field];
  }
  return appearance;
}

function resolveInteraction(source, inherited) {
  if (!["standard", "rest", "interactive", "custom"].includes(source.state_profile)) return inherited;
  return {
    state_profile: source.state_profile,
    states: boundedValues(defaultStates, source.states, () => percentPattern),
  };
}

function resolveProfile(source, inherited, interaction = source) {
  return {
    appearance: resolveAppearance(source, inherited.appearance),
    interaction: resolveInteraction(interaction, inherited.interaction),
  };
}

/** Convert the raw Halo ConfigMap groups using the supported targets from the new schema. */
export function migrateVisualGlow(data, targets) {
  const visual = readGroup(data, "visual");
  const pageConfig = {
    index: readGroup(data, "index"),
    article: readGroup(data, "article"),
  };
  const global = resolveProfile(visual.card_base ?? {}, {
    appearance: {
      color_mode: "neutral",
      light_custom_color: "#6366f1",
      dark_custom_color: "#a5b4fc",
      strength: 100,
      advanced_geometry: false,
      geometry: geometryDefaults,
    },
    interaction: { state_profile: "standard", states: defaultStates },
  }, visual.interaction ?? {});

  const catalog = new Set(targets.map((target) => target.value));
  const profiles = new Map();
  if (Array.isArray(visual.components)) {
    for (const row of visual.components) {
      if (!catalog.has(row?.id) || profiles.has(row.id) || !["custom", "off"].includes(row.mode)) continue;
      const { id, mode, appearance, interaction } = row;
      profiles.set(id, { id, mode, ...(appearance && { appearance }), ...(interaction && { interaction }) });
    }
  }

  for (const { value: id, owner: group } of targets) {
    if (profiles.has(id)) continue;
    const page = pageGroups[id];
    const legacy = page ? pageConfig[page].card_glow_override : visual[id];
    if (!legacy || !["custom", "off"].includes(legacy.mode)) continue;

    const owner = page ? visual[group] : undefined;
    const inherited = owner?.mode === "custom" ? resolveProfile(owner.appearance ?? {}, global) : global;
    const profile = legacy.mode === "custom" || legacy.appearance
      ? resolveProfile(legacy.appearance ?? {}, inherited)
      : {};
    const mode = visual.card_base?.enabled === false ? "off" : legacy.mode;
    profiles.set(id, { id, mode, ...profile });
  }

  for (const groupId of groupIds) delete visual[groupId];
  const migrated = { ...data, visual: JSON.stringify({ ...visual, components: [...profiles.values()] }) };
  for (const [key, group] of Object.entries(pageConfig)) {
    if (!Object.hasOwn(group, "card_glow_override")) continue;
    delete group.card_glow_override;
    migrated[key] = JSON.stringify(group);
  }
  return migrated;
}
