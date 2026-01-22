/**
 * Steam 游戏库页面脚本
 * 
 * 功能：
 * - 图片懒加载错误处理
 * - 热力图渲染 (Custom Grid)
 * - 成就进度条计算
 */

import './steam.css';

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 图片懒加载优化 - 添加加载完成标记和错误处理
  const observeImageLoad = () => {
    const images = document.querySelectorAll('.steam-game-img, .steam-badge-img, .steam-avatar-img');
    
    images.forEach(img => {
      // 如果图片已经加载完成
      if (img.complete && img.naturalHeight !== 0) {
        img.classList.add('loaded');
      } else {
        // 监听加载完成
        img.addEventListener('load', function() {
          this.classList.add('loaded');
        });
        
        // 监听加载失败
        img.addEventListener('error', function() {
          this.classList.add('loaded');
          // 使用占位图
          this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 215"%3E%3Crect fill="%231b2838" width="460" height="215"/%3E%3Ctext x="50%25" y="50%25" fill="%2366c0f4" font-size="24" text-anchor="middle" dy=".3em"%3E🎮%3C/text%3E%3C/svg%3E';
        });
      }
    });
  };

  // 初始化图片加载监听
  observeImageLoad();

  // 成就进度条计算
  initAchievementProgressBars();

  // 自定义热力图初始化
  initHeatmap();
});

/**
 * 初始化成就进度条
 * 从 data-progress 属性解析 "X/Y" 格式并计算百分比
 */
function initAchievementProgressBars() {
  document.querySelectorAll('.steam-achievement-bar[data-progress]').forEach(bar => {
    const progressText = bar.dataset.progress;
    if (!progressText) return;

    // 解析 "X/Y" 格式
    const match = progressText.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      const achieved = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);
      if (total > 0) {
        const percent = (achieved / total) * 100;
        const fill = bar.querySelector('.steam-achievement-fill');
        if (fill) {
          // 延迟设置宽度以触发动画
          requestAnimationFrame(() => {
            fill.style.width = `${percent}%`;
          });
        }
      }
    }
  });
}

/**
 * 为服务端渲染的热力图 cell 添加 tooltip 交互
 */
