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
    img.tabIndex = img.getAttribute("aria-disabled") === "true" ? -1 : 0;
    if (!img.getAttribute("aria-label")) {
      img.setAttribute("aria-label", `打开图片：${img.alt?.trim() || "未命名图片"}`);
    }

    return img;
  }

  function getLightGalleryInstance() {
    const ids = [photoGrid.getAttribute("lg-uid"), photoGrid.getAttribute("data-lg-id")].filter(Boolean);
    return ids.map((id) => window.lgData?.[id]).find(Boolean) || null;
  }

  let lightGallerySyncPending = false;
  let lightGalleryRebuildTimer = null;
  let pendingLightGalleryTrigger = null;

  const handleLightGalleryRebuildClick = (event) => {
    if (lightGalleryRebuildTimer === null) return;
    const image = event.target.closest("img[data-photo-lightbox-trigger]");
    if (!image || image.getAttribute("aria-disabled") === "true") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pendingLightGalleryTrigger = image;
  };
  photoGrid.addEventListener("click", handleLightGalleryRebuildClick, true);

  function syncLightGalleryItems() {
    if (disposed) return;

    allPhotoItems.forEach((item) => ensureLightGalleryImageContract(item));
    // More pages may arrive during teardown. The eventual initializer queries
    // the latest DOM once; do not let another caller create an instance early.
    if (lightGalleryRebuildTimer !== null) return;

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

    // Legacy lightGallery has no refresh API. Do not close an active/closing
    // gallery when a page request finishes; update its items after close.
    if (instance.lGalleryOn || instance.outer?.isConnected) {
      lightGallerySyncPending = true;
      return;
    }

    lightGallerySyncPending = false;
    const settings = instance.s ? { ...instance.s } : { selector: "img" };
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    try {
      // lightgallery.js 1.4.0 restores its open-time scroll position even on
      // full teardown. Pagination must keep the viewport at append time.
      instance.destroy(true);
      // 1.4.0 removes .lg-backdrop globally after backdropDuration + 50ms.
      // Register after destroy's timer so that cleanup finishes before a new
      // instance (and a queued user click) can create its own backdrop.
      lightGalleryRebuildTimer = window.setTimeout(() => {
        lightGalleryRebuildTimer = null;
        if (disposed || !photoGrid.isConnected) return;
        window.lightGallery(photoGrid, settings);
        const trigger = pendingLightGalleryTrigger;
        pendingLightGalleryTrigger = null;
        if (trigger?.isConnected && trigger.getAttribute("aria-disabled") !== "true") trigger.click();
      }, Number(settings.backdropDuration ?? 150) + 50);
    } finally {
      if (!disposed && (window.scrollX !== scrollX || window.scrollY !== scrollY)) {
        window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
      }
    }
  }

  const handleLightGalleryClose = () => {
    if (lightGallerySyncPending) syncLightGalleryItems();
  };
  photoGrid.addEventListener("onCloseAfter", handleLightGalleryClose);
  addCleanupTask(() => {
    lightGallerySyncPending = false;
    window.clearTimeout(lightGalleryRebuildTimer);
    lightGalleryRebuildTimer = null;
    pendingLightGalleryTrigger = null;
    photoGrid.removeEventListener("click", handleLightGalleryRebuildClick, true);
    photoGrid.removeEventListener("onCloseAfter", handleLightGalleryClose);
  });

  let masonryCols = 0;
  let masonryColNodes = [];
  let colHeights = [];
  const itemHeights = new Map();
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
    itemHeights.clear();

    for (let i = 0; i < masonryCols; i++) {
      const col = document.createElement("div");
      col.className = "flex-1 flex flex-col min-w-0";
      col.style.gap = GAP + "px";
      photoGrid.appendChild(col);
      masonryColNodes.push(col);
    }
  }

  function estimateHeight(img) {
    const dimensions = getImageDimensions(img);
    if (dimensions) {
      const { width, height } = dimensions;
      const colWidth = (photoGrid.offsetWidth - GAP * (masonryCols - 1)) / masonryCols;
      return (height / width) * colWidth;
    }
    return 200;
  }

  function getImageDimensions(img) {
    const width = Number(img?._nw || img?.naturalWidth || img?.getAttribute?.("width"));
    const height = Number(img?._nh || img?.naturalHeight || img?.getAttribute?.("height"));
    return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
      ? { width, height }
      : null;
  }

  function reserveImageDimensions(item) {
    const img = item?.querySelector("img");
    const dimensions = getImageDimensions(img);
    if (!dimensions) return;
    // Native width/height reserve the lazy image's aspect ratio. Updating only
    // the column estimate leaves the DOM at its 180px skeleton until decoding.
    img.setAttribute("width", String(dimensions.width));
    img.setAttribute("height", String(dimensions.height));
  }

  function appendToShortest(item) {
    if (!masonryColNodes.length) return;
    reserveImageDimensions(item);

    let minIdx = 0;
    for (let i = 1; i < masonryCols; i++) {
      if (colHeights[i] < colHeights[minIdx]) minIdx = i;
    }

    masonryColNodes[minIdx].appendChild(item);
    const height = estimateHeight(item.querySelector("img")) + GAP;
    itemHeights.set(item, height);
    colHeights[minIdx] += height;
  }

  // 更新估算值而不移动已有卡片，避免重试或迟到的图片加载打断焦点和滚动。
  function updateItemHeight(item) {
    reserveImageDimensions(item);
    const col = masonryColNodes.indexOf(item?.parentElement);
    if (col < 0 || !itemHeights.has(item)) return;
    const height = estimateHeight(item.querySelector("img")) + GAP;
    colHeights[col] += height - itemHeights.get(item);
    itemHeights.set(item, height);
  }

  // 每张图仅通知一次首次结算，尺寸更新与首次结算计数相互独立。
  function bindImageLoad(img, onSettled) {
    if (!img) return;
    const card = img.closest(".photo-item");
    const errorState = card?.querySelector(".photo-load-error");
    const retry = card?.querySelector(".photo-image-retry");
    const originalSource = img.getAttribute("src") || img.currentSrc || img.getAttribute("data-src") || "";
    let settled = false;
    let notified = false;

    const removeImageListeners = () => {
      img.removeEventListener("load", handleLoad);
      img.removeEventListener("error", handleError);
    };
    const settle = (success) => {
      if (disposed || settled) return;
      settled = true;
      removeImageListeners();
      img.dataset.settled = "1";
      img.classList.toggle("loaded", success);
      card?.classList.toggle("loaded", success);
      card?.classList.toggle("load-error", !success);
      if (errorState) errorState.hidden = success;
      img.tabIndex = success ? 0 : -1;
      if (success) {
        img._nw = img.naturalWidth;
        img._nh = img.naturalHeight;
        img.removeAttribute("aria-disabled");
      } else {
        delete img._nw;
        delete img._nh;
        img.setAttribute("aria-disabled", "true");
        if (document.activeElement === img) retry?.focus({ preventScroll: true });
      }
      updateItemHeight(card);
      if (!notified) {
        notified = true;
        onSettled?.();
      }
    };
    const handleLoad = () => settle(img.naturalWidth > 0);
    const handleError = () => settle(false);
    const listen = () => {
      img.addEventListener("load", handleLoad, { once: true });
      img.addEventListener("error", handleError, { once: true });
    };
    const handleImageRetry = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (disposed || !settled || !card?.classList.contains("load-error") || !originalSource) return;

      settled = false;
      delete img.dataset.settled;
      card.classList.remove("load-error");
      if (errorState) errorState.hidden = true;
      if (document.activeElement === retry) img.focus({ preventScroll: true });
      // 重新请求原 URL，保留签名与查询参数；仅由用户触发，不自动循环重试。
      img.removeAttribute("src");
      listen();
      img.src = originalSource;
      if (img.complete) settle(img.naturalWidth > 0);
    };

    retry?.addEventListener("click", handleImageRetry);
    addCleanupTask(() => {
      removeImageListeners();
      retry?.removeEventListener("click", handleImageRetry);
    });
    listen();
    if (img.complete) settle(img.naturalWidth > 0);
  }

  // ========================================
  // 首屏
  // ========================================

  // 首屏先按估算值分列，全部结算后按已知尺寸做一次均衡重排。
  allPhotoItems = Array.from(photoGrid.querySelectorAll(".photo-item"));
  const firstScreenImages = allPhotoItems.map((item) => item.querySelector("img")).filter(Boolean);
  let loadedCount = 0;
  const totalFirst = firstScreenImages.length;

  function checkFirstScreenDone() {
    if (disposed) return;
    loadedCount++;
    if (loadedCount !== totalFirst || totalFirst === 0) return;

    const activeElement = photoGrid.contains(document.activeElement) ? document.activeElement : null;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    initMasonry();
    allPhotoItems.forEach((item) => appendToShortest(item));
    if (activeElement && document.activeElement !== activeElement) activeElement.focus({ preventScroll: true });
    if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
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
      } else {
        allPhotoItems.forEach((item) => updateItemHeight(item));
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
  let continuationFrame = null;

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
    if (continuationFrame !== null) window.cancelAnimationFrame(continuationFrame);
    continuationFrame = null;
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
  const pageKey = (href) => {
    const url = new URL(href, window.location.href);
    url.hash = "";
    url.searchParams.sort();
    return url.href;
  };
  const loadedPages = new Set([pageKey(window.location.href)]);

  const loadMorePhotos = async () => {
    if (disposed || isLoading || !nextUrlEl) return;
    isLoading = true;
    let canContinue = false;
    if (loadingSpinner) loadingSpinner.classList.remove("hidden");
    loadError?.classList.add("hidden");

    try {
      const requestedPage = pageKey(nextUrlEl.href);
      if (loadedPages.has(requestedPage)) throw new Error("Repeated photo page URL");
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
                    // 超时后预加载仍可能完成；失败的实际图片保持占位估算。
                    if (!disposed && img.dataset.settled !== "1") {
                      img._nw = preload.naturalWidth;
                      img._nh = preload.naturalHeight;
                      updateItemHeight(item);
                    }
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

      loadedPages.add(requestedPage);
      const newNextUrlEl = doc.querySelector("#next-page-url");
      if (newNextUrlEl?.href) {
        nextUrlEl.href = newNextUrlEl.href;
        if (loadedPages.has(pageKey(nextUrlEl.href))) throw new Error("Repeated photo next-page URL");
        canContinue = true;
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
      // Small pages can leave the sentinel intersecting throughout the append.
      // IntersectionObserver will not emit another entry until that state changes.
      if (canContinue && !disposed) {
        continuationFrame = window.requestAnimationFrame(() => {
          continuationFrame = null;
          if (disposed || !nextUrlEl) return;
          const rect = sentinel.getBoundingClientRect();
          if (rect.top <= window.innerHeight + 300 && rect.bottom >= -300) void loadMorePhotos();
        });
      }
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
