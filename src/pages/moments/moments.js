/**
 * 瞬间页面脚本
 */
import './moments.css';
import './moment-publish.js';
import { skyDebug } from '../../common/js/debug.js';
import { notifySwupPageReady, registerPageLifecycle } from '../../common/js/page-runtime.js';

const UPVOTED_MOMENTS_KEY = 'halo.upvoted.moment.names';
const momentUpvoteStates = new Map();

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

function readMomentUpvoteCount(btn) {
  return parseInt(btn.querySelector('.upvote-count')?.textContent || '0', 10) || 0;
}

function currentMomentButtons(momentName, origin) {
  const buttons = Array.from(document.querySelectorAll('[data-moment-name]'))
    .filter((btn) => btn.dataset.momentName === momentName);
  if (origin && !buttons.includes(origin)) buttons.push(origin);
  return buttons;
}

function restoreMomentUpvoteButton(btn, upvotedNames) {
  const state = momentUpvoteStates.get(btn.dataset.momentName);
  btn.disabled = state?.pending === true;
  if (state?.pending) btn.setAttribute('aria-busy', 'true');
  else btn.removeAttribute('aria-busy');

  const confirmed = Boolean(state?.confirmed || upvotedNames.includes(btn.dataset.momentName));
  // Halo's tracker is a one-way action, not a like/unlike toggle.
  btn.setAttribute('aria-disabled', String(confirmed || state?.pending === true));
  if (!confirmed) {
    btn.setAttribute('aria-label', `点赞瞬间，已有 ${readMomentUpvoteCount(btn)} 次点赞`);
    return;
  }
  const icon = btn.querySelector('span[class*="icon"]');
  if (icon) {
    icon.className = icon.className.replace('icon-[heroicons--heart]', 'icon-[heroicons--heart-solid]');
    btn.classList.add('text-error');
    btn.classList.remove('text-base-content/50');
  }
  const count = btn.querySelector('.upvote-count');
  if (count && state?.confirmed) {
    count.textContent = String(Math.max(readMomentUpvoteCount(btn), state.count));
  }
  btn.setAttribute('aria-label', `已点赞，已有 ${readMomentUpvoteCount(btn)} 次点赞`);
}

function syncMomentUpvoteButtons(momentName, origin) {
  const upvotedNames = readUpvotedMomentNames();
  currentMomentButtons(momentName, origin).forEach((btn) => restoreMomentUpvoteButton(btn, upvotedNames));
}

/**
 * 瞬间点赞功能
 * 使用 Halo 官方 trackers API
 */
async function handleMomentUpvote(btn) {
  const momentName = btn.dataset.momentName;
  if (!momentName) return;
  const existingState = momentUpvoteStates.get(momentName);
  if (existingState?.pending) return;
  
  // 检查是否已点赞
  const upvotedNames = readUpvotedMomentNames();
  if (existingState?.confirmed || upvotedNames.includes(momentName)) {
    showMomentActionStatus(btn, '已经点过赞了');
    return; // 已点赞
  }

  const state = {
    pending: true,
    confirmed: false,
    count: readMomentUpvoteCount(btn),
    controller: new AbortController(),
  };
  momentUpvoteStates.set(momentName, state);
  syncMomentUpvoteButtons(momentName, btn);
  try {
    const response = await fetch('/apis/api.halo.run/v1alpha1/trackers/upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group: 'moment.halo.run',
        plural: 'moments',
        name: momentName
      }),
      signal: state.controller.signal,
    });
    if (state.controller.signal.aborted) return;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.confirmed = true;
    state.count += 1;
    rememberMomentUpvote(momentName, readUpvotedMomentNames());
  } catch (err) {
    if (!state.controller.signal.aborted) {
      skyDebug.error('moments', '点赞失败', err);
      showMomentActionStatus(currentMomentButtons(momentName, btn)[0], '点赞失败，请稍后重试');
    }
  } finally {
    state.pending = false;
    if (!state.controller.signal.aborted && momentUpvoteStates.get(momentName) === state) {
      if (!state.confirmed) momentUpvoteStates.delete(momentName);
      syncMomentUpvoteButtons(momentName, btn);
    }
  }
}

function restoreMomentUpvotes(root = document) {
  const upvotedNames = readUpvotedMomentNames();

  root.querySelectorAll('[data-moment-name]').forEach((btn) => restoreMomentUpvoteButton(btn, upvotedNames));
}

// 页面加载和局部刷新后恢复点赞状态，不重复初始化发布弹窗。
registerPageLifecycle(function() {
  const momentButtons = document.querySelectorAll('[data-moment-name]');
  const publishModal = document.getElementById('moment-publish-modal');
  const momentMedia = document.querySelector('.moment-media');
  if (momentButtons.length === 0 && !publishModal && !momentMedia) return;

  initializeMomentGalleries();

  window.handleMomentUpvote = handleMomentUpvote;
  restoreMomentUpvotes();
  const onListRefresh = () => {
    const list = document.getElementById('moments-list');
    if (list) restoreMomentUpvotes(list);
  };
  document.addEventListener('sky:moments-list-refreshed', onListRefresh);

  return function() {
    document.removeEventListener('sky:moments-list-refreshed', onListRefresh);
    momentUpvoteStates.forEach((state) => state.controller.abort());
    momentUpvoteStates.clear();
    if (window.handleMomentUpvote === handleMomentUpvote) {
      window.handleMomentUpvote = undefined;
    }
  };
}, { entry: 'moments' });

notifySwupPageReady();
