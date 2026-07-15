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
import { skyDebug } from '../../common/js/debug.js';
import {
  notifySwupPageReady,
  registerAlpinePageComponents,
  registerPageLifecycle
} from '../../common/js/page-runtime.js';

// 缓存配置
const CACHE_KEY = 'steam_page_cache';
const CACHE_TTL = 3 * 60 * 1000; // 3分钟
const API_BASES = [
  '/apis/api.steam.timxs.com/v1alpha1',
  '/apis/api.steam.halo.run/v1alpha1'
];

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
        localStorage.removeItem(`${CACHE_KEY}_${key}`);
        return null;
      }
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
    } catch {
      // 忽略缓存写入失败
    }
  }
};

/**
 * API 请求封装
 */
async function fetchAPI(endpoint, useCache = true, signal) {
  const cacheKey = endpoint.replace(/[^a-z0-9]/gi, '_');

  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  const data = await fetchSteamEndpoint(endpoint, signal);
  if (useCache) cache.set(cacheKey, data);
  return data;
}

async function fetchSteamEndpoint(endpoint, signal) {
  let lastError;

  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}${endpoint}`, { signal });
      if (response.ok) return await response.json();
      lastError = new Error(`API error: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Steam API unavailable');
}

/**
 * Alpine.js Steam 页面组件
 */
(function() {
  function _registerAlpineComponents() {
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
    errors: {
      profile: null,
      stats: null,
      badges: null,
      recent: null,
      games: null,
    },
    _initialized: false,
    _abortController: null,

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
      if (this._initialized) return;
      this._initialized = true;
      this._abortController = new AbortController();

      // 并行加载所有数据
      await Promise.all([
        this.loadProfile(),
        this.loadStats(),
        this.loadBadges(),
        this.loadRecent(),
        this.loadGames(1)
      ]);

      const signal = this._abortController?.signal;
      if (!signal || signal.aborted) return;

      // 初始化热力图
      this.$nextTick(() => {
        if (!signal.aborted) initHeatmap(signal);
      });
    },

    destroy() {
      this._abortController?.abort();
      this._abortController = null;
    },

    async loadProfile() {
      const signal = this._abortController?.signal;
      this.loading.profile = true;
      this.error = null;
      this.errors.profile = null;
      try {
        this.profile = await fetchAPI('/profile', true, signal);
      } catch (e) {
        if (signal?.aborted) return;
        skyDebug.error('steam', 'profile 加载失败', e);
        this.error = 'Steam 资料加载失败';
        this.errors.profile = this.error;
      } finally {
        if (!signal?.aborted) this.loading.profile = false;
      }
    },

    async loadStats() {
      const signal = this._abortController?.signal;
      this.loading.stats = true;
      this.errors.stats = null;
      try {
        this.stats = await fetchAPI('/stats', true, signal);
      } catch (e) {
        if (signal?.aborted) return;
        skyDebug.error('steam', 'stats 加载失败', e);
        this.errors.stats = '统计数据加载失败';
      } finally {
        if (!signal?.aborted) this.loading.stats = false;
      }
    },

    async loadBadges() {
      const signal = this._abortController?.signal;
      this.loading.badges = true;
      this.errors.badges = null;
      try {
        this.badges = await fetchAPI('/badges', true, signal);
      } catch (e) {
        if (signal?.aborted) return;
        skyDebug.error('steam', 'badges 加载失败', e);
        this.errors.badges = '徽章数据加载失败';
      } finally {
        if (!signal?.aborted) this.loading.badges = false;
      }
    },

    async loadRecent() {
      const signal = this._abortController?.signal;
      this.loading.recent = true;
      this.errors.recent = null;
      try {
        const limit = this.config.recentGamesLimit || 10;
        const data = await fetchAPI(`/recent?limit=${limit}`, true, signal);
        this.recentGames = Array.isArray(data) ? data : [];
      } catch (e) {
        if (signal?.aborted) return;
        skyDebug.error('steam', 'recent 加载失败', e);
        this.errors.recent = '最近游玩加载失败';
      } finally {
        if (!signal?.aborted) this.loading.recent = false;
      }
    },

    async loadGames(page = 1) {
      const signal = this._abortController?.signal;
      this.loading.games = true;
      this.errors.games = null;
      try {
        const size = this.config.gamesPageSize || 20;
        const data = await fetchAPI(`/games?page=${page}&size=${size}`, false, signal);
        this.games = data || { items: [], page: 1, totalPages: 1 };
      } catch (e) {
        if (signal?.aborted) return;
        skyDebug.error('steam', 'games 加载失败', e);
        this.errors.games = '游戏库加载失败';
      } finally {
        if (!signal?.aborted) this.loading.games = false;
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
}
  registerAlpinePageComponents(_registerAlpineComponents);
})();

// 页面加载完成后初始化。页面模块会被缓存，必须通过 PJAX 生命周期重新 mount。
registerPageLifecycle(() => {
  const root = document.querySelector('.steam-page');
  if (!root) return;

  const cleanupImageObserver = observeImageLoad(root);
  return () => {
    cleanupImageObserver();
    window.steamPageConfig = undefined;
  };
}, { entry: 'steam' });

notifySwupPageReady();

/**
 * 图片懒加载优化
 */
function observeImageLoad(root) {
  const controller = new AbortController();
  const { signal } = controller;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          const images = node.querySelectorAll?.('.steam-game-img, .steam-badge-img, .steam-avatar-img') || [];
          images.forEach((image) => setupImageHandlers(image, signal));
          if (node.matches?.('.steam-game-img, .steam-badge-img, .steam-avatar-img')) {
            setupImageHandlers(node, signal);
          }
        }
      });
    });
  });

  observer.observe(root, { childList: true, subtree: true });
  root.querySelectorAll('.steam-game-img, .steam-badge-img, .steam-avatar-img')
    .forEach((image) => setupImageHandlers(image, signal));

  return () => {
    observer.disconnect();
    controller.abort();
  };
}

