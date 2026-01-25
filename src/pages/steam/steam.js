/**
 * Steam 游戏库页面脚本
 * 
 * 功能：
 * - 异步加载 Steam 数据 (REST API)
 * - 3分钟本地缓存
 * - 图片懒加载错误处理
 * - 热力图渲染
 * - 成就进度条计算
 */

import './steam.css';

// 缓存配置
const CACHE_KEY = 'steam_page_cache';
const CACHE_TTL = 3 * 60 * 1000; // 3分钟

/**
 * 缓存管理
 */
const cache = {
  get(key) {
    try {
      const data = localStorage.getItem(`${CACHE_KEY}_${key}`);
      if (!data) return null;
      const { value, expiry } = JSON.parse(data);
      if (Date.now() > expiry) {
        console.log(`[Steam Page] 缓存过期: ${key}`);
        localStorage.removeItem(`${CACHE_KEY}_${key}`);
        return null;
      }
      console.log(`[Steam Page] 命中缓存: ${key}`);
      return value;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`${CACHE_KEY}_${key}`, JSON.stringify({
        value,
        expiry: Date.now() + CACHE_TTL
      }));
      console.log(`[Steam Page] 写入缓存: ${key}`);
    } catch (e) {
      console.warn('[Steam Page] 缓存写入失败:', e);
    }
  }
};

/**
 * API 请求封装
 */
async function fetchAPI(endpoint, useCache = true) {
  const cacheKey = endpoint.replace(/[^a-z0-9]/gi, '_');
  
  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }
  
  console.log(`[Steam Page] 请求 API: ${endpoint}`);
  const startTime = performance.now();
  
  const response = await fetch(`/apis/api.steam.halo.run/v1alpha1${endpoint}`);
  const elapsed = (performance.now() - startTime).toFixed(0);
  
  console.log(`[Steam Page] API 响应: ${endpoint} - ${response.status} (${elapsed}ms)`);
  
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  
  const data = await response.json();
  if (useCache) cache.set(cacheKey, data);
  return data;
}

/**
 * Alpine.js Steam 页面组件
 */
