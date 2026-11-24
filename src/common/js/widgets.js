import { mountTabIndicator } from "./tab-indicator.js";
import { mountArchiveSidebar } from "./archive-sidebar.js";

const widgetRegistrations = new Set();

export async function prepareWidgets(doc, alpine) {
  const requested = Array.from(doc.querySelectorAll("[data-widget]"),
    (element) => element.dataset.widget).filter((name) => !widgetRegistrations.has(name));
  if (!requested.length) return;
  const { registerGithubHeatmap, registerArticleHeatmap, registerSteamCard } = await import("./widget-components.js");
  const widgets = {
    githubHeatmap: registerGithubHeatmap,
    articleHeatmap: registerArticleHeatmap,
    steamCard: registerSteamCard,
  };
  for (const name of new Set(requested)) {
    if (!Object.hasOwn(widgets, name) || widgetRegistrations.has(name)) continue;
    widgets[name](alpine);
    widgetRegistrations.add(name);
  }
}

export function mountWidgets(root, signal) {
  for (const group of root.querySelectorAll("[data-motion-tabs]")) mountTabIndicator(group, signal);
  for (const widget of root.querySelectorAll(".archive-sidebar-widget")) {
    mountArchiveSidebar(widget, signal);
  }
}
