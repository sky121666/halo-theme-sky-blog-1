import { skyDebug } from './debug.js';

export function runPageInit(init) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
    return;
  }

  init();
}

/**
 * 注册可重复进入的页面生命周期。
 *
 * 页面入口是 ES Module，同一个模块在 PJAX 返回时不会再次执行。因此这里把
 * mount 持久注册到 SkyPjax，由每次 page-load 重新调用，并在离页前执行上一次
 * mount 返回的 cleanup。
 *
 * @param {(detail?: object) => void | (() => void)} mount
 * @param {{ entry?: string }} [options]
 * @returns {() => void}
 */
export function registerPageLifecycle(mount, options = {}) {
  let cleanup = null;
  let mounted = false;

  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    const task = cleanup;
    cleanup = null;
    if (typeof task !== 'function') {
      skyDebug.event('page', 'unmount', { entry: options.entry || 'anonymous', cleanup: false });
      return;
    }

    try {
      task();
      skyDebug.event('page', 'unmount', { entry: options.entry || 'anonymous', cleanup: true });
    } catch (error) {
      skyDebug.error('page', 'cleanup failed', { entry: options.entry || 'anonymous', error });
    }
  };

  const remount = (detail) => {
    unmount();
    if (options.entry && !isPageEntryActive(options.entry)) {
      skyDebug.event('page', 'mount:skip', { entry: options.entry, reason: 'entry-inactive' });
      return;
    }
    const nextCleanup = mount(detail);
    cleanup = typeof nextCleanup === 'function' ? nextCleanup : null;
    mounted = true;
    skyDebug.event('page', 'mount', {
      entry: options.entry || 'anonymous',
      pjax: detail?.pjax === true,
      cleanup: Boolean(cleanup),
    });
  };

  if (window.SkyPjax?.onPage && window.SkyPjax?.onCleanup) {
    // main.js 会在首屏 DOM ready 以及每次 PJAX DOM 替换后触发 _runPage。
    // 禁用 immediate，避免模块首次经 PJAX 注入时拿旧页面 currentPage 重复 mount。
    window.SkyPjax.onPage(remount, { immediate: false });
    window.SkyPjax.onCleanup(unmount);
  } else {
    runPageInit(remount);
    document.addEventListener('sky:page-cleanup', unmount);
  }

  return unmount;
}

function isPageEntryActive(entry) {
  const expectedPath = `/${entry}.js`;
  return Array.from(document.querySelectorAll('#swup-scripts script[src]')).some((script) => {
    try {
      return new URL(script.src, window.location.href).pathname.endsWith(expectedPath);
    } catch {
      return false;
    }
  });
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
  window.__completeSwupPageInit?.({ source: 'module' });
}