function setupImageHandlers(img, signal) {
  if (img.dataset.handled) return;
  img.dataset.handled = 'true';

  if (img.complete && img.naturalHeight !== 0) {
    img.classList.add('loaded');
  } else {
    img.addEventListener('load', function () {
      this.classList.add('loaded');
    }, { once: true, signal });
    img.addEventListener('error', function () {
      if (!this.src || this.src === window.location.href || this.src.endsWith('/steam')) {
        return;
      }
      this.classList.add('loaded');
      this.src = 'data:image/svg+xml,%3Csvg viewBox="0 0 460 215"%3E%3Crect fill="%231b2838" width="460" height="215"/%3E%3Ctext x="50%25" y="50%25" fill="%2366c0f4" font-size="24" text-anchor="middle" dy=".3em"%3E🎮%3C/text%3E%3C/svg%3E';
    }, { once: true, signal });
  }
}

/**
 * 热力图初始化
 */
async function initHeatmap(signal) {
  const gridEl = document.getElementById('steam-heatmap-grid');
  const loadingEl = document.getElementById('steam-heatmap-loading');
  const emptyEl = document.getElementById('steam-heatmap-empty');
  const errorEl = document.getElementById('steam-heatmap-error');
  const tooltipEl = document.getElementById('steam-heatmap-tooltip');

  if (!gridEl) return;

  try {
    const heatmapDays = parseInt(gridEl.dataset.days || '365', 10);
    const apiUrl = gridEl.dataset.apiUrl;

    if (!apiUrl) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    const data = await fetchHeatmapData(apiUrl, heatmapDays, signal);
    if (signal?.aborted) return;

    if (loadingEl) loadingEl.style.display = 'none';

    if (!data || !data.items || data.items.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    const dateMap = new Map();
    data.items.forEach(item => {
      const date = item.spec.date;
      const minutes = item.spec.playtimeMinutes || 0;
      dateMap.set(date, (dateMap.get(date) || 0) + minutes);
    });

    renderCustomHeatmap(gridEl, dateMap, heatmapDays, tooltipEl);

  } catch (error) {
    if (signal?.aborted) return;
    skyDebug.error('steam', '热力图加载失败', error);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'flex';
  }
}

async function fetchHeatmapData(baseUrl, days, signal) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const urls = [baseUrl];
  if (baseUrl.includes('/apis/api.steam.halo.run/')) {
    urls.push(baseUrl.replace('/apis/api.steam.halo.run/', '/apis/api.steam.timxs.com/'));
  }

  let lastError;
  for (const apiUrl of urls) {
    const url = new URL(apiUrl, window.location.origin);
    url.searchParams.set('startDate', formatDate(startDate));
    url.searchParams.set('endDate', formatDate(endDate));
    url.searchParams.set('page', '1');
    url.searchParams.set('size', days);

    try {
      const response = await fetch(url.toString(), { signal });
      if (response.ok) return await response.json();
      lastError = new Error(`Failed to fetch heatmap data: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to fetch heatmap data');
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
