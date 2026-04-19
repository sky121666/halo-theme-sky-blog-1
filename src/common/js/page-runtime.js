export function runPageInit(init) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
    return;
  }

  init();
}

export function registerAlpinePageComponents(register) {
  if (window.Alpine) {
    register(window.Alpine);
    return;
  }

  document.addEventListener('alpine:init', () => {
    if (window.Alpine) {
      register(window.Alpine);
    }
  }, { once: true });
}

export function notifySwupPageReady() {
  if (typeof window.__completeSwupPageInit === 'function') {
    window.__completeSwupPageInit();
  }
}