function addTooltipToExistingCells(container, tooltip) {
  if (!tooltip) {
    tooltip = document.getElementById('steam-tooltip');
  }
  if (!tooltip) return;

  const cells = container.querySelectorAll('.steam-heatmap-cell:not(.invisible)');
  cells.forEach(cell => {
    const dateStr = cell.dataset.date;
    const minutes = parseInt(cell.dataset.minutes || '0', 10);
    const hours = (minutes / 60).toFixed(1);

    cell.addEventListener('mouseenter', () => {
      const date = new Date(dateStr);
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const formattedDate = `${date.getMonth() + 1}月${date.getDate()}日${weekdays[date.getDay()]}`;

      tooltip.innerHTML = `
        <div class="font-bold text-base-content/90">${formattedDate}</div>
        <div class="text-base-content/70 mt-1 flex items-center gap-1">
          <span class="font-mono text-sm">${hours}</span> <span class="text-xs">小时游戏时间</span>
        </div>
      `;
      tooltip.style.display = 'block';

      const rect = cell.getBoundingClientRect();
      tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8 + window.scrollY}px`;
      tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    });

    cell.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

/**
 * 热力图初始化 (Custom SVG/Grid)
 */
async function initHeatmap() {
  const gridEl = document.getElementById('steam-heatmap-grid');
  const loadingEl = document.getElementById('steam-heatmap-loading');
  const emptyEl = document.getElementById('steam-heatmap-empty');
  const errorEl = document.getElementById('steam-heatmap-error');
  const tooltipEl = document.getElementById('steam-heatmap-tooltip');

  if (!gridEl) return;

  try {
    const heatmapDays = parseInt(gridEl.dataset.days || '365', 10);
    // 兼容两种属性命名
    const apiUrl = gridEl.dataset.apiUrl || gridEl.closest('.steam-heatmap-inline')?.querySelector('[data-api-url]')?.dataset.apiUrl;

    console.log('[Steam Debug] Init Heatmap:', { heatmapDays, apiUrl, gridElId: gridEl.id });

    // 如果服务端已经渲染了热力图（有 .steam-heatmap-cell 子元素），跳过 API 请求
    const existingCells = gridEl.querySelectorAll('.steam-heatmap-cell:not(.invisible)');
    if (existingCells.length > 0 && !apiUrl) {
      console.log('[Steam Debug] Server-rendered heatmap detected, skipping API fetch');
      if (loadingEl) loadingEl.style.display = 'none';
      // 为已有的 cell 添加 tooltip 交互
      addTooltipToExistingCells(gridEl, tooltipEl);
      return;
    }

    if (!apiUrl) {
      console.log('[Steam Debug] No API URL and no server-rendered data, showing empty state');
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    const data = await fetchHeatmapData(apiUrl, heatmapDays);
    console.log('[Steam Debug] Data Received:', data);

    if (loadingEl) {
      loadingEl.style.display = 'none';
      console.log('[Steam Debug] Loading element hidden');
    } else {
      console.warn('[Steam Debug] Loading element NOT FOUND!');
    }

    if (!data || !data.items || data.items.length === 0) {
      console.warn('[Steam Debug] No items in heatmap data');
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    // 处理数据映射
    const dateMap = new Map();
    data.items.forEach(item => {
      dateMap.set(item.spec.date, item.spec.playtimeMinutes || 0);
    });
    console.log('[Steam Debug] DateMap:', Object.fromEntries(dateMap));

    // 渲染网格
    renderCustomHeatmap(gridEl, dateMap, heatmapDays, tooltipEl);
    console.log('[Steam Debug] Heatmap rendered successfully');

  } catch (error) {
    console.error('Failed to render heatmap:', error);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'flex';
  }
}

/**
 * 获取热力图数据
 */
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

  // Construct URL with parameters
  // Handle relative URLs correctly
  const url = new URL(baseUrl, window.location.origin);
  url.searchParams.set('startDate', formatDate(startDate));
  url.searchParams.set('endDate', formatDate(endDate));
  url.searchParams.set('page', '1');
  url.searchParams.set('size', days);

  console.log('[Steam Debug] Fetching URL:', url.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    console.error('[Steam Debug] Fetch Failed:', response.status);
    throw new Error('Failed to fetch heatmap data');
  }
  return await response.json();
}

/**
 * 渲染自定义热力图
 */
function renderCustomHeatmap(container, dateMap, days, tooltip) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // 清空容器
  container.innerHTML = '';

  // 生成每一天的数据
  let current = new Date(startDate);
  // 调整 startDate 到最近的一个周日 (为了对齐)
  const dayOfWeek = current.getDay(); // 0 is Sunday
  current.setDate(current.getDate() - dayOfWeek);

  // 使用本地日期格式化，避免时区问题
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  let cellCount = 0;
  while (current <= endDate) {
    const dateStr = formatLocalDate(current);
    const minutes = dateMap.get(dateStr) || 0;
    const hours = (minutes / 60).toFixed(1);

    // 计算强度等级 (0-3) - 匹配 About 页面
    let level = 0;
    if (minutes > 0) level = 1;
    if (minutes > 120) level = 2;  // 2小时以上
    if (minutes > 240) level = 3;  // 4小时以上

    // 根据等级设置颜色 - 与 About 页面保持一致
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

    // 交互事件
    cell.addEventListener('mouseenter', (e) => {
      const date = new Date(dateStr);
      const formattedDate = `${date.getMonth() + 1}月${date.getDate()}日`;

      tooltip.innerHTML = `
        <div style="font-weight:600;margin-bottom:4px;">${formattedDate}</div>
        <div style="opacity:0.9;">${hours} 小时</div>
      `;

      // 获取容器偏移量来修正 transform 导致的 fixed 失效问题
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
    cellCount++;
  }
  console.log('[Steam Debug] Rendered cells:', cellCount);
}
