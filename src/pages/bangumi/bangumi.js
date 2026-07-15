/**
 * 追番页面脚本 - Bilibili Bangumi
 */

import './bangumi.css';
import { notifySwupPageReady, registerPageLifecycle } from '../../common/js/page-runtime.js';

/**
 * 鼠标悬停切换背景
 */
function initHoverBackground() {
  const bgImg = document.getElementById('bangumi-bg-img');
  if (!bgImg) return;

  const originalSrc = bgImg.src;
  let currentSrc = originalSrc;
  const controller = new AbortController();
  const timers = new Set();
  const schedule = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  // 监听所有番剧卡片的悬停
  document.querySelectorAll('.bangumi-card').forEach(card => {
    const coverImg = card.querySelector('.bangumi-cover img');
    if (!coverImg) return;

    card.addEventListener('mouseenter', () => {
      const newSrc = coverImg.getAttribute('src');
      if (newSrc && newSrc !== currentSrc) {
        // 淡出
        bgImg.style.opacity = '0';
        
        // 切换图片
        schedule(() => {
          bgImg.src = newSrc;
          currentSrc = newSrc;
        }, 200);
        
        // 淡入
        schedule(() => {
          bgImg.style.opacity = '0.4';
        }, 250);
      }
    }, { signal: controller.signal });
  });

  // 鼠标离开卡片区域时恢复原背景（可选）
  // document.querySelector('.bangumi-grid')?.addEventListener('mouseleave', () => {
  //   if (currentSrc !== originalSrc) {
  //     bgImg.style.opacity = '0';
  //     setTimeout(() => {
  //       bgImg.src = originalSrc;
  //       currentSrc = originalSrc;
  //     }, 200);
  //     setTimeout(() => {
  //       bgImg.style.opacity = '0.15';
  //     }, 250);
  //   }
  // });
  return () => {
    controller.abort();
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
  };
}

registerPageLifecycle(initHoverBackground, { entry: 'bangumi' });
notifySwupPageReady();
