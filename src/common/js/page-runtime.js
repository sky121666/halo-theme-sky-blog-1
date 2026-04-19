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

/**
 * 页面 JS 就绪信号。
 * 在 Alpine.data() 组件注册完毕后调用，通知 main.js 可以恢复 Alpine。
 */
export function notifySwupPageReady() {
  window.__completeSwupPageInit?.();
}
