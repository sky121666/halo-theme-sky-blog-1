import GLightbox from "glightbox";
import "glightbox/dist/css/glightbox.css";

function readSlides(root, selector) {
  const slides = new Map();
  for (const node of root.querySelectorAll(selector)) {
    const image = node.matches("img") ? node : node.querySelector("img");
    const href = node.getAttribute("data-src") || image?.getAttribute("data-src") ||
      node.getAttribute("href") || image?.getAttribute("src") || image?.currentSrc;
    if (href && !node.closest('[aria-disabled="true"]') && !image?.matches('[aria-disabled="true"]')) {
      slides.set(node, { href, type: "image", alt: image?.alt || "" });
    }
  }
  return slides;
}

function releasePluginGallery(root) {
  const existing = window.lgData?.[root.getAttribute("lg-uid")];
  if (!existing) return;
  const position = { left: window.scrollX, top: window.scrollY };
  existing.destroy(true);
  if (window.scrollX !== position.left || window.scrollY !== position.top) {
    window.scrollTo({ ...position, behavior: "instant" });
  }
}

function mountGallery(roots, signal) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gallery = GLightbox({
    selector: null,
    openEffect: reduced ? "none" : "fade",
    closeEffect: "none",
    slideEffect: reduced ? "none" : "slide",
    loop: true,
  });
  let openRoot;
  let openSlides;
  let trigger;

  gallery.on("open", () => {
    const dialog = document.getElementById("glightbox-body");
    dialog.setAttribute("aria-label", "图片预览");
    dialog.setAttribute("aria-modal", "true");
    dialog.querySelector(".gclose")?.setAttribute("aria-label", "关闭图片预览");
    dialog.querySelector(".gprev")?.setAttribute("aria-label", "上一张");
    dialog.querySelector(".gnext")?.setAttribute("aria-label", "下一张");
    dialog.focus({ preventScroll: true });
  });
  gallery.on("close", () => {
    if (!signal.aborted && trigger?.isConnected && !document.activeElement?.closest?.("[inert]")) {
      trigger.focus({ preventScroll: true });
    }
    openRoot = openSlides = trigger = undefined;
  });

  for (const [root, selector] of roots) {
    releasePluginGallery(root);
    root.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const node = event.target.closest?.(selector);
      if (!node || !root.contains(node)) return;
      if (openRoot || event.target.closest?.('[aria-disabled="true"]')) {
        event.preventDefault();
        return;
      }
      const slides = readSlides(root, selector);
      const index = Array.from(slides.keys()).indexOf(node);
      if (index === -1) return;

      event.preventDefault();
      trigger = node.tabIndex >= 0 ? node : node.closest("a[href]") || document.activeElement;
      openRoot = root;
      openSlides = slides;
      gallery.setElements(Array.from(slides.values()));
      gallery.openAt(index);
    }, { signal });

    root.addEventListener("sky:gallery-items", () => {
      if (openRoot !== root) return;
      const hadOneImage = openSlides.size === 1;
      for (const [node, slide] of readSlides(root, selector)) {
        if (openSlides.has(node)) continue;
        gallery.insertSlide(slide);
        openSlides.set(node, slide);
      }
      if (hadOneImage && openSlides.size > 1) {
        document.querySelectorAll("#glightbox-body :is(.gprev, .gnext)").forEach(
          (button) => button.classList.remove("glightbox-button-hidden"));
      }
    }, { signal });
  }

  signal.addEventListener("abort", () => {
    const openDialog = document.getElementById("glightbox-body");
    if (openDialog && trigger?.isConnected) trigger.focus({ preventScroll: true });
    gallery.destroy();
  }, { once: true });
}

export function mountGalleries(content, specs, signal, initial) {
  const mount = () => {
    if (signal.aborted) return;
    const roots = new Map();
    for (const { root, selector } of specs) {
      for (const element of content.querySelectorAll(root)) {
        if (!roots.has(element)) roots.set(element, selector);
      }
    }
    if (roots.size) mountGallery(roots, signal);
  };
  if (initial && !performance.getEntriesByType("navigation")[0]?.domContentLoadedEventStart) {
    document.addEventListener("DOMContentLoaded", mount, { once: true, signal });
  } else {
    mount();
  }
}
