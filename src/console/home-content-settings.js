import { getNode } from "@formkit/core";
import { defineComponent, h, onBeforeUnmount, Teleport, watch } from "vue";

// These minimum versions match the homepage widget templates.
const homePlugins = {
  moments: ["PluginMoments", [1, 16, 1]],
  photos: ["PluginPhotos", [2, 1, 1]],
  links: ["PluginLinks", [2, 2, 1]],
  docs: ["plugin-docsme", [1, 4, 0]],
};

function pluginMessage(plugin, minimumVersion) {
  if (!plugin) return "插件未安装";
  if (plugin.spec?.enabled === false) return "插件已停用";
  if (plugin.status?.phase !== "STARTED") return "插件未启动";

  const version = plugin.spec?.version?.match(/^v?(\d+)\.(\d+)\.(\d+)(-|\+|$)/);
  if (version) {
    const difference = minimumVersion.map((part, index) => Number(version[index + 1]) - part).find(Boolean);
    if (difference < 0 || (!difference && version[4] === "-")) return "插件版本过低";
  }
  return "";
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export const SkyBlogHomeContentStatus = defineComponent({
  props: { active: Boolean, checkGithub: Boolean, stateId: String },
  setup(props) {
    const controller = new AbortController();
    let requestedPlugins = false;
    let requestedGithub = false;

    function update(patch) {
      if (controller.signal.aborted) return;
      const state = getNode(props.stateId);
      if (state) void state.input({ ...state.value, ...patch }, false);
    }

    watch(
      () => [props.active, props.checkGithub],
      ([active, checkGithub]) => {
        if (!active) return;
        if (!requestedPlugins) {
          requestedPlugins = true;
          void fetchJson("/apis/api.console.halo.run/v1alpha1/plugins?size=0", controller.signal)
            .then(({ items, last }) => {
              if (!Array.isArray(items) || last !== true) return {};
              const plugins = new Map(items.map((plugin) => [plugin.metadata.name, plugin]));
              const messages = Object.entries(homePlugins).map(([key, [name, minimumVersion]]) => [
                key,
                pluginMessage(plugins.get(name), minimumVersion),
              ]);
              return Object.fromEntries(messages);
            })
            .catch(() => ({}))
            .then((messages) => update({ ...messages, pluginsLoaded: true }));
        }
        if (checkGithub && !requestedGithub) {
          requestedGithub = true;
          void fetchJson("/apis/api.console.halo.run/v1alpha1/themes/theme-sky-blog-1/json-config", controller.signal)
            .then(({ general }) => update({ githubConfigured: Boolean(general?.github?.username?.trim()) }))
            .catch(() => {});
        }
      },
      { immediate: true, flush: "post" },
    );

    onBeforeUnmount(() => controller.abort());
    return () => null;
  },
});

export const SkyBlogHomeTabOptions = defineComponent({
  setup(_, { slots }) {
    // Display the tab controls with the article and moment settings, keeping their original FormKit parent.
    return () => h(Teleport, { to: "#sky-home-tab-options", defer: true }, slots.default?.());
  },
});
