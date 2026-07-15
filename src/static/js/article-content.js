/**
 * 公共文章内容处理脚本
 * 适用于所有使用 #article-content 的页面（post、doc、page、about 等）
 * 
 * 使用方式：
 * 1. 在模板 <head> 中引入：<script th:src="@{/assets/js/article-content.js}"></script>
 * 2. 脚本会在首屏和每次 PJAX page-load 时自动初始化
 */

import { skyDebug } from '../../common/js/debug.js';

(function(window, document) {
  'use strict';

  const TEXT_DIAGRAM_MERMAID_SRC = '/plugins/text-diagram/assets/static/mermaid.min.js';
  const TEXT_DIAGRAM_MERMAID_SELECTOR = 'text-diagram[data-type="mermaid"]';
  const textDiagramSources = new WeakMap();
  let articleContentGeneration = 0;
  let textDiagramRenderRequest = 0;
  let textDiagramThemeRequest = 0;
  let shikiStructureObserver = null;
  let shikiNormalizeQueued = false;

  /**
   * 图片懒加载设置
   * 跳过首屏前 N 张图片，后续图片添加 loading="lazy"
   */
  function setupContentLazyLoad() {
    const content = document.getElementById('article-content');
    if (!content) return;

    const images = content.querySelectorAll('img:not([loading])');
    const skipCount = 2; // 跳过前2张（首屏可能可见）

    images.forEach(function(img, index) {
      if (index >= skipCount) {
        img.setAttribute('loading', 'lazy');
      }
    });
  }

  /**
   * HTTPS 页面中归一化旧内容里的 HTTP 子资源地址。
   * 主要处理历史文章里保存的内网 Halo 地址，例如 http://192.168.x.x:8090/upload/...
   */
  function normalizeInsecureContentUrls() {
    if (window.location.protocol !== 'https:') return;

    const content = document.getElementById('article-content');
    if (!content) return;

    const localHostPattern = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
    const mediaSelector = 'img[src], source[src], video[src], audio[src], iframe[src], embed[src]';

    function normalizeUrl(value) {
      if (!value || !/^http:\/\//i.test(value)) return value;

      try {
        const url = new URL(value);
        if (url.hostname === window.location.hostname || localHostPattern.test(url.hostname)) {
          return `${window.location.origin}${url.pathname}${url.search}${url.hash}`;
        }
        url.protocol = 'https:';
        return url.toString();
      } catch {
        return value.replace(/^http:\/\//i, 'https://');
      }
    }

    content.querySelectorAll(mediaSelector).forEach(function(el) {
      const next = normalizeUrl(el.getAttribute('src'));
      if (next && next !== el.getAttribute('src')) {
        el.setAttribute('src', next);
      }
    });

    content.querySelectorAll('[poster]').forEach(function(el) {
      const next = normalizeUrl(el.getAttribute('poster'));
      if (next && next !== el.getAttribute('poster')) {
        el.setAttribute('poster', next);
      }
    });

    content.querySelectorAll('[srcset]').forEach(function(el) {
      const srcset = el.getAttribute('srcset');
      if (!srcset || !srcset.includes('http://')) return;

      const normalized = srcset.split(',').map(function(part) {
        const trimmed = part.trim();
        const firstSpace = trimmed.search(/\s/);
        if (firstSpace === -1) return normalizeUrl(trimmed);
        return `${normalizeUrl(trimmed.slice(0, firstSpace))}${trimmed.slice(firstSpace)}`;
      }).join(', ');

      el.setAttribute('srcset', normalized);
    });
  }

  /**
   * 外部链接处理
   * 为外部链接添加 target="_blank" 和 rel="noopener noreferrer"
   */
  function setupExternalLinks() {
    const content = document.getElementById('article-content');
    if (!content) return;

    const links = content.querySelectorAll('a[href^="http"]');
    links.forEach(function(link) {
      if (!link.hostname.includes(window.location.hostname)) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  /**
   * Admonition 鼠标跟随发光效果
   */
  function initAdmonitionGlow() {
    const admonitions = document.querySelectorAll('#article-content .admonition');

    admonitions.forEach(function(admonition) {
      if (admonition.dataset.skyAdmonitionGlow === 'true') return;
      admonition.dataset.skyAdmonitionGlow = 'true';

      admonition.addEventListener('mouseenter', function() {
        admonition.style.setProperty('--glow-opacity', '1');
      });

      admonition.addEventListener('mouseleave', function() {
        admonition.style.setProperty('--glow-opacity', '0');
      });

      admonition.addEventListener('mousemove', function(e) {
        const rect = admonition.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        admonition.style.setProperty('--glow-x', x + 'px');
        admonition.style.setProperty('--glow-y', y + 'px');
      });
    });
  }

  /**
   * 移除可能的内联 blur 样式
   */
  function removeBlurStyles() {
    const content = document.getElementById('article-content');
    if (!content) return;

    const inlineStyles = content.querySelectorAll('style');
    inlineStyles.forEach(function(style) {
      if (style.textContent.includes('blur')) {
        style.remove();
      }
    });
  }

  /**
   * Shiki 1.4.1 在 PJAX 返回已含服务端 <shiki-code> 的正文时，会再次把其
   * 直属 pre 包成新的 <shiki-code>。仅保留持有真实 pre 的内层宿主，避免
   * 每次往返都新增一层 Shadow DOM 和重复渲染。
   */
  function normalizeNestedShikiBlocks() {
    const content = document.getElementById('article-content');
    if (!content) return;

    let normalizedCount = 0;
    let nestedBlocks = Array.from(content.querySelectorAll('shiki-code > shiki-code'));

    while (nestedBlocks.length > 0) {
      nestedBlocks.forEach(function(inner) {
        const outer = inner.parentElement;
        if (
          outer?.tagName === 'SHIKI-CODE' &&
          outer.childElementCount === 1 &&
          outer.firstElementChild === inner
        ) {
          outer.replaceWith(inner);
          normalizedCount += 1;
        }
      });
      nestedBlocks = Array.from(content.querySelectorAll('shiki-code > shiki-code'));
    }

    if (normalizedCount > 0) {
      skyDebug.warn('shiki', '已归一化 PJAX 重复代码块包装', { count: normalizedCount });
    }
  }

  function observeShikiStructure() {
    shikiStructureObserver?.disconnect();
    shikiStructureObserver = null;
    shikiNormalizeQueued = false;

    const content = document.getElementById('article-content');
    if (!content) return;

    normalizeNestedShikiBlocks();
    shikiStructureObserver = new MutationObserver(function(mutations) {
      if (
        shikiNormalizeQueued ||
        !mutations.some(function(mutation) {
          return mutation.addedNodes.length > 0;
        })
      ) return;

      shikiNormalizeQueued = true;
      queueMicrotask(function() {
        shikiNormalizeQueued = false;
        if (content.isConnected) normalizeNestedShikiBlocks();
      });
    });
    shikiStructureObserver.observe(content, { childList: true, subtree: true });
  }

  /**
   * Text Diagram 的资源由插件按页面注入，但 PJAX 替换正文时不会执行新页面脚本。
   * 仅在检测到尚未处理的 Mermaid 节点时加载插件资源并补跑渲染。
   */
  function isCompatibleMermaid(candidate) {
    return typeof candidate?.initialize === 'function' && typeof candidate?.run === 'function';
  }

  function loadTextDiagramMermaid() {
    if (window.__skyTextDiagramMermaidPromise) return window.__skyTextDiagramMermaidPromise;
    if (isCompatibleMermaid(window.__skyTextDiagramMermaidApi)) {
      return Promise.resolve(window.__skyTextDiagramMermaidApi);
    }
    if (isCompatibleMermaid(window.mermaid)) {
      window.__skyTextDiagramMermaidApi = window.mermaid;
      return Promise.resolve(window.__skyTextDiagramMermaidApi);
    }

    window.__skyTextDiagramMermaidPromise = new Promise(function(resolve, reject) {
      const script = document.createElement('script');
      script.src = new URL(TEXT_DIAGRAM_MERMAID_SRC, window.location.origin).href;
      script.async = true;
      script.dataset.skyTextDiagramMermaid = 'true';

      script.addEventListener('load', function() {
        if (isCompatibleMermaid(window.mermaid)) {
          window.__skyTextDiagramMermaidApi = window.mermaid;
          resolve(window.__skyTextDiagramMermaidApi);
          return;
        }
        script.remove();
        reject(new Error('Text Diagram Mermaid resource loaded without a runnable API'));
      }, { once: true });
      script.addEventListener('error', function() {
        script.remove();
        reject(new Error(`Unable to load ${script.src}`));
      }, { once: true });

      document.head.appendChild(script);
    }).catch(function(error) {
      window.__skyTextDiagramMermaidPromise = null;
      throw error;
    });

    return window.__skyTextDiagramMermaidPromise;
  }

  async function renderTextDiagrams(generation) {
    const content = document.getElementById('article-content');
    if (!content) return;

    const nodes = Array.from(
      content.querySelectorAll(`${TEXT_DIAGRAM_MERMAID_SELECTOR}:not([data-sky-mermaid-pending="true"])`)
    ).filter(function(node) {
      return !node.getAttribute('data-processed');
    });
    if (nodes.length === 0) return;

    nodes.forEach(function(node) {
      if (!textDiagramSources.has(node)) {
        textDiagramSources.set(node, node.dataset.content || node.textContent || '');
      }
    });

    const request = ++textDiagramRenderRequest;
    try {
      const mermaid = await loadTextDiagramMermaid();
      const previousTask = window.__skyTextDiagramRenderQueue || Promise.resolve();
      const currentTask = previousTask.catch(function() {
        // 前一个页面的绘图失败不应阻止当前页面继续渲染。
      }).then(async function() {
        if (generation !== articleContentGeneration || request !== textDiagramRenderRequest) return;

        const connectedNodes = nodes.filter(function(node) {
          return node.isConnected && content.contains(node) && !node.getAttribute('data-processed');
        });
        if (connectedNodes.length === 0) return;

        connectedNodes.forEach(function(node) {
          node.dataset.skyMermaidPending = 'true';
        });
        try {
          mermaid.initialize({
            startOnLoad: false,
            theme: document.documentElement.getAttribute('data-color-scheme') === 'dark' ? 'dark' : 'default',
          });
          await mermaid.run({ nodes: connectedNodes });
        } finally {
          connectedNodes.forEach(function(node) {
            delete node.dataset.skyMermaidPending;
          });
        }
      });
      window.__skyTextDiagramRenderQueue = currentTask;
      await currentTask;
    } catch (error) {
      skyDebug.warn('article-content', 'Text Diagram 渲染失败', error);
    }
  }

  function rerenderTextDiagramsForTheme() {
    const themeRequest = ++textDiagramThemeRequest;
    const previousTask = window.__skyTextDiagramRenderQueue || Promise.resolve();

    void previousTask.catch(function() {
      // 即使上一轮渲染失败，也要允许按新主题重试。
    }).then(function() {
      if (themeRequest !== textDiagramThemeRequest) return;

      const content = document.getElementById('article-content');
      if (!content) return;
      const nodes = Array.from(content.querySelectorAll(TEXT_DIAGRAM_MERMAID_SELECTOR));
      if (nodes.length === 0) return;

      nodes.forEach(function(node) {
        const source = textDiagramSources.get(node) || node.dataset.content || node.textContent || '';
        textDiagramSources.set(node, source);
        node.replaceChildren(document.createTextNode(source));
        node.removeAttribute('data-processed');
        delete node.dataset.skyMermaidPending;
      });

      const generation = ++articleContentGeneration;
      void renderTextDiagrams(generation);
    });
  }

  function observeTextDiagramTheme() {
    let colorScheme = document.documentElement.getAttribute('data-color-scheme');
    const observer = new MutationObserver(function(mutations) {
      if (!mutations.some(function(mutation) {
        return mutation.attributeName === 'data-color-scheme';
      })) return;

      const nextColorScheme = document.documentElement.getAttribute('data-color-scheme');
      if (nextColorScheme === colorScheme) return;
      colorScheme = nextColorScheme;
      rerenderTextDiagramsForTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-scheme'],
    });
  }

  /**
   * 初始化所有文章内容处理
   */
  function initArticleContent() {
    const generation = ++articleContentGeneration;
    observeShikiStructure();
    normalizeInsecureContentUrls();
    setupContentLazyLoad();
    setupExternalLinks();
    initAdmonitionGlow();
    removeBlurStyles();
    void renderTextDiagrams(generation);
  }

  // 自动初始化。ES Module 在 PJAX 返回时不会重新执行，因此只注册一次持久回调，
  // 由 SkyPjax 在首屏及每次 DOM 替换后重新处理当前 #article-content。
  if (!window.__skyArticleContentLifecycleRegistered) {
    window.__skyArticleContentLifecycleRegistered = true;
    observeTextDiagramTheme();

    if (window.SkyPjax?.onPage) {
      window.SkyPjax.onPage(initArticleContent, { immediate: false });
      window.SkyPjax.onCleanup(function() {
        articleContentGeneration += 1;
        textDiagramRenderRequest += 1;
        shikiStructureObserver?.disconnect();
        shikiStructureObserver = null;
        shikiNormalizeQueued = false;
      });
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initArticleContent, { once: true });
    } else {
      initArticleContent();
    }
  }

  // 暴露给全局（可选，供页面手动调用）
  window.initArticleContent = initArticleContent;

})(window, document);
