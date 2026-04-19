/**
 * 追番页面脚本 - Bilibili Bangumi
 */

import './bangumi.css';
import { notifySwupPageReady, runPageInit } from '../../common/js/page-runtime.js';

/**
 * 鼠标悬停切换背景
 */
function initHoverBackground() {
  const bgImg = document.getElementById('bangumi-bg-img');
  if (!bgImg) return;

  const originalSrc = bgImg.src;
  let currentSrc = originalSrc;

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
        setTimeout(() => {
          bgImg.src = newSrc;
          currentSrc = newSrc;
        }, 200);
        
        // 淡入
        setTimeout(() => {
          bgImg.style.opacity = '0.4';
        }, 250);
      }
    });
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
}

runPageInit(initHoverBackground);
notifySwupPageReady();
