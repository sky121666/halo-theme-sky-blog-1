/**
 * Sky Theme - 基础公共脚本
 * 包含全局工具函数和公共功能
 */

/**
 * 工具函数集合
 */
window.SkyUtils = {
  /**
   * 防抖函数
   * @param {Function} func 要防抖的函数
   * @param {number} wait 等待时间
   * @returns {Function} 防抖后的函数
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * 节流函数
   * @param {Function} func 要节流的函数
   * @param {number} limit 限制时间
   * @returns {Function} 节流后的函数
   */
  throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * 格式化日期
   * @param {Date|string} date 日期
   * @param {string} format 格式
   * @returns {string} 格式化后的日期字符串
   */
  formatDate(date, format = 'YYYY-MM-DD') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day);
  },

  /**
   * 获取相对时间
   * @param {Date|string} date 日期
   * @returns {string} 相对时间字符串
   */
  getRelativeTime(date) {
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  },

  /**
   * 复制文本到剪贴板
   * @param {string} text 要复制的文本
   * @returns {Promise<boolean>} 是否复制成功
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  },

  /**
   * 平滑滚动到指定元素
   * @param {string|Element} target 目标元素或选择器
   * @param {number} offset 偏移量
   */
  scrollToElement(target, offset = 0) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return;

    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
};

/**
 * 页面加载屏幕控制器
 */
window.SkyLoadingScreen = {
  startTime: Date.now(),
  isHidden: false,

  /**
   * 隐藏加载屏幕
   */
  hide() {
    if (this.isHidden) return;

    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;

    const minDuration = parseInt(loadingScreen.dataset.minDuration || '500');
    const elapsed = Date.now() - this.startTime;
    const delay = Math.max(0, minDuration - elapsed);

    setTimeout(() => {
      loadingScreen.classList.add('loaded');
      this.isHidden = true;

      // 动画结束后从 DOM 中移除
      setTimeout(() => {
        if (loadingScreen.parentNode) {
          loadingScreen.remove();
        }
      }, 300);
    }, delay);
  }
};

/**
 * 全局事件处理器
 */
window.SkyEvents = {
  /**
   * 页面加载完成事件
   */
  onPageLoad() {

    // 初始化懒加载图片
    this.initLazyImages();

    // 初始化懒加载动画
    this.initLazyAnimations();

    // 初始化外部链接
    this.initExternalLinks();
  },

  /**
   * 初始化懒加载图片
   */
  initLazyImages() {
    const images = document.querySelectorAll('img[data-src]');

    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
          }
        });
      });

      images.forEach(img => imageObserver.observe(img));
    } else {
      // 降级方案
      images.forEach(img => {
        img.src = img.dataset.src;
        img.classList.remove('lazy');
      });
    }
  },

  /**
   * 初始化外部链接
   */
  initExternalLinks() {
    const links = document.querySelectorAll('a[href^="http"]');
    links.forEach(link => {
      if (!link.hostname.includes(window.location.hostname)) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });
  },

  /**
   * 初始化懒加载动画 (Anti-Flicker)
   * 监听页面元素进入视口，添加 .visible 类触发淡入动画
   */
  initLazyAnimations() {
    const animElements = document.querySelectorAll('.lazy-anim');
    if (animElements.length === 0) return;

    if ('IntersectionObserver' in window) {
      const animObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // 添加 visible 类触发 CSS 动画
            entry.target.classList.add('visible');
            animObserver.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '200px 0px', // 提前 200px 触发，确保长页面也能触发
        threshold: 0 // 只要有一点进入就触发
      });

      animElements.forEach(el => animObserver.observe(el));
      
      // 备用方案：3秒后强制显示所有未触发的元素
      setTimeout(() => {
        animElements.forEach(el => {
          if (!el.classList.contains('visible')) {
            el.classList.add('visible');
          }
        });
      }, 3000);
    } else {
      // 降级方案：不支持 Observer 直接显示
      animElements.forEach(el => el.classList.add('visible'));
    }
  }
};

// 页面加载完成后执行初始化
document.addEventListener('DOMContentLoaded', () => {
  window.SkyEvents.onPageLoad();
  
  // 图片懒加载优化 - 添加 loaded 类实现淡入效果
  const observeImages = () => {
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
      if (img.complete && img.naturalHeight !== 0) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', function() {
          this.classList.add('loaded');
        }, { once: true });
        img.addEventListener('error', function() {
          this.classList.add('loaded'); // 即使失败也显示，避免空白
        }, { once: true });
      }
    });
  };
  
  observeImages();
  
  // 监听动态加载的图片（如无限滚动）
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          const imgs = node.querySelectorAll ? node.querySelectorAll('img[loading="lazy"]') : [];
          imgs.forEach(img => {
            if (img.complete && img.naturalHeight !== 0) {
              img.classList.add('loaded');
            } else {
              img.addEventListener('load', function() {
                this.classList.add('loaded');
              }, { once: true });
            }
          });
        }
      });
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
});

// 监听 Alpine.js 初始化完成
document.addEventListener('alpine:init', () => {
  if (window.SkyLoadingScreen) {
    window.SkyLoadingScreen.hide();
  }
});

// 降级方案：如果没有使用 Alpine 或加载失败，在 window.load 时隐藏
window.addEventListener('load', () => {
  setTimeout(() => {
    if (window.SkyLoadingScreen && !window.SkyLoadingScreen.isHidden) {
      window.SkyLoadingScreen.hide();
    }
  }, 100);
});

