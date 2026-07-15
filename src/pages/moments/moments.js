/**
 * 瞬间页面脚本
 */
import './moments.css';
import './moment-publish.js';
import { skyDebug } from '../../common/js/debug.js';
import { notifySwupPageReady, registerPageLifecycle } from '../../common/js/page-runtime.js';

const UPVOTED_MOMENTS_KEY = 'halo.upvoted.moment.names';

function readUpvotedMomentNames() {
  try {
    const value = JSON.parse(localStorage.getItem(UPVOTED_MOMENTS_KEY) || '[]');
    return Array.isArray(value) ? value.filter((name) => typeof name === 'string') : [];
  } catch (error) {
    skyDebug.warn('moments', '本地点赞记录损坏，已忽略', error);
    return [];
  }
}

function rememberMomentUpvote(momentName, currentNames) {
  const nextNames = Array.from(new Set([...currentNames, momentName]));
  try {
    localStorage.setItem(UPVOTED_MOMENTS_KEY, JSON.stringify(nextNames));
  } catch (error) {
    // 服务端已经接受点赞；本地持久化失败不能反向显示为“点赞失败”。
    skyDebug.warn('moments', '点赞已成功，但本地记录无法保存', error);
  }
}

function showMomentActionStatus(btn, message) {
  const previous = btn.parentElement?.querySelector('[data-moment-action-status]');
  previous?.remove();
  const status = document.createElement('span');
  status.dataset.momentActionStatus = 'true';
  status.className = 'text-error ml-2 text-xs';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = message;
  btn.insertAdjacentElement('afterend', status);
  window.setTimeout(() => status.remove(), 4000);
}

/**
 * LightGallery 插件通过 DOMContentLoaded 初始化瞬间图片。PJAX 注入页面时，
 * 需要主动重放插件初始化；图片链接本身保留为插件缺失时的原图降级入口。
 */
function initializeMomentGalleries() {
  if (!document.querySelector('.moment-media img')) return;

  Promise.resolve(window.SkyLightGallery?.initNow?.()).then((ready) => {
    if (ready) {
      skyDebug.event('moments', 'lightgallery:ready');
    }
  }).catch((error) => {
    skyDebug.warn('moments', '灯箱初始化失败，保留原图链接作为降级', error);
  });
}

/**
 * 瞬间点赞功能
 * 使用 Halo 官方 trackers API
 */
async function handleMomentUpvote(btn) {
  const momentName = btn.dataset.momentName;
  if (!momentName) return;
  
  // 检查是否已点赞
  const upvotedNames = readUpvotedMomentNames();
  if (upvotedNames.includes(momentName)) {
    showMomentActionStatus(btn, '已经点过赞了');
    return; // 已点赞
  }

  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
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
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (response.ok) {
      // 更新 UI
      const countEl = btn.querySelector('.upvote-count');
      const currentCount = parseInt(countEl?.textContent || '0', 10) || 0;
      if (countEl) countEl.textContent = currentCount + 1;
      
      // 更新图标样式
      const icon = btn.querySelector('span[class*="icon"]');
      if (icon) {
        icon.className = icon.className.replace('icon-[heroicons--heart]', 'icon-[heroicons--heart-solid]');
        btn.classList.add('text-error');
        btn.classList.remove('text-base-content/50');
      }
      
      // 保存已点赞状态
      rememberMomentUpvote(momentName, upvotedNames);
    }
  } catch (err) {
    skyDebug.error('moments', '点赞失败', err);
    showMomentActionStatus(btn, '点赞失败，请稍后重试');
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
  }
}

// 页面加载后恢复点赞状态
registerPageLifecycle(function() {
  const momentButtons = document.querySelectorAll('[data-moment-name]');
  const publishModal = document.getElementById('moment-publish-modal');
  const momentMedia = document.querySelector('.moment-media');
  if (momentButtons.length === 0 && !publishModal && !momentMedia) return;

  initializeMomentGalleries();

  window.handleMomentUpvote = handleMomentUpvote;
  const upvotedNames = readUpvotedMomentNames();
  
  momentButtons.forEach(function(btn) {
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

  return function() {
    if (window.handleMomentUpvote === handleMomentUpvote) {
      window.handleMomentUpvote = undefined;
    }
  };
}, { entry: 'moments' });

notifySwupPageReady();
