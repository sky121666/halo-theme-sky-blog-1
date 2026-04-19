/**
 * Sky Blog Theme - 主应用入口文件
 *
 * 功能：统一管理所有CSS和JS资源的导入和初始化
 * 职责：
 *   1. 导入所有公共样式文件
 *   2. 导入Alpine.js及其组件
 *   3. 初始化全局工具函数
 *   4. 启动Alpine.js响应式系统
 *   5. 初始化 swup PJAX（页面无刷新切换）
 *
 * 构建产物：templates/assets/js/main.js + templates/assets/css/main.css
 *
 * @author Sky
 * @version 1.0.0
 */

/* ===================================================
 * 样式文件导入
 * 按加载顺序排列，确保样式优先级正确
 * ==================================================*/
import './css/tailwind.css';        // Tailwind CSS 4 + DaisyUI 5 配置
import './css/nav-enhancements.css'; // 导航栏增强样式
import './css/base.css';             // 全局基础样式和变量
import './css/floating-dock.css';    // 悬浮控制栏样式
import './css/loading-screen.css';   // 页面加载屏幕
import './css/toc.css';              // TOC 目录导航公共样式

/* ===================================================
 * 脚本文件导入
 * ==================================================*/
import './js/base.js';  // 全局工具函数和事件处理

/* ===================================================
 * Alpine.js 响应式框架
 * ==================================================*/
import { initializeAll } from './js/alpine-modules.js';  // Alpine组件注册
import Alpine from 'alpinejs';                           // Alpine核心

// 挂载Alpine到全局对象，供模板使用
window.Alpine = Alpine;

/**
 * Alpine.js 初始化钩子
 * 在Alpine启动前注册所有组件
 */
document.addEventListener('alpine:init', () => {
  initializeAll();
});

// 启动Alpine响应式系统
Alpine.start();

/* ===================================================
 * Swup PJAX — 页面无刷新切换
 * 受 theme-script.html 中 window.__skyPjaxEnabled 控制
 * ==================================================*/
import Swup from 'swup';
import SwupHeadPlugin from '@swup/head-plugin';
import SwupScriptsPlugin from '@swup/scripts-plugin';

if (window.__skyPjaxEnabled !== false) {

  const swup = new Swup({
    containers: ['#swup', '#swup-scripts'],
    // Only wait for the dedicated PJAX containers. The default selector
    // (`[class*="transition-"]`) matches decorative homepage animations
    // like the typewriter subtitle and can stall navigation for seconds.
    animationSelector: '#swup, .transition-fade',
    requestHeaders: {},
    ignoreVisit: (url) => {
      return (
        url.startsWith('/login') ||
        url.startsWith('/signup') ||
        url.startsWith('/uc') ||
        url.startsWith('/console') ||
        url.startsWith('/logout')
      );
    },
    plugins: [
      new SwupHeadPlugin({
        persistAssets: true,
        persistTags: 'link[rel="stylesheet"][href*="main.css"]',
      }),
      new SwupScriptsPlugin({ head: false, body: true, optin: true }),
    ],
  });

  window.__swup = swup;

  // 是否已收到页面就绪信号（内联脚本同步执行时设置）
  let _currentSignaled = false;

  /**
   * 内联脚本信号入口（friends 等无独立页面 JS 的页面使用）。
   * module JS 内 notifySwupPageReady() 也调用此函数，但 load 事件才是主要触发源。
   */
  window.__completeSwupPageInit = () => {
    _currentSignaled = true;
  };

  /** Alpine 恢复动作，rAF 后执行确保 DOM paint 完成 */
  function _resumeAlpine() {
    requestAnimationFrame(() => {
      if (window.Alpine?.flushAndStopDeferringMutations) {
        Alpine.flushAndStopDeferringMutations();
      } else {
        const container = document.getElementById('swup');
        if (container && window.Alpine) Alpine.initTree(container);
      }
      window.SkyEvents?.onPageLoad();
    });
  }

  swup.hooks.on('visit:start', () => {
    if (typeof window.__skyMusicSave === 'function') window.__skyMusicSave();
    if (typeof window.__pageCleanup === 'function') {
      window.__pageCleanup();
      window.__pageCleanup = null;
    }
  });

  // ① DOM 替换前：重置状态，暂停 Alpine MutationObserver，销毁旧页面组件树
  swup.hooks.before('content:replace', () => {
    _currentSignaled = false;
    if (window.Alpine?.deferMutations) Alpine.deferMutations();
    const container = document.getElementById('swup');
    if (container && window.Alpine) Alpine.destroyTree(container);
  });

  // ② DOM 替换后（ScriptsPlugin 已注入新脚本）
  //
  //  【信号机制】使用 script.load 事件而非 notifySwupPageReady() 作为主触发：
  //    - 首次导航（模块未缓存）：下载 → 执行（Alpine.data 注册完）→ load 触发 ✅
  //    - 再次导航（模块已缓存）：ES 模块不重新执行，但 Alpine.data 已在首次执行时
  //      注册并持久存在 → load 事件仍快速触发 ✅
  //    - 内联脚本页面（friends 等）：同步执行已置 _currentSignaled=true → 快速路径 ✅
  //
  //  【不阻塞 swup】handler 不返回 Promise → swup 立即继续 content:scroll / page:view
  swup.hooks.on('content:replace', () => {
    // 快速路径：内联脚本同步执行已发信号
    if (_currentSignaled) {
      _resumeAlpine();
      return;
    }

    // 找到 ScriptsPlugin 刚注入的 type="module" 脚本
    const swupScriptsEl = document.getElementById('swup-scripts');
    const moduleScripts = swupScriptsEl
      ? Array.from(swupScriptsEl.querySelectorAll('script[type="module"][src]'))
      : [];

    if (moduleScripts.length === 0) {
      // 无 module 脚本且未收到内联信号（不应发生，兜底保护）
      setTimeout(_resumeAlpine, 100);
      return;
    }

    // 监听所有 module 脚本的 load/error 事件，全部 settled 后恢复 Alpine
    let resumed = false;
    function tryResume() {
      if (!resumed) { resumed = true; _resumeAlpine(); }
    }

    let pending = moduleScripts.length;
    moduleScripts.forEach((script) => {
      const settle = () => { if (--pending <= 0) tryResume(); };
      script.addEventListener('load',  settle, { once: true });
      script.addEventListener('error', settle, { once: true });
    });

    // 5s 安全兜底（网络极慢 / load 事件未触发等极端情况）
    setTimeout(tryResume, 5000);

    // 不显式 return Promise → swup 立即继续，不阻塞导航管线
  }, { after: true });

} else {
  // PJAX 已关闭 — 设置 noop 桩，防止页面 JS 调用报错
  window.__swup = null;
  window.__completeSwupPageInit = () => {};
}
