const active = '[aria-current="page"], [aria-pressed="true"]';

export function mountTabIndicator(group, signal) {
  const indicator = document.createElement("span");
  indicator.className = "sky-tab-indicator";
  indicator.setAttribute("aria-hidden", "true");
  group.prepend(indicator);

  let frame = 0;
  function position(element = group.querySelector(active)) {
    if (!element || !element.isConnected) {
      indicator.hidden = true;
      return;
    }
    const container = group.getBoundingClientRect();
    const tab = element.getBoundingClientRect();
    indicator.hidden = tab.width === 0;
    indicator.style.setProperty("--tab-inline", tab.left - container.left + group.scrollLeft + "px");
    indicator.style.setProperty("--tab-block", tab.bottom - container.top + group.scrollTop - 2 + "px");
    indicator.style.setProperty("--tab-width", tab.width + "px");
  }
  const sync = () => {
    if (indicator.parentElement !== group) group.prepend(indicator);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => position());
  };
  const mutations = new MutationObserver(sync);
  mutations.observe(group, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-current", "aria-pressed"] });
  const resize = new ResizeObserver(sync);
  resize.observe(group);
  if (group.hasAttribute("data-motion-server-tabs")) {
    group.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      position(link);
    }, { signal });
    document.addEventListener("swup:visit:abort", sync, { signal });
  }
  signal.addEventListener("abort", () => {
    cancelAnimationFrame(frame);
    mutations.disconnect();
    resize.disconnect();
    indicator.remove();
  }, { once: true });
  position();
}
