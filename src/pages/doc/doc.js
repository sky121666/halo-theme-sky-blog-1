/**
 * 文档页脚本
 * 功能: 目录生成、版本选择器、图片懒加载
 */

import './doc.css';

// 导入公共文章内容脚本
import '../../static/js/article-content.js';

// 导入 TOC 公共工具函数
import {
  buildDynamicTocTree,
  createDynamicTocHTML,
  smoothScrollToHeading
} from '../../common/js/toc-utils.js';
import { notifySwupPageReady, runPageInit } from '../../common/js/page-runtime.js';

let _pageAbort = null;
let _tocObserver = null;

function getPageSignal() {
  return _pageAbort?.signal;
}

function on(target, type, handler, options = {}) {
  if (!target) return;
  const opts = { ...options };
  if (!Object.prototype.hasOwnProperty.call(opts, 'signal') && getPageSignal()) {
    opts.signal = getPageSignal();
  }
  target.addEventListener(type, handler, opts);
}

function isDocPage() {
  return Boolean(
    document.querySelector('.doc-layout') &&
    document.getElementById('article-content') &&
    document.getElementById('toc-nav')
  );
}

function cleanupDocPage() {
  _tocObserver?.disconnect();
  _tocObserver = null;
  _pageAbort?.abort();
  _pageAbort = null;
  document.body.style.overflow = '';
  window.openDocTocDrawer = undefined;
  window.closeDocTocDrawer = undefined;
  window.openDocSidebarDrawer = undefined;
  window.closeDocSidebarDrawer = undefined;
}

/**
 * 图片懒加载由 article-content.js 统一处理
 * TOC 函数已从 toc-utils.js 导入
 */

// 目录生成 (使用 Intersection Observer 优化)
function initTOC() {
  const tocNav = document.getElementById('toc-nav');
  const tocCard = document.getElementById('toc-card');
  const content = document.getElementById('article-content');

  if (!tocNav || !content) return;

  const allHeadings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (!allHeadings.length) {
    if (tocCard) tocCard.style.display = 'none';
    return;
  }

  const levels = Array.from(allHeadings, (h) => +h.tagName[1]);
  const minLevel = Math.min(...levels);
  const headings = Array.from(allHeadings).filter(
    (h) => +h.tagName[1] <= minLevel + 2
  );

  if (!headings.length) {
    if (tocCard) tocCard.style.display = 'none';
    return;
  }

  // 构建树形目录结构
  const tocTree = buildDynamicTocTree(headings, minLevel);
  const tocList = createDynamicTocHTML(tocTree, {
    onClick: (element) => smoothScrollToHeading(element, 80)
  });

  // 清空现有内容并生成HTML结构
  tocNav.innerHTML = '';
  tocNav.appendChild(tocList);

  // 点击事件已在 createDynamicTocHTML 中处理

  // 滚动高亮 (Intersection Observer)
  const links = tocNav.querySelectorAll('.toc-link');
  let currentActive = null;

  /**
   * 将活跃的 TOC 条目滚动到 .toc-container 的可见区域内
   * 使用 scrollIntoView + block:'nearest' 避免不必要的跳动
   */
  function scrollActiveTocItemIntoView(activeLink) {
    const container = tocNav.closest('.toc-container');
    if (!container) return;

    const linkRect = activeLink.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // 条目在容器上方不可见
    if (linkRect.top < containerRect.top) {
      activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    // 条目在容器下方不可见
    else if (linkRect.bottom > containerRect.bottom) {
      activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    // 已在可见区域内则不做任何操作
  }

  _tocObserver?.disconnect();
  _tocObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const headingId = entry.target.id;
          const activeLink = tocNav.querySelector(`.toc-link[data-heading-id="${headingId}"]`);
          if (activeLink && activeLink !== currentActive) {
            links.forEach((l) => l.classList.remove('active'));
            activeLink.classList.add('active');
            currentActive = activeLink;
            // 自动滚动目录容器，确保当前活跃项可见
            scrollActiveTocItemIntoView(activeLink);
          }
        }
      });
    },
    { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
  );

  headings.forEach((h) => _tocObserver.observe(h));
}

// 版本选择器
function initDropdowns() {
  on(
    document,
    'click',
    (e) => {
      document.querySelectorAll('.doc-version-dropdown.show').forEach((d) => {
        if (!d.closest('.doc-version-selector')?.contains(e.target)) {
          d.classList.remove('show');
        }
      });
    },
    { passive: true }
  );
}

