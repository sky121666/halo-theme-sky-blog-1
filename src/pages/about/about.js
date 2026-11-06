/**
 * 关于页面 - Squareform 风格（简化版）
 * 原生 JS 实现核心动画
 */

import './about.css';
import { skyDebug } from '../../common/js/debug.js';
import { notifySwupPageReady, registerPageLifecycle } from '../../common/js/page-runtime.js';
import { annualWindow, fetchAnnualPublicPosts, localDateKey } from '../../common/js/article-heatmap-data.js';

// 导入公共文章内容脚本（CSS 已在 about.css 中导入）
import '../../static/js/article-content.js';

(function(window, document) {
  'use strict';
  
  const SF = {};
  const animationFrames = new Set();

  SF.requestAnimationFrame = function(callback) {
    const frame = window.requestAnimationFrame(function(timestamp) {
      animationFrames.delete(frame);
      callback(timestamp);
    });
    animationFrames.add(frame);
    return frame;
  };

  SF.cancelAnimationFrames = function() {
    animationFrames.forEach(function(frame) {
      window.cancelAnimationFrame(frame);
    });
    animationFrames.clear();
  };
  
  // ============================= 滚动 Reveal =============================
  
  SF.initScrollReveal = function() {
    const revealElements = document.querySelectorAll('[data-reveal]');
    if (!revealElements.length) return;
    
    const revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(function(el) {
      revealObserver.observe(el);
    });

    return function() {
      revealObserver.disconnect();
    };
  };

  // ============================= 数字滚动 =============================
  
  SF.initStatCounter = function() {
    const statElements = document.querySelectorAll('[data-stat-value]');
    if (!statElements.length) return;
    
    const counterObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
          entry.target.classList.add('counted');
          SF.animateNumber(entry.target);
        }
      });
    }, { threshold: 0.3, rootMargin: '0px 0px -20px 0px' });

    statElements.forEach(function(el) {
      counterObserver.observe(el);
    });

    return function() {
      counterObserver.disconnect();
    };
  };

  // easeOutQuart 缓动函数 - 更丝滑的动画曲线
  SF.easeOutQuart = function(t) {
    return 1 - Math.pow(1 - t, 4);
  };

  SF.animateNumber = function(element) {
    const targetValue = parseInt(element.getAttribute('data-target')) || 0;
    const numberElement = element.querySelector('.sf-stat-number');
    if (!numberElement) return;

    const duration = 1800; // 稍微缩短动画时间
    const startTime = performance.now();
    
    // 格式化数字（添加千分位）
    function formatNumber(num) {
      if (num >= 10000) {
        return num.toLocaleString('zh-CN');
      }
      return num.toString();
    }

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数让动画更丝滑
      const easedProgress = SF.easeOutQuart(progress);
      const currentValue = Math.floor(easedProgress * targetValue);
      
      numberElement.textContent = formatNumber(currentValue);

      if (progress < 1) {
        SF.requestAnimationFrame(animate);
      } else {
        numberElement.textContent = formatNumber(targetValue);
      }
    }

    SF.requestAnimationFrame(animate);
  };

  // ============================= 文章热力图 =============================
  
  SF.initArticleHeatmap = function() {
    const container = document.getElementById('article-heatmap-container');
    if (!container) return;

    const canvas = container.querySelector('.heatmap-canvas');
    const controller = new AbortController();
    const countEl = document.getElementById('article-count');
    const statusEl = document.getElementById('article-heatmap-status');
    const errorEl = document.getElementById('article-heatmap-error');
    let requestController = null;
    let visibilityObserver = null;
    let destroyed = false;

    function renderPosts(posts) {
      if (countEl) countEl.textContent = posts.length;

    const postsByDate = {};
    posts.forEach(function(post) {
      const key = localDateKey(post.date);
      if (!key) return;
      if (!postsByDate[key]) postsByDate[key] = [];
      postsByDate[key].push(post);
    });

    const cs = 11, cg = 3, wks = 53, dys = 7, lw = 25, mh = 15;
    const svgW = lw + wks * (cs + cg) + cg;
    const svgH = mh + dys * (cs + cg) + cg;
    const { start, end } = annualWindow();
    const gridStart = new Date(start);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    const mons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mLabels = [];
    let lastMon = -1;
    
    for (let wk = 0; wk < wks; wk++) {
      const dt = new Date(gridStart);
      dt.setDate(dt.getDate() + wk * 7);
      const mon = dt.getMonth();
      if (mon !== lastMon) {
        mLabels.push('<text x="' + (lw + wk * (cs + cg)) + '" y="10" class="heatmap-month-label">' + mons[mon] + '</text>');
        lastMon = mon;
      }
    }

    const wds = ['','Mon','','Wed','','Fri',''];
    const wLabels = [1,3,5].map(function(dy) {
      return '<text x="0" y="' + (mh + dy * (cs + cg) + cs * 0.75) + '" class="heatmap-label">' + wds[dy] + '</text>';
    });

    const cells = [];
    const maxCnt = Math.max.apply(null, Object.values(postsByDate).map(function(arr) { return arr.length; }).concat([1]));

    for (let idx = 0; idx < wks * dys; idx++) {
      const wk = Math.floor(idx / dys);
      const dy = idx % dys;
      const dt = new Date(gridStart);
      dt.setDate(dt.getDate() + wk * 7 + dy);
      if (dt < start || dt >= end) continue;

      const key = localDateKey(dt);
      const cnt = postsByDate[key] ? postsByDate[key].length : 0;
      const lvl = cnt === 0 ? 0 : Math.ceil((cnt / maxCnt) * 3);

      let clr;
      // 空白格子使用 base-content 20% 混合，确保暗色主题下可见
      if (lvl === 0) clr = 'color-mix(in oklch, var(--color-base-content) 15%, var(--color-base-100))';
      else if (lvl === 1) clr = 'color-mix(in oklch, var(--color-primary) 40%, var(--color-base-100))';
      else if (lvl === 2) clr = 'color-mix(in oklch, var(--color-primary) 70%, var(--color-base-100))';
      else clr = 'var(--color-primary)';

      cells.push('<rect x="' + (lw + wk * (cs + cg)) + '" y="' + (mh + dy * (cs + cg)) + '" width="' + cs + '" height="' + cs + '" rx="2" fill="' + clr + '" class="article-heatmap-cell heatmap-cell-animated" style="animation-delay:' + idx + 'ms" data-date="' + key + '" data-count="' + cnt + '"></rect>');
    }

    canvas.innerHTML = '<svg class="article-heatmap-svg" viewBox="0 0 ' + svgW + ' ' + svgH + '"><g>' + mLabels.join('') + '</g><g>' + wLabels.join('') + '</g><g>' + cells.join('') + '</g></svg>';

    const tooltip = document.getElementById('article-tooltip');
    canvas.querySelectorAll('.article-heatmap-cell').forEach(function(cell) {
      cell.addEventListener('mouseenter', function(evt) {
        if (!tooltip) return;
        const ds = cell.getAttribute('data-date');
        const cnt = cell.getAttribute('data-count');
        const [year, month, day] = ds.split('-').map(Number);
        const dayPosts = postsByDate[ds] || [];
        const dateElement = document.createElement('div');
        dateElement.className = 'heatmap-tooltip-date';
        dateElement.textContent = `${year}/${month}/${day}`;
        const countElement = document.createElement('div');
        countElement.className = 'heatmap-tooltip-count';
        countElement.textContent = `${cnt} 篇文章`;
        tooltip.replaceChildren(dateElement, countElement);
        if (dayPosts.length > 0) {
          const postList = document.createElement('div');
          postList.className = 'heatmap-tooltip-posts';
          dayPosts.slice(0, 3).forEach(function(post) {
            const item = document.createElement('span');
            item.className = 'heatmap-tooltip-post';
            item.textContent = post.title;
            postList.append(item);
          });
          if (dayPosts.length > 3) {
            const more = document.createElement('span');
            more.className = 'heatmap-tooltip-post';
            more.textContent = `+${dayPosts.length - 3} 更多...`;
            postList.append(more);
          }
          tooltip.append(postList);
        }
        tooltip.style.display = 'block';
        
        // 优化 tooltip 定位，防止溢出屏幕
        var tooltipWidth = tooltip.offsetWidth || 200;
        var tooltipHeight = tooltip.offsetHeight || 100;
        var viewportWidth = window.innerWidth;
        var viewportHeight = window.innerHeight;
        var scrollX = window.scrollX || window.pageXOffset;
        var scrollY = window.scrollY || window.pageYOffset;
        
        var left = evt.pageX + 10;
        var top = evt.pageY + 10;
        
        // 防止右侧溢出
        if (left + tooltipWidth > scrollX + viewportWidth - 20) {
          left = evt.pageX - tooltipWidth - 10;
        }
        
        // 防止底部溢出
        if (top + tooltipHeight > scrollY + viewportHeight - 20) {
          top = evt.pageY - tooltipHeight - 10;
        }
        
        // 确保不超出左边界
        if (left < scrollX + 10) {
          left = scrollX + 10;
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
      }, { signal: controller.signal });
      
      cell.addEventListener('mouseleave', function() {
        if (tooltip) tooltip.style.display = 'none';
      }, { signal: controller.signal });
    });

    }

    async function loadPosts() {
      requestController?.abort();
      const request = new AbortController();
      requestController = request;
      if (statusEl) {
        statusEl.textContent = '正在加载年度文章…';
        statusEl.hidden = false;
      }
      if (errorEl) errorEl.hidden = true;
      try {
        const posts = await fetchAnnualPublicPosts({ signal: request.signal });
        if (destroyed || request.signal.aborted) return;
        renderPosts(posts);
        if (statusEl) {
          statusEl.textContent = posts.length === 0 ? '暂无文章发布记录' : '';
          statusEl.hidden = posts.length > 0;
        }
      } catch {
        if (destroyed || request.signal.aborted) return;
        if (statusEl) statusEl.hidden = true;
        if (errorEl) errorEl.hidden = false;
      } finally {
        if (requestController === request) requestController = null;
      }
    }

    errorEl?.querySelector('button')?.addEventListener('click', loadPosts, { signal: controller.signal });
    if (typeof IntersectionObserver === 'undefined') {
      loadPosts();
    } else {
      visibilityObserver = new IntersectionObserver(function(entries) {
        if (!entries.some(function(entry) { return entry.isIntersecting; })) return;
        visibilityObserver?.disconnect();
        visibilityObserver = null;
        loadPosts();
      }, { rootMargin: '200px' });
      visibilityObserver.observe(container);
    }

    return function() {
      destroyed = true;
      visibilityObserver?.disconnect();
      requestController?.abort();
      controller.abort();
    };
  };

  // ============================= GitHub =============================
  
  // 辅助函数：从任意 CSS 颜色值提取 hex（支持 rgb, oklch 等）
  function colorToHex(colorStr, defaultHex) {
    if (!colorStr) return defaultHex;
    
    // 尝试匹配 rgb/rgba 格式
    const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map(function(v) { 
        return parseInt(v).toString(16).padStart(2, '0'); 
      }).join('');
    }
    
    // 使用 Canvas 转换任意 CSS 颜色（包括 oklch）
    try {
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      var data = ctx.getImageData(0, 0, 1, 1).data;
      return [data[0], data[1], data[2]].map(function(v) {
        return v.toString(16).padStart(2, '0');
      }).join('');
    } catch (e) {
      skyDebug.warn('about', 'GitHub colorToHex 转换失败', e);
      return defaultHex;
    }
  }
  
  // 更新 GitHub 卡片颜色（供主题切换时调用）
  SF.updateGitHubColors = function() {
    const cfg = window.aboutGithubConfig;
    if (!cfg || !cfg.username) return;
    
    // 检查是否使用自定义主题
    var themeValue = cfg.theme ? String(cfg.theme).trim() : '';
    var hasCustomTheme = themeValue && themeValue !== 'null' && themeValue !== 'undefined';
    
    // 如果使用自定义主题，不需要更新颜色
    if (hasCustomTheme) return;
    
    // 获取当前主题颜色
    const probe = document.getElementById('about-color-probe');
    let primaryHex = '1f2937';
    let textHex = '6b7280';
    
    if (probe) {
      primaryHex = colorToHex(getComputedStyle(probe).backgroundColor, primaryHex);
      textHex = colorToHex(getComputedStyle(probe).color, textHex);
    }
    
    var localeValue = cfg.locale ? String(cfg.locale).trim() : '';
    var locale = (localeValue && localeValue !== 'null' && localeValue !== 'undefined') ? '&locale=' + localeValue : '';
    
    // 更新热力图
    const heatmapImg = document.querySelector('.github-heatmap-img');
    if (heatmapImg) {
      heatmapImg.src = 'https://ghchart.rshah.org/' + primaryHex + '/' + cfg.username;
    }
    
    // 更新 Stats 卡片
    const statsImg = document.getElementById('github-stats-img');
    if (statsImg) {
      statsImg.src = cfg.statsHost + '/api?username=' + cfg.username + 
        '&show_icons=true&hide_border=true' + locale +
        '&theme=transparent&title_color=' + primaryHex + 
        '&icon_color=' + primaryHex + '&text_color=' + textHex + '&bg_color=00000000';
    }
    
    // 更新 Langs 卡片
    const langsImg = document.getElementById('github-langs-img');
    if (langsImg) {
      langsImg.src = cfg.statsHost + '/api/top-langs/?username=' + cfg.username + 
        '&layout=compact&hide_border=true' + locale +
        '&theme=transparent&title_color=' + primaryHex + 
        '&text_color=' + textHex + '&bg_color=00000000';
    }
  };
  
  SF.initGitHub = function() {
    const container = document.getElementById('github-heatmap-container');
    const cfg = window.aboutGithubConfig;
    if (!cfg || !cfg.username) return;

    // 获取主题颜色
    const probe = document.getElementById('about-color-probe');
    let primaryHex = '1f2937';
    let textHex = '6b7280';
    
    if (probe) {
      primaryHex = colorToHex(getComputedStyle(probe).backgroundColor, primaryHex);
      textHex = colorToHex(getComputedStyle(probe).color, textHex);
    }

    // GitHub 贡献热力图
    if (container) {
      const img = container.querySelector('.github-heatmap-img');
      const loading = container.querySelector('.sf-loading');
      
      if (img) {
        img.onload = function() {
          img.style.display = 'block';
          if (loading) loading.style.display = 'none';
        };
        
        img.onerror = function() {
          if (loading) loading.innerHTML = '<span style="opacity:0.6;">加载失败</span>';
        };
        
        img.src = 'https://ghchart.rshah.org/' + primaryHex + '/' + cfg.username;
      }
    }

    // 构建公共参数
    var localeValue = cfg.locale ? String(cfg.locale).trim() : '';
    var locale = (localeValue && localeValue !== 'null' && localeValue !== 'undefined') ? '&locale=' + localeValue : '';
    
    var themeValue = cfg.theme ? String(cfg.theme).trim() : '';
    var hasCustomTheme = themeValue && themeValue !== 'null' && themeValue !== 'undefined';
    
    // GitHub Stats 卡片
    const statsImg = document.getElementById('github-stats-img');
    const langsImg = document.getElementById('github-langs-img');
    
    if (statsImg) {
      var statsUrl = cfg.statsHost + '/api?username=' + cfg.username + 
        '&show_icons=true&hide_border=true' + locale;
      
      if (hasCustomTheme) {
        statsUrl += '&theme=' + themeValue;
      } else {
        statsUrl += '&theme=transparent' +
          '&title_color=' + primaryHex + 
          '&icon_color=' + primaryHex + 
          '&text_color=' + textHex + 
          '&bg_color=00000000';
      }
      statsImg.src = statsUrl;
    }
    
    if (langsImg) {
      var langsUrl = cfg.statsHost + '/api/top-langs/?username=' + cfg.username + 
        '&layout=compact&hide_border=true' + locale;
      
      if (hasCustomTheme) {
        langsUrl += '&theme=' + themeValue;
      } else {
        langsUrl += '&theme=transparent' +
          '&title_color=' + primaryHex + 
          '&text_color=' + textHex + 
          '&bg_color=00000000';
      }
      langsImg.src = langsUrl;
    }
    
    // 监听主题切换
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'data-theme' || mutation.attributeName === 'data-color-scheme') {
          // 延迟一帧确保样式已更新
          SF.requestAnimationFrame(function() {
            SF.updateGitHubColors();
          });
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-color-scheme']
    });

    return function() {
      observer.disconnect();
    };
  };

  // ============================= 位置地图 =============================
  
  SF.initLocation = function() {
    const mapEl = document.getElementById('location-map');
    if (!mapEl) return;

    const latitude = (mapEl.getAttribute('data-lat') || '').trim();
    const longitude = (mapEl.getAttribute('data-lng') || '').trim();
    const lat = Number(latitude);
    const lng = Number(longitude);
    const name = mapEl.getAttribute('data-name') || '位置';
    const key = (mapEl.getAttribute('data-map-key') || '').trim();

    if (!latitude || !longitude || !Number.isFinite(lat) || !Number.isFinite(lng) ||
        Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      mapEl.setAttribute('data-map-state', 'failed');
      const message = document.createElement('div');
      message.className = 'sf-location-fallback';
      message.textContent = '地图暂不可用';
      mapEl.replaceChildren(message);
      return;
    }

    const destination = new URL('https://uri.amap.com/marker');
    destination.searchParams.set('position', lng + ',' + lat);
    destination.searchParams.set('name', name);
    destination.searchParams.set('coordinate', 'gaode');
    destination.searchParams.set('callnative', '1');

    const link = document.createElement('a');
    link.className = 'sf-location-map-link';
    link.href = destination.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', '在高德地图中查看' + name);
    mapEl.setAttribute('data-map-state', key ? 'loading' : 'unconfigured');

    const fallback = document.createElement('span');
    fallback.className = 'sf-location-fallback';
    const pin = document.createElement('span');
    pin.className = 'icon-[heroicons--map-pin] sf-location-fallback-icon';
    pin.setAttribute('aria-hidden', 'true');
    const status = document.createElement('span');
    status.className = 'sf-location-fallback-status';
    status.textContent = '地图加载中';
    fallback.append(pin);
    if (key) fallback.append(status);

    const action = document.createElement('span');
    action.className = 'sf-location-map-action';
    action.textContent = '在高德地图中查看';
    link.append(fallback, action);
    mapEl.replaceChildren(link);

    // 静态图需要站长自己的 Key；未配置时仅展示本地位置卡片。
    if (!key) return;

    const image = document.createElement('img');
    image.className = 'sf-location-map-preview';
    image.alt = name + '的位置地图';
    image.decoding = 'async';
    image.hidden = true;
    const controller = new AbortController();
    const showFailure = function() {
      mapEl.setAttribute('data-map-state', 'failed');
      image.hidden = true;
      fallback.hidden = false;
      status.textContent = '地图暂不可用';
    };
    image.addEventListener('load', function() {
      if (!image.naturalWidth) {
        showFailure();
        return;
      }
      image.hidden = false;
      fallback.hidden = true;
      mapEl.setAttribute('data-map-state', 'ready');
    }, { once: true, signal: controller.signal });
    image.addEventListener('error', showFailure, { once: true, signal: controller.signal });
    link.append(image);

    const width = Math.round(Math.min(800, Math.max(50, mapEl.offsetWidth || 800)));
    const preview = new URL('https://apis.map.qq.com/ws/staticmap/v2/');
    preview.searchParams.set('center', lat + ',' + lng);
    preview.searchParams.set('zoom', '13');
    preview.searchParams.set('size', width + '*320');
    preview.searchParams.set('markers', 'color:red|label:A|' + lat + ',' + lng);
    preview.searchParams.set('key', key);
    image.src = preview.href;

    return function() {
      controller.abort();
      image.removeAttribute('src');
    };
  };

  // ============================= 工具进度条 =============================
  
  SF.initToolkitProgress = function() {
    const progressBars = document.querySelectorAll('.sf-tool-progress');
    if (!progressBars.length) return;
    const timers = new Set();
    
    const progressObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
          entry.target.classList.add('animated');
          const width = entry.target.style.width;
          entry.target.style.width = '0';
          const timer = window.setTimeout(function() {
            timers.delete(timer);
            entry.target.style.width = width;
          }, 100);
          timers.add(timer);
        }
      });
    }, { threshold: 0.5 });

    progressBars.forEach(function(bar) {
      progressObserver.observe(bar);
    });

    return function() {
      progressObserver.disconnect();
      timers.forEach(function(timer) {
        window.clearTimeout(timer);
      });
      timers.clear();
    };
  };

  // ============================= 平滑滚动 =============================
  
  SF.initSmoothScroll = function() {
    const anchors = document.querySelectorAll('a[href^="#"]');
    if (!anchors.length) return;
    const controller = new AbortController();

    anchors.forEach(function(anchor) {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, { signal: controller.signal });
    });

    return function() {
      controller.abort();
    };
  };

  // ============================= 初始化 =============================
  
  registerPageLifecycle(function() {
    if (!document.querySelector('.about-squareform')) return;

    const cleanupTasks = [];
    [
      SF.initScrollReveal(),
      SF.initStatCounter(),
      SF.initArticleHeatmap(),
      SF.initGitHub(),
      SF.initToolkitProgress(),
      SF.initSmoothScroll(),
    ]
      .forEach(function(task) {
        if (typeof task === 'function') cleanupTasks.push(task);
      });
    const locationTimer = window.setTimeout(function() {
      const cleanup = SF.initLocation();
      if (typeof cleanup === 'function') cleanupTasks.push(cleanup);
    }, 500);

    return function() {
      window.clearTimeout(locationTimer);
      cleanupTasks.forEach(function(task) {
        task();
      });
      SF.cancelAnimationFrames();
      window.aboutGithubConfig = undefined;
    };
  }, { entry: 'about' });

})(window, document);

notifySwupPageReady();
