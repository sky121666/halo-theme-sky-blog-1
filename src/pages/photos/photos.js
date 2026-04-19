/**
 * 图库页面脚本
 * - JS 物理分列瀑布流（基于宽高比预估高度）
 * - IntersectionObserver 无限滚动懒加载
 */
import './photos.css';
import { notifySwupPageReady, runPageInit } from '../../common/js/page-runtime.js';

runPageInit(() => {
    const photoGrid = document.getElementById('photo-grid');
    if (!photoGrid) return;

    // 从模板注入的 data-* 属性读取后端配置
    const GAP = parseInt(photoGrid.dataset.gap ?? '16', 10);
    const maxCols = parseInt(photoGrid.dataset.maxCols ?? '4', 10);
    const borderRadius = parseInt(photoGrid.dataset.borderRadius ?? '12', 10);

    // 将圆角以 CSS 变量方式注入，所有 photo-item（含无限滚动加载的）自动继承
    photoGrid.style.setProperty('--photo-radius', borderRadius + 'px');

    let masonryCols = 0;
    let masonryColNodes = [];
    let colHeights = [];
    let allPhotoItems = [];

    function getColCount() {
        const w = window.innerWidth;
        // 根据 maxCols 动态计算各断点应显示的列数
        if (maxCols >= 6 && w >= 1536) return 6;
        if (maxCols >= 5 && w >= 1280) return 5;
        if (maxCols >= 4 && w >= 1024) return Math.min(maxCols, 4);
        if (maxCols >= 3 && w >= 768) return Math.min(maxCols, 3);
        if (maxCols >= 2 && w >= 640) return Math.min(maxCols, 2);
        return 1;
    }

    function initMasonry() {
        masonryCols = getColCount();
        photoGrid.className = 'flex items-start w-full';
        photoGrid.style.gap = GAP + 'px';
        photoGrid.innerHTML = '';
        masonryColNodes = [];
        colHeights = new Array(masonryCols).fill(0);

        for (let i = 0; i < masonryCols; i++) {
            const col = document.createElement('div');
            col.className = 'flex-1 flex flex-col min-w-0';
            col.style.gap = GAP + 'px';
            photoGrid.appendChild(col);
            masonryColNodes.push(col);
        }
    }

    function estimateHeight(img) {
        // 优先用已知的真实尺寸
        const w = img?._nw || img?.naturalWidth;
        const h = img?._nh || img?.naturalHeight;
        if (w && h) {
            const colWidth = (photoGrid.offsetWidth - GAP * (masonryCols - 1)) / masonryCols;
            return (h / w) * colWidth;
        }
        return 200;
    }

    function appendToShortest(item) {
        if (!masonryColNodes.length) return;

        let minIdx = 0;
        for (let i = 1; i < masonryCols; i++) {
            if (colHeights[i] < colHeights[minIdx]) minIdx = i;
        }

        masonryColNodes[minIdx].appendChild(item);
        colHeights[minIdx] += estimateHeight(item.querySelector('img')) + GAP;
    }

    // 图片加载完成
    function onImageLoaded(img) {
        if (!img || img.dataset.settled) return;
        img.dataset.settled = '1';
        img.classList.add('loaded');
        const card = img.closest('.photo-item');
        if (card) card.classList.add('loaded');
    }

    function bindImageLoad(img) {
        if (!img) return;
        if (img.complete && img.naturalWidth > 0) {
            onImageLoaded(img);
        } else {
            img.addEventListener('load', () => onImageLoaded(img), { once: true });
            img.addEventListener('error', () => onImageLoaded(img), { once: true });
        }
    }

    // ========================================
    // 首屏
    // ========================================

    allPhotoItems = Array.from(photoGrid.querySelectorAll('.photo-item'));
    initMasonry();
    allPhotoItems.forEach(item => {
        appendToShortest(item);
        bindImageLoad(item.querySelector('img'));
    });

    // 首屏图片全部加载后，用真实高度做一次精确重排
    const firstScreenImages = allPhotoItems.map(item => item.querySelector('img')).filter(Boolean);
    let loadedCount = 0;
    const totalFirst = firstScreenImages.length;

    function checkFirstScreenDone() {
        loadedCount++;
        if (loadedCount >= totalFirst && totalFirst > 0) {
            // 所有首屏图片已有真实尺寸，精确重排
            initMasonry();
            allPhotoItems.forEach(item => appendToShortest(item));
        }
    }

    firstScreenImages.forEach(img => {
        if (img.complete) {
            checkFirstScreenDone();
        } else {
            img.addEventListener('load', checkFirstScreenDone, { once: true });
            img.addEventListener('error', checkFirstScreenDone, { once: true });
        }
    });

    // 响应式重排
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (getColCount() !== masonryCols) {
                initMasonry();
                allPhotoItems.forEach(item => appendToShortest(item));
            }
        }, 200);
    });

    // ========================================
    // 无限滚动
    // ========================================

    let nextUrlEl = document.getElementById('next-page-url');
    const loadingSpinner = document.getElementById('loading-spinner');
    const noMoreData = document.getElementById('no-more-data');

    if (!nextUrlEl) {
        if (noMoreData) {
            noMoreData.classList.remove('hidden');
            noMoreData.classList.add('flex');
        }
        return;
    }

    const sentinel = nextUrlEl.parentElement;
    let isLoading = false;

    const loadMorePhotos = async () => {
        if (isLoading || !nextUrlEl) return;
        isLoading = true;
        if (loadingSpinner) loadingSpinner.classList.remove('hidden');

        try {
            const response = await fetch(nextUrlEl.href);
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const newItems = doc.querySelectorAll('.photo-item');

            if (newItems.length > 0) {
                const pending = [];

                newItems.forEach((item, index) => {
                    item.style.animationDelay = `${index * 35}ms`;
                    const img = item.querySelector('img');

                    if (img) {
                        img.onload = null;
                        const src = img.src || img.getAttribute('src') || '';
                        const preload = new Image();
                        preload.src = src;

                        pending.push({
                            item, img,
                            ready: new Promise(resolve => {
                                if (preload.complete && preload.naturalWidth > 0) {
                                    img._nw = preload.naturalWidth;
                                    img._nh = preload.naturalHeight;
                                    resolve();
                                } else {
                                    const t = setTimeout(resolve, 600);
                                    preload.onload = () => {
                                        clearTimeout(t);
                                        img._nw = preload.naturalWidth;
                                        img._nh = preload.naturalHeight;
                                        resolve();
                                    };
                                    preload.onerror = () => { clearTimeout(t); resolve(); };
                                }
                            })
                        });
                    } else {
                        pending.push({ item, img: null, ready: Promise.resolve() });
                    }
                });

                await Promise.all(pending.map(p => p.ready));

                pending.forEach(({ item, img }) => {
                    allPhotoItems.push(item);
                    appendToShortest(item);
                    bindImageLoad(img);
                });
            }

            const newNextUrlEl = doc.querySelector('#next-page-url');
            if (newNextUrlEl?.href) {
                nextUrlEl.href = newNextUrlEl.href;
            } else {
                nextUrlEl.remove();
                nextUrlEl = null;
                if (window._photoObserver) window._photoObserver.disconnect();
                if (noMoreData) {
                    noMoreData.classList.remove('hidden');
                    noMoreData.classList.add('flex');
                }
            }
        } catch (e) {
            console.error('[图库] 加载失败:', e);
        } finally {
            isLoading = false;
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        }
    };

    const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !isLoading) loadMorePhotos();
    }, { rootMargin: '300px' });

    window._photoObserver = observer;
    observer.observe(sentinel);
});

notifySwupPageReady();