document.addEventListener('alpine:init', () => {
  // 防止重复注册
  if (Alpine._steamPageRegistered) return;
  Alpine._steamPageRegistered = true;

  Alpine.data('steamPage', () => ({
    // 数据
    profile: null,
    stats: null,
    badges: null,
    recentGames: [],
    games: { items: [], page: 1, totalPages: 1 },
    error: null,
    _initialized: false,
    
    // 加载状态
    loading: {
      profile: true,
      stats: true,
      badges: true,
      recent: true,
      games: true
    },
    
    // 配置
    config: window.steamPageConfig || {},
    
    async init() {
      // 防止重复初始化
      if (this._initialized) {
        console.log('[Steam Page] 跳过重复初始化');
        return;
      }
      this._initialized = true;

      console.log('[Steam Page] 初始化开始');
      const startTime = performance.now();
      
      // 并行加载所有数据
      await Promise.all([
        this.loadProfile(),
        this.loadStats(),
        this.loadBadges(),
        this.loadRecent(),
        this.loadGames(1)
      ]);
      
      console.log(`[Steam Page] 所有数据加载完成, 总耗时: ${(performance.now() - startTime).toFixed(0)}ms`);
      console.log('[Steam Page] 数据状态:', {
        profile: !!this.profile,
        stats: !!this.stats,
        badges: !!this.badges,
        recentGames: this.recentGames?.length || 0,
        games: this.games?.items?.length || 0
      });
      
      // 初始化热力图
      this.$nextTick(() => {
        initHeatmap();
      });
    },
    
    async loadProfile() {
      try {
        this.profile = await fetchAPI('/profile');
        console.log('[Steam Page] profile 加载成功:', this.profile?.summary?.personaname);
      } catch (e) {
        console.error('[Steam Page] profile 加载失败:', e);
        this.error = 'Steam 资料加载失败';
      } finally {
        this.loading.profile = false;
      }
    },
    
    async loadStats() {
      try {
        this.stats = await fetchAPI('/stats');
        console.log('[Steam Page] stats 加载成功:', { totalGames: this.stats?.totalGames });
      } catch (e) {
        console.error('[Steam Page] stats 加载失败:', e);
      } finally {
        this.loading.stats = false;
      }
    },
    
    async loadBadges() {
      try {
        this.badges = await fetchAPI('/badges');
        console.log('[Steam Page] badges 加载成功:', { totalBadges: this.badges?.totalBadges });
      } catch (e) {
        console.error('[Steam Page] badges 加载失败:', e);
      } finally {
        this.loading.badges = false;
      }
    },
    
    async loadRecent() {
      try {
        const limit = this.config.recentGamesLimit || 10;
        const data = await fetchAPI(`/recent?limit=${limit}`);
        // 确保是数组
        this.recentGames = Array.isArray(data) ? data : [];
        console.log('[Steam Page] recent 加载成功:', { count: this.recentGames.length });
        // 检查数据完整性 (API 返回 appid 小写)
        this.recentGames.forEach((game, i) => {
          if (!game.appid || !game.headerImageUrl) {
            console.warn(`[Steam Page] recent[${i}] 数据不完整:`, { 
              appid: game.appid, 
              headerImageUrl: game.headerImageUrl,
              name: game.name 
            });
          }
        });
      } catch (e) {
        console.error('[Steam Page] recent 加载失败:', e);
        this.recentGames = [];
      } finally {
        this.loading.recent = false;
      }
    },
    
    async loadGames(page = 1) {
      this.loading.games = true;
      try {
        const size = this.config.gamesPageSize || 20;
        console.log(`[Steam Page] 加载游戏库 page=${page}, size=${size}`);
        // 分页数据不缓存
        const data = await fetchAPI(`/games?page=${page}&size=${size}`, false);
        this.games = data || { items: [], page: 1, totalPages: 1 };
        console.log('[Steam Page] games 加载成功:', { 
          page: this.games?.page, 
          total: this.games?.total,
          items: this.games?.items?.length 
        });
        // 检查数据完整性 (API 返回 appid 小写)
        if (this.games?.items) {
          this.games.items.forEach((game, i) => {
            if (!game.appid || !game.headerImageUrl) {
              console.warn(`[Steam Page] games[${i}] 数据不完整:`, { 
                appid: game.appid, 
                headerImageUrl: game.headerImageUrl,
                name: game.name 
              });
            }
          });
        }
      } catch (e) {
        console.error('[Steam Page] games 加载失败:', e);
        this.games = { items: [], page: 1, totalPages: 1 };
      } finally {
        this.loading.games = false;
      }
    },
    
    // 计算成就百分比
    getAchievementPercent(text) {
      if (!text) return 0;
      const match = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        const [, achieved, total] = match;
        return total > 0 ? (achieved / total) * 100 : 0;
      }
      return 0;
    }
  }));
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  observeImageLoad();
});

/**
 * 图片懒加载优化
 */
function observeImageLoad() {
  // 使用 MutationObserver 监听动态添加的图片
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          const images = node.querySelectorAll?.('.steam-game-img, .steam-badge-img, .steam-avatar-img') || [];
          images.forEach(setupImageHandlers);
          if (node.matches?.('.steam-game-img, .steam-badge-img, .steam-avatar-img')) {
            setupImageHandlers(node);
          }
        }
      });
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  // 处理已存在的图片
  document.querySelectorAll('.steam-game-img, .steam-badge-img, .steam-avatar-img').forEach(setupImageHandlers);
}

function setupImageHandlers(img) {
  if (img.dataset.handled) return;
  img.dataset.handled = 'true';
  
  // 记录图片 src 用于调试
  const originalSrc = img.src || img.getAttribute(':src') || 'unknown';
  
  if (img.complete && img.naturalHeight !== 0) {
    img.classList.add('loaded');
  } else {
    img.addEventListener('load', function() {
      this.classList.add('loaded');
    });
    img.addEventListener('error', function() {
      // 忽略空 src 或无效 src 的错误
      if (!this.src || this.src === window.location.href || this.src.endsWith('/steam')) {
        console.log('[Steam Page] 忽略无效图片 src:', this.src);
        return;
      }
      console.warn('[Steam Page] 图片加载失败:', this.src);
      this.classList.add('loaded');
      this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 215"%3E%3Crect fill="%231b2838" width="460" height="215"/%3E%3Ctext x="50%25" y="50%25" fill="%2366c0f4" font-size="24" text-anchor="middle" dy=".3em"%3E🎮%3C/text%3E%3C/svg%3E';
    });
  }
}

