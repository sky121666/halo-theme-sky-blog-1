/**
 * Steam 游戏库页面脚本
 * 
 * 功能：
 * - Alpine.js 组件：横向滚动区域滚轮拦截
 * - 图片懒加载错误处理
 * - 热力图渲染 (ECharts)
 */

// 导入样式
import './steam.css';

// Alpine.js 组件
document.addEventListener('alpine:init', () => {
  Alpine.data('steamLibrary', () => ({
    // 横向滚动区域滚轮拦截
    handleScroll(event, container) {
      // 将垂直滚动转换为水平滚动
      if (event.deltaY !== 0) {
        container.scrollLeft += event.deltaY;
      }
    }
  }));
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 图片加载错误处理
  document.querySelectorAll('.steam-game-card img, .steam-recent-card img').forEach(img => {
    img.addEventListener('error', function () {
      // 使用占位图
      this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 215"%3E%3Crect fill="%231b2838" width="460" height="215"/%3E%3Ctext x="50%25" y="50%25" fill="%2366c0f4" font-size="24" text-anchor="middle" dy=".3em"%3E🎮%3C/text%3E%3C/svg%3E';
    });
  });

  // 图片懒加载优化 - 添加加载完成标记
  document.querySelectorAll('.steam-game-card img, .steam-recent-card img').forEach(img => {
    if (img.complete) {
      img.classList.add('loaded');
    } else {
      img.addEventListener('load', function () {
        this.classList.add('loaded');
      });
    }
  });

  // 自定义热力图初始化
  initHeatmap();
});

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
    const data = await fetchHeatmapData(heatmapDays);

    if (loadingEl) loadingEl.style.display = 'none';

    if (!data || !data.items || data.items.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    // 处理数据映射
    const dateMap = new Map();
    data.items.forEach(item => {
      dateMap.set(item.spec.date, item.spec.playtimeMinutes || 0);
    });

    // 渲染网格
    renderCustomHeatmap(gridEl, dateMap, heatmapDays, tooltipEl);

  } catch (error) {
    console.error('Failed to render heatmap:', error);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'flex';
  }
}

/**
 * 获取热力图数据
 */
async function fetchHeatmapData(days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const url = `/apis/api.steam.halo.run/v1alpha1/heatmap/records?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}&page=1&size=${days}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch heatmap data');
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

  // 创建按周分组的结构
  // 我们需要生成 53 列 (周), 每列 7 行 (星期)
  // Grid 布局: grid-template-rows: repeat(7, 1fr); grid-auto-flow: column;

  // 生成每一天的数据
  let current = new Date(startDate);
  // 调整 startDate 到最近的一个周日 (或周一，视偏好而定，这里为了对齐通常周日开始)
  const dayOfWeek = current.getDay(); // 0 is Sunday
  current.setDate(current.getDate() - dayOfWeek);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const minutes = dateMap.get(dateStr) || 0;
    const hours = (minutes / 60).toFixed(1);

    // 计算强度等级 (0-4)
    // 假设: 0=0h, 1=0-1h, 2=1-3h, 3=3-5h, 4=>5h
    let level = 0;
    if (minutes > 0) level = 1;
    if (minutes > 60) level = 2;
    if (minutes > 180) level = 3;
    if (minutes > 300) level = 4;

    const cell = document.createElement('div');
    cell.className = `steam-heatmap-cell level-${level}`;
    cell.dataset.date = dateStr;
    cell.dataset.hours = hours;

    // 交互事件
    cell.addEventListener('mouseenter', (e) => {
      const rect = cell.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      tooltip.innerHTML = `
        <div class="font-bold">${dateStr}</div>
        <div>游戏时长: ${hours} 小时</div>
      `;
      tooltip.classList.remove('hidden');

      // 定位 Tooltip (在 Cell 顶部)
      // 需要计算相对于视口的位置，或者相对于 relative 父容器
      // 这里 content.html 中父容器是 relative
      const top = rect.top - containerRect.top - tooltip.offsetHeight - 8;
      const left = rect.left - containerRect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    });

    cell.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });

    container.appendChild(cell);
    current.setDate(current.getDate() + 1);
  }
}