// 侧边栏与 Footer 碰撞检测
function initSidebarFooterCollision() {
  const sidebar = document.querySelector('.doc-sidebar');
  const toc = document.querySelector('.doc-toc');
  const footer = document.querySelector('footer');
  const docLayout = document.querySelector('.doc-layout');

  if (!footer || (!sidebar && !toc)) return;

  // 获取导航栏高度，默认为 64
  let navHeight = 64;
  if (docLayout) {
    const val = getComputedStyle(docLayout).getPropertyValue('--doc-nav-height');
    if (val) navHeight = parseInt(val);
  } else {
    // 尝试从 root 获取或直接使用默认
    const val = getComputedStyle(document.documentElement).getPropertyValue('--doc-nav-height');
    if (val) navHeight = parseInt(val);
  }

  const offset = navHeight + 16; // nav + 1rem

  function updateSidebarPositions() {
    const footerRect = footer.getBoundingClientRect();

    // 计算 footer 顶部距离视口顶部的距离
    // 如果 footerRect.top < viewportHeight，说明 footer 已经进入视口（或在视口上方）

    [sidebar, toc].forEach((el) => {
      if (!el) return;

      const elHeight = el.offsetHeight;
      // 计算停止位置：Footer 顶部 - 1rem - 元素高度
      // 这是元素 top 允许的最大值（相对于视口）
      // footerRect.top 是 footer 顶部相对于视口的 Y 坐标
      const stopPositionTop = footerRect.top - 16 - elHeight;

      // 如果计算出的位置小于默认 offset（顶部固定位置），说明 footer 顶到了侧边栏
      if (stopPositionTop < offset) {
        el.style.top = `${stopPositionTop}px`;
      } else {
        // 否则保持在顶部固定位置
        if (el.style.top !== `${offset}px`) {
          el.style.top = `${offset}px`;
        }
      }
    });
  }

  // 使用 passive 事件和 requestAnimationFrame 优化性能
  let ticking = false;
  on(window, 'scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateSidebarPositions();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // 初始化及窗口大小改变时更新
  updateSidebarPositions();
  on(window, 'resize', updateSidebarPositions);
}

// 初始化抽屉
function initDrawers() {
  // 目录抽屉
  const tocOverlay = document.getElementById('doc-toc-overlay');
  const tocDrawer = document.getElementById('doc-toc-drawer');
  const tocDrawerNav = document.getElementById('doc-toc-drawer-nav');

  if (tocOverlay && tocDrawer) {
    window.openDocTocDrawer = () => {
      tocOverlay.classList.add('open');
      tocDrawer.classList.add('open');
      document.body.style.overflow = 'hidden';

      // 初始化目录内容
      if (tocDrawerNav && !tocDrawerNav.querySelector('.toc-list')) {
        const tocNav = document.getElementById('toc-nav');
        if (tocNav && tocNav.innerHTML.trim()) {
          tocDrawerNav.innerHTML = tocNav.innerHTML;
          bindTocDrawerEvents(tocDrawerNav);
        }
      }
    };

    window.closeDocTocDrawer = () => {
      tocOverlay.classList.remove('open');
      tocDrawer.classList.remove('open');
      document.body.style.overflow = '';
    };
  }

  // 侧边栏抽屉
  const sidebarOverlay = document.getElementById('doc-sidebar-overlay');
  const sidebarDrawer = document.getElementById('doc-sidebar-drawer');

  if (sidebarOverlay && sidebarDrawer) {
    window.openDocSidebarDrawer = () => {
      sidebarOverlay.classList.add('open');
      sidebarDrawer.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    window.closeDocSidebarDrawer = () => {
      sidebarOverlay.classList.remove('open');
      sidebarDrawer.classList.remove('open');
      document.body.style.overflow = '';
    };
  }

  // ESC 键关闭
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      if (tocDrawer?.classList.contains('open')) window.closeDocTocDrawer();
      if (sidebarDrawer?.classList.contains('open')) window.closeDocSidebarDrawer();
    }
  });
}

function bindTocDrawerEvents(container) {
  const links = container.querySelectorAll('.toc-link');
  links.forEach(link => {
    on(link, 'click', (e) => {
      e.preventDefault();
      const headingId = link.getAttribute('data-heading-id') || link.getAttribute('href').slice(1);
      const heading = document.getElementById(headingId);
      if (heading) {
        window.closeDocTocDrawer();
        setTimeout(() => {
          smoothScrollToHeading(heading, 80);
        }, 100);
      }
    });
  });
}

// 初始化
function init() {
  cleanupDocPage();
  _pageAbort = new AbortController();
  // initLazyLoad(); - 已由 article-content.js 统一处理
  initTOC();
  initDropdowns();
  initSidebarFooterCollision();
  initDrawers();
}

const handlePageEnter = () => {
  if (!isDocPage()) return;
  init();
};

if (window.SkyPjax?.onPage) {
  window.SkyPjax.onPage(handlePageEnter, { immediate: false });
  window.SkyPjax.onCleanup(cleanupDocPage);
} else {
  runPageInit(handlePageEnter);
}

notifySwupPageReady();
