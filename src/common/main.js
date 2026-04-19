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
  window.__swupPendingInit = false;

  window.__completeSwupPageInit = () => {
    clearTimeout(window.__swupInitTimeout);
    if (!window.__swupPendingInit) {
      return;
    }

    window.__swupPendingInit = false;

    requestAnimationFrame(() => {
      if (window.Alpine?.flushAndStopDeferringMutations) {
        Alpine.flushAndStopDeferringMutations();
      } else {
        const container = document.getElementById('swup');
        if (container && window.Alpine) {
          Alpine.initTree(container);
        }
      }

      if (window.SkyEvents) {
        window.SkyEvents.onPageLoad();
      }
    });
  };

  swup.hooks.on('visit:start', () => {
    if (typeof window.__skyMusicSave === 'function') {
      window.__skyMusicSave();
    }
    if (typeof window.__pageCleanup === 'function') {
      window.__pageCleanup();
      window.__pageCleanup = null;
    }
  });

  swup.hooks.before('content:replace', () => {
    window.__swupPendingInit = true;
    if (window.Alpine?.deferMutations) {
      Alpine.deferMutations();
    }
    const container = document.getElementById('swup');
    if (container && window.Alpine) {
      Alpine.destroyTree(container);
    }

    clearTimeout(window.__swupInitTimeout);
    window.__swupInitTimeout = setTimeout(() => {
      if (window.__swupPendingInit) {
        console.warn('[swup] __completeSwupPageInit 超时，自动恢复 Alpine');
        window.__completeSwupPageInit();
      }
    }, 3000);
  });

} else {
  // PJAX 已关闭 — 设置 noop 桩，防止页面 JS 调用报错
  window.__swup = null;
  window.__swupPendingInit = false;
  window.__completeSwupPageInit = () => {};
}
