/**
 * 公共文章内容处理脚本
 * 适用于所有使用 #article-content 的页面（post、doc、page、about 等）
 * 
 * 使用方式：
 * 1. 在模板 <head> 中引入：<script th:src="@{/assets/js/article-content.js}"></script>
 * 2. 脚本会自动在 DOMContentLoaded 时初始化
 */

(function(window, document) {
  'use strict';

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
   * 初始化所有文章内容处理
   */
  function initArticleContent() {
    setupContentLazyLoad();
    setupExternalLinks();
    initAdmonitionGlow();
    removeBlurStyles();
  }

  // 自动初始化
  document.addEventListener('DOMContentLoaded', function() {
    initArticleContent();
  });

  // 暴露给全局（可选，供页面手动调用）
  window.initArticleContent = initArticleContent;

})(window, document);
