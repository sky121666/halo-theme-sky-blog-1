import './equipment.css'
import { notifySwupPageReady, runPageInit } from '../../common/js/page-runtime.js';

/**
 * 装备页面 - 3D 装备收藏卡交互
 * 战术终端版
 */
runPageInit(() => {
    const cards = document.querySelectorAll('.card-wrap');

    if (cards.length === 0) return;

    cards.forEach(card => {
        // 3D 物理交互
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // 归一化
            const xPct = x / rect.width;
            const yPct = y / rect.height;

            // 限制旋转角度
            const rX = (0.5 - yPct) * 10;
            const rY = (xPct - 0.5) * 10;

            card.style.setProperty('--tilt-x', `${rX}deg`);
            card.style.setProperty('--tilt-y', `${rY}deg`);

            // 光效位置
            card.style.setProperty('--ptr-x', `${xPct * 100}%`);
            card.style.setProperty('--ptr-y', `${yPct * 100}%`);

            card.style.setProperty('--opacity', '1');
        });

        card.addEventListener('mouseleave', () => {
            card.style.setProperty('--tilt-x', '0deg');
            card.style.setProperty('--tilt-y', '0deg');
            card.style.setProperty('--opacity', '0');
        });

        // 触摸支持
        card.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const rect = card.getBoundingClientRect();

            if (touch.clientX < rect.left || touch.clientX > rect.right ||
                touch.clientY < rect.top || touch.clientY > rect.bottom) {
                return;
            }

            const xPct = (touch.clientX - rect.left) / rect.width;
            const yPct = (touch.clientY - rect.top) / rect.height;
            const rX = (0.5 - yPct) * 10;
            const rY = (xPct - 0.5) * 10;

            card.style.setProperty('--tilt-x', `${rX}deg`);
            card.style.setProperty('--tilt-y', `${rY}deg`);
            card.style.setProperty('--ptr-x', `${xPct * 100}%`);
            card.style.setProperty('--ptr-y', `${yPct * 100}%`);
            card.style.setProperty('--opacity', '1');
        }, { passive: true });

        card.addEventListener('touchend', () => {
            card.style.setProperty('--tilt-x', '0deg');
            card.style.setProperty('--tilt-y', '0deg');
            card.style.setProperty('--opacity', '0');
        });
    });
});

notifySwupPageReady();
