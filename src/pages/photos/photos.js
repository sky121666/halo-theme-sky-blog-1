/**
 * 图库页面脚本
 * - JS 物理分列瀑布流（基于宽高比预估高度）
 * - IntersectionObserver 无限滚动懒加载
 */
import "./photos.css";
import { skyDebug } from "../../common/js/debug.js";
import { notifySwupPageReady, runPageInit } from "../../common/js/page-runtime.js";

function initPhotosPage() {
  window.__skyPhotosCleanup?.();
  window.__skyPhotosCleanup = null;

  const photoGrid = document.getElementById("photo-grid");
  if (!photoGrid) return;

  let disposed = false;
  const requestController = new AbortController();
  const cleanupTasks = [];
  const addCleanupTask = (task) => {
    if (typeof task === "function") cleanupTasks.push(task);
  };

  // 从模板注入的 data-* 属性读取后端配置
  const GAP = parseInt(photoGrid.dataset.gap ?? "16", 10);
  const maxCols = parseInt(photoGrid.dataset.maxCols ?? "4", 10);
  const borderRadius = parseInt(photoGrid.dataset.borderRadius ?? "12", 10);

  // 将圆角以 CSS 变量方式注入，所有 photo-item（含无限滚动加载的）自动继承
  photoGrid.style.setProperty("--photo-radius", borderRadius + "px");
  const handleGridClick = (event) => {
    if (event.target.closest(".photo-detail-btn, .photo-download-btn")) {
      event.stopPropagation();
    }
  };
  const handleGridKeydown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const trigger = event.target.closest("img[data-photo-lightbox-trigger]");
    if (!trigger || !photoGrid.contains(trigger)) return;

    event.preventDefault();
    trigger.click();
  };
  photoGrid.addEventListener("click", handleGridClick);
  photoGrid.addEventListener("keydown", handleGridKeydown);

  function ensureLightGalleryImageContract(item) {
    const img = item?.matches?.("img") ? item : item?.querySelector?.("img");
    if (!img) return null;

    const src = img.getAttribute("data-src") || img.getAttribute("src") || img.currentSrc || "";
    if (src && !img.getAttribute("data-src")) {
      img.setAttribute("data-src", src);
    }

    img.setAttribute("data-photo-lightbox-trigger", "");
    img.setAttribute("role", "button");
    img.tabIndex = 0;
    if (!img.getAttribute("aria-label")) {
      img.setAttribute("aria-label", `打开图片：${img.alt?.trim() || "未命名图片"}`);
    }

    return img;
  }

  function getLightGalleryInstance() {
    const ids = [photoGrid.getAttribute("lg-uid"), photoGrid.getAttribute("data-lg-id")].filter(Boolean);
    return ids.map((id) => window.lgData?.[id]).find(Boolean) || null;
  }

  function syncLightGalleryItems() {
    if (disposed) return;

    allPhotoItems.forEach((item) => ensureLightGalleryImageContract(item));

    const instance = getLightGalleryInstance();
    if (!instance) {
      window.SkyLightGallery?.initNow?.();
      return;
    }

    if (typeof instance.refresh === "function") {
      instance.refresh();
      return;
    }

    if (typeof instance.destroy !== "function" || typeof window.lightGallery !== "function") return;

    const settings = instance.s ? { ...instance.s } : { selector: "img" };
    instance.destroy(true);
    window.lightGallery(photoGrid, settings);
  }

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
    photoGrid.className = "flex items-start w-full";
    photoGrid.style.gap = GAP + "px";
    photoGrid.innerHTML = "";
    masonryColNodes = [];
    colHeights = new Array(masonryCols).fill(0);

    for (let i = 0; i < masonryCols; i++) {
      const col = document.createElement("div");
      col.className = "flex-1 flex flex-col min-w-0";
      col.style.gap = GAP + "px";
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
    colHeights[minIdx] += estimateHeight(item.querySelector("img")) + GAP;
  }

  // 图片加载完成
  function onImageLoaded(img) {
    if (disposed) return;
    if (!img || img.dataset.settled) return;
    img.dataset.settled = "1";
    img.classList.add("loaded");
    const card = img.closest(".photo-item");
    if (card) card.classList.add("loaded");
  }

  function bindImageLoad(img, onSettled) {
    if (!img) return;
    const settle = () => {
      onImageLoaded(img);
      onSettled?.();
    };

    if (img.complete) {
      settle();
      return;
    }

    img.addEventListener("load", settle, { once: true });
    img.addEventListener("error", settle, { once: true });
    addCleanupTask(() => {
      img.removeEventListener("load", settle);
      img.removeEventListener("error", settle);
    });
  }

  // ========================================
  // 首屏
  // ========================================

  // 首屏图片全部加载后，用真实高度做一次精确重排
  allPhotoItems = Array.from(photoGrid.querySelectorAll(".photo-item"));
  const firstScreenImages = allPhotoItems.map((item) => item.querySelector("img")).filter(Boolean);
  let loadedCount = 0;
  const totalFirst = firstScreenImages.length;

  function checkFirstScreenDone() {
    if (disposed) return;
    loadedCount++;
    if (loadedCount >= totalFirst && totalFirst > 0) {
      // 所有首屏图片已有真实尺寸，精确重排
      initMasonry();
      allPhotoItems.forEach((item) => appendToShortest(item));
    }
  }

  initMasonry();
  allPhotoItems.forEach((item) => {
    appendToShortest(item);
    bindImageLoad(item.querySelector("img"), checkFirstScreenDone);
  });

  // 响应式重排
  let resizeTimer;
  const handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (getColCount() !== masonryCols) {
        initMasonry();
        allPhotoItems.forEach((item) => appendToShortest(item));
      }
    }, 200);
  };
  window.addEventListener("resize", handleResize);

  // ========================================
  // 无限滚动
  // ========================================

  let nextUrlEl = document.getElementById("next-page-url");
  const loadingSpinner = document.getElementById("loading-spinner");
  const noMoreData = document.getElementById("no-more-data");
  const loadError = document.getElementById("photos-load-error");
  const retryButton = document.getElementById("photos-load-retry");
  let observer = null;
  let handleRetry = null;

  let cleaned = false;
  let unregisterPjaxCleanup = null;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    disposed = true;
    requestController.abort();
    clearTimeout(resizeTimer);
    cleanupTasks.splice(0).forEach((task) => task());
    photoGrid.removeEventListener("click", handleGridClick);
    photoGrid.removeEventListener("keydown", handleGridKeydown);
    window.removeEventListener("resize", handleResize);
    if (handleRetry) retryButton?.removeEventListener("click", handleRetry);
    observer?.disconnect();
    unregisterPjaxCleanup?.();
    unregisterPjaxCleanup = null;
    if (window.__skyPhotosCleanup === cleanup) {
      window.__skyPhotosCleanup = null;
    }
  };

  window.__skyPhotosCleanup = cleanup;
  if (window.SkyPjax?.onCleanup) {
    unregisterPjaxCleanup = window.SkyPjax.onCleanup(cleanup);
  } else {
    document.addEventListener("sky:page-cleanup", cleanup, { once: true });
  }

  if (!nextUrlEl) {
    if (noMoreData) {
      noMoreData.classList.remove("hidden");
      noMoreData.classList.add("flex");
    }
    return;
  }

  const sentinel = nextUrlEl.parentElement;
  let isLoading = false;

  const loadMorePhotos = async () => {
    if (disposed || isLoading || !nextUrlEl) return;
    isLoading = true;
    if (loadingSpinner) loadingSpinner.classList.remove("hidden");
    loadError?.classList.add("hidden");

    try {
      const response = await fetch(nextUrlEl.href, { signal: requestController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      if (disposed) return;
      const newItems = doc.querySelectorAll(".photo-item");

      if (newItems.length > 0) {
        const pending = [];

        newItems.forEach((item, index) => {
          item.style.animationDelay = `${index * 35}ms`;
          const img = item.querySelector("img");

          if (img) {
            img.onload = null;
            const src = img.src || img.getAttribute("src") || "";
            const preload = new Image();
            preload.src = src;

            pending.push({
              item,
              img,
              ready: new Promise((resolve) => {
                if (preload.complete && preload.naturalWidth > 0) {
                  img._nw = preload.naturalWidth;
                  img._nh = preload.naturalHeight;
                  resolve();
                } else {
                  const t = setTimeout(resolve, 600);
                  addCleanupTask(() => {
                    clearTimeout(t);
                    preload.onload = null;
                    preload.onerror = null;
                  });
                  preload.onload = () => {
                    clearTimeout(t);
                    img._nw = preload.naturalWidth;
                    img._nh = preload.naturalHeight;
                    resolve();
                  };
                  preload.onerror = () => {
                    clearTimeout(t);
                    resolve();
                  };
                }
              }),
            });
          } else {
            pending.push({ item, img: null, ready: Promise.resolve() });
          }
        });

        await Promise.all(pending.map((p) => p.ready));
        if (disposed) return;

        pending.forEach(({ item, img }) => {
          allPhotoItems.push(item);
          appendToShortest(item);
          bindImageLoad(img);
        });

        syncLightGalleryItems();
      }

      const newNextUrlEl = doc.querySelector("#next-page-url");
      if (newNextUrlEl?.href) {
        nextUrlEl.href = newNextUrlEl.href;
      } else {
        nextUrlEl.remove();
        nextUrlEl = null;
        observer?.disconnect();
        if (noMoreData) {
          noMoreData.classList.remove("hidden");
          noMoreData.classList.add("flex");
        }
      }
    } catch (e) {
      if (disposed || e?.name === "AbortError") return;
      skyDebug.error("photos", "加载失败", e);
      observer?.disconnect();
      loadError?.classList.remove("hidden");
    } finally {
      isLoading = false;
      if (loadingSpinner) loadingSpinner.classList.add("hidden");
    }
  };

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !isLoading) loadMorePhotos();
    },
    { rootMargin: "300px" },
  );

  handleRetry = () => {
    loadError?.classList.add("hidden");
    if (sentinel) observer?.observe(sentinel);
    loadMorePhotos();
  };
  retryButton?.addEventListener("click", handleRetry);

  observer.observe(sentinel);
}

if (window.SkyPjax?.onPage) {
  window.SkyPjax.onPage(initPhotosPage, { immediate: false });
} else {
  runPageInit(initPhotosPage);
}

notifySwupPageReady();
