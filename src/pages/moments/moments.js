/**
 * 瞬间页面脚本
 */
import './moments.css';
import './moment-publish.js';
import { notifySwupPageReady, runPageInit } from '../../common/js/page-runtime.js';

/**
 * 瞬间点赞功能
 * 使用 Halo 官方 trackers API
 */
window.handleMomentUpvote = async function(btn) {
  const momentName = btn.dataset.momentName;
  if (!momentName) return;
  
  // 检查是否已点赞
  const upvotedNames = JSON.parse(localStorage.getItem('halo.upvoted.moment.names') || '[]');
  if (upvotedNames.includes(momentName)) {
    return; // 已点赞
  }
  
  try {
    const response = await fetch('/apis/api.halo.run/v1alpha1/trackers/upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group: 'moment.halo.run',
        plural: 'moments',
        name: momentName
      })
    });
    
    if (response.ok) {
      // 更新 UI
      const countEl = btn.querySelector('.upvote-count');
      const currentCount = parseInt(countEl.textContent) || 0;
      countEl.textContent = currentCount + 1;
      
      // 更新图标样式
      const icon = btn.querySelector('span[class*="icon"]');
      if (icon) {
        icon.className = icon.className.replace('icon-[heroicons--heart]', 'icon-[heroicons--heart-solid]');
        btn.classList.add('text-error');
        btn.classList.remove('text-base-content/50');
      }
      
      // 保存已点赞状态
      upvotedNames.push(momentName);
      localStorage.setItem('halo.upvoted.moment.names', JSON.stringify(upvotedNames));
    }
  } catch (err) {
    console.error('点赞失败:', err);
  }
};

// 页面加载后恢复点赞状态
runPageInit(function() {
  const upvotedNames = JSON.parse(localStorage.getItem('halo.upvoted.moment.names') || '[]');
  
  document.querySelectorAll('[data-moment-name]').forEach(function(btn) {
    const momentName = btn.dataset.momentName;
    if (upvotedNames.includes(momentName)) {
      const icon = btn.querySelector('span[class*="icon"]');
      if (icon) {
        icon.className = icon.className.replace('icon-[heroicons--heart]', 'icon-[heroicons--heart-solid]');
        btn.classList.add('text-error');
        btn.classList.remove('text-base-content/50');
      }
    }
  });
});

notifySwupPageReady();
