/**
 * 关于页面 - Squareform 风格（简化版）
 * 原生 JS 实现核心动画
 */

import './about.css';
import { notifySwupPageReady, runPageInit } from '../../common/js/page-runtime.js';

// 导入公共文章内容脚本（CSS 已在 about.css 中导入）
import '../../static/js/article-content.js';

(function(window, document) {
  'use strict';
  
  const SF = {};
  
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
        requestAnimationFrame(animate);
      } else {
        numberElement.textContent = formatNumber(targetValue);
      }
    }

    requestAnimationFrame(animate);
  };

  // ============================= 文章热力图 =============================
  
  SF.initArticleHeatmap = function() {
    const container = document.getElementById('article-heatmap-container');
    if (!container || !window.aboutPagePosts) return;

    const posts = window.aboutPagePosts.filter(function(p) { return p.title && p.date; });
    if (!posts.length) return;

    const canvas = container.querySelector('.heatmap-canvas');
    const countEl = document.getElementById('article-count');
    if (countEl) countEl.textContent = posts.length;

    const postsByDate = {};
    posts.forEach(function(post) {
      const dt = new Date(post.date);
      const key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      if (!postsByDate[key]) postsByDate[key] = [];
      postsByDate[key].push(post);
    });

    const cs = 11, cg = 3, wks = 53, dys = 7, lw = 25, mh = 15;
    const svgW = lw + wks * (cs + cg) + cg;
    const svgH = mh + dys * (cs + cg) + cg;
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 364);

    const mons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mLabels = [];
    let lastMon = -1;
    
    for (let wk = 0; wk < wks; wk++) {
      const dt = new Date(start);
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
      const dt = new Date(start);
      dt.setDate(dt.getDate() + wk * 7 + dy);
      if (dt > today) continue;

      const key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
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
        const dt = new Date(ds);
        const fmt = dt.getFullYear() + '/' + (dt.getMonth() + 1) + '/' + dt.getDate();
        const dayPosts = posts.filter(function(p) { return new Date(p.date).toDateString() === dt.toDateString(); });
        
        let htm = '<div class="heatmap-tooltip-date">' + fmt + '</div><div class="heatmap-tooltip-count">' + cnt + ' 篇文章</div>';
        if (dayPosts.length > 0) {
          htm += '<div class="heatmap-tooltip-posts">';
          dayPosts.slice(0, 3).forEach(function(p) { htm += '<span class="heatmap-tooltip-post">' + p.title + '</span>'; });
          if (dayPosts.length > 3) htm += '<span class="heatmap-tooltip-post">+' + (dayPosts.length - 3) + ' 更多...</span>';
          htm += '</div>';
        }
        
        tooltip.innerHTML = htm;
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
      });
      
      cell.addEventListener('mouseleave', function() {
        if (tooltip) tooltip.style.display = 'none';
      });
    });
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
      console.log('[GitHub] colorToHex error:', e);
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
          requestAnimationFrame(function() {
            SF.updateGitHubColors();
          });
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-color-scheme']
    });
  };

  // ============================= 静态地图（高德/腾讯） =============================
  
  SF.initLocation = function() {
    const mapEl = document.getElementById('location-map');
    if (!mapEl) return;

    const lat = parseFloat(mapEl.getAttribute('data-lat'));
    const lng = parseFloat(mapEl.getAttribute('data-lng'));
    const name = mapEl.getAttribute('data-name') || '位置';

    if (isNaN(lat) || isNaN(lng)) {
      mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:0.5;">请配置位置坐标</div>';
      return;
    }

    const zoom = 13;
    const width = Math.min(800, mapEl.offsetWidth || 800);
    const height = 320;
    
    // 腾讯地图静态图 API（无需 Key，公开可用）
    const staticMapUrl = 'https://apis.map.qq.com/ws/staticmap/v2/?' +
      'center=' + lat + ',' + lng +
      '&zoom=' + zoom +
      '&size=' + width + '*' + height +
      '&markers=color:red|label:A|' + lat + ',' + lng +
      '&key=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77';
    
    // 高德地图跳转
    const encodedName = encodeURIComponent(name);
    const amapUrl = 'https://uri.amap.com/marker?position=' + lng + ',' + lat + '&name=' + encodedName + '&coordinate=gaode&callnative=1';
    
    mapEl.innerHTML = 
      '<a href="' + amapUrl + '" target="_blank" rel="noopener" ' +
      'style="display:block;position:relative;width:100%;height:100%;min-height:' + height + 'px;border-radius:0.75rem;overflow:hidden;cursor:pointer;transition:all 0.3s ease;">' +
        '<img src="' + staticMapUrl + '" alt="地图位置" ' +
        'style="width:100%;height:100%;object-fit:cover;" ' +
        'loading="lazy" />' +
        '<div style="position:absolute;bottom:1rem;right:1rem;display:inline-flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;background:var(--color-base-content);color:var(--color-base-100);border-radius:2rem;font-size:0.875rem;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.25);">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">' +
            '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>' +
          '</svg>' +
          '在地图中查看' +
        '</div>' +
      '</a>';
  };

  // ============================= 工具进度条 =============================
  
  SF.initToolkitProgress = function() {
    const progressBars = document.querySelectorAll('.sf-tool-progress');
    if (!progressBars.length) return;
    
    const progressObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
          entry.target.classList.add('animated');
          const width = entry.target.style.width;
          entry.target.style.width = '0';
          setTimeout(function() {
            entry.target.style.width = width;
          }, 100);
        }
      });
    }, { threshold: 0.5 });

    progressBars.forEach(function(bar) {
      progressObserver.observe(bar);
    });
  };

  // ============================= 平滑滚动 =============================
  
  SF.initSmoothScroll = function() {
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
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
      });
    });
  };

  // ============================= 初始化 =============================
  
  runPageInit(function() {
    SF.initScrollReveal();
    SF.initStatCounter();
    SF.initArticleHeatmap();
    SF.initGitHub();
    SF.initToolkitProgress();
    SF.initSmoothScroll();
    setTimeout(SF.initLocation, 500);
  });

})(window, document);

notifySwupPageReady();