/**
 * 热力图初始化
 */
async function initHeatmap() {
  const gridEl = document.getElementById('steam-heatmap-grid');
  const loadingEl = document.getElementById('steam-heatmap-loading');
  const emptyEl = document.getElementById('steam-heatmap-empty');
  const errorEl = document.getElementById('steam-heatmap-error');
  const tooltipEl = document.getElementById('steam-heatmap-tooltip');

  if (!gridEl) {
    console.log('[Steam Page] 热力图元素不存在，跳过');
    return;
  }

  console.log('[Steam Page] 开始加载热力图');

  try {
    const heatmapDays = parseInt(gridEl.dataset.days || '365', 10);
    const apiUrl = gridEl.dataset.apiUrl;

    if (!apiUrl) {
      console.log('[Steam Page] 热力图 API URL 未配置');
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    console.log(`[Steam Page] 热力图请求: ${apiUrl}, days=${heatmapDays}`);
    const startTime = performance.now();
    const data = await fetchHeatmapData(apiUrl, heatmapDays);
    console.log(`[Steam Page] 热力图数据获取完成, 耗时: ${(performance.now() - startTime).toFixed(0)}ms, 记录数: ${data?.items?.length || 0}`);

    if (loadingEl) loadingEl.style.display = 'none';

    if (!data || !data.items || data.items.length === 0) {
      console.log('[Steam Page] 热力图无数据');
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    const dateMap = new Map();
    data.items.forEach(item => {
      const date = item.spec.date;
      const minutes = item.spec.playtimeMinutes || 0;
      // 累加同一天不同游戏的时长
      dateMap.set(date, (dateMap.get(date) || 0) + minutes);
    });

    renderCustomHeatmap(gridEl, dateMap, heatmapDays, tooltipEl);
    console.log('[Steam Page] 热力图渲染完成');

  } catch (error) {
    console.error('[Steam Page] 热力图加载失败:', error);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'flex';
  }
}

async function fetchHeatmapData(baseUrl, days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const url = new URL(baseUrl, window.location.origin);
  url.searchParams.set('startDate', formatDate(startDate));
  url.searchParams.set('endDate', formatDate(endDate));
  url.searchParams.set('page', '1');
  url.searchParams.set('size', days);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch heatmap data');
  return await response.json();
}

function renderCustomHeatmap(container, dateMap, days, tooltip) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  container.innerHTML = '';

  let current = new Date(startDate);
  const dayOfWeek = current.getDay();
  current.setDate(current.getDate() - dayOfWeek);

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  while (current <= endDate) {
    const dateStr = formatLocalDate(current);
    const minutes = dateMap.get(dateStr) || 0;
    const hours = (minutes / 60).toFixed(1);

    let level = 0;
    if (minutes > 0) level = 1;
    if (minutes > 120) level = 2;
    if (minutes > 240) level = 3;

    let bgColor;
    if (level === 0) bgColor = 'color-mix(in oklch, var(--color-base-content) 10%, transparent)';
    else if (level === 1) bgColor = 'color-mix(in oklch, var(--color-primary) 30%, transparent)';
    else if (level === 2) bgColor = 'color-mix(in oklch, var(--color-primary) 60%, transparent)';
    else bgColor = 'var(--color-primary)';

    const cell = document.createElement('div');
    cell.className = 'steam-heatmap-cell';
    cell.style.backgroundColor = bgColor;
    cell.dataset.date = dateStr;
    cell.dataset.hours = hours;
    cell.dataset.minutes = minutes;

    cell.addEventListener('mouseenter', (e) => {
      const date = new Date(dateStr);
      const formattedDate = `${date.getMonth() + 1}月${date.getDate()}日`;

      tooltip.innerHTML = `
        <div style="font-weight:600;margin-bottom:4px;">${formattedDate}</div>
        <div style="opacity:0.9;">${hours} 小时</div>
      `;

      const containerRect = container.closest('.steam-layout')?.getBoundingClientRect() || { left: 0, top: 0 };
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX - containerRect.left + 10) + 'px';
      tooltip.style.top = (e.clientY - containerRect.top - 50) + 'px';
    });

    cell.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });

    container.appendChild(cell);
    current.setDate(current.getDate() + 1);
  }
}
