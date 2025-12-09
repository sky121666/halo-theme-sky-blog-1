/**
 * 文档页脚本
 * 功能: 目录生成、版本选择器、图片懒加载
 */

import './doc.css';

// 图片懒加载与渐显
function initLazyLoad() {
  const images = document.querySelectorAll('#article-content img');
  if (!images.length) return;

  images.forEach((img) => {
    // 设置原生懒加载
    if (!img.loading) {
      img.loading = 'lazy';
      img.decoding = 'async';
    }

    // 加载完成渐显
    if (img.complete) {
      img.classList.add('loaded');
    } else {
      img.addEventListener('load', () => img.classList.add('loaded'), {
        once: true,
      });
    }
  });
}

// 目录生成 (使用 Intersection Observer 优化)
function initTOC() {
  const tocNav = document.getElementById('toc-nav');
  const tocCard = document.getElementById('toc-card');
  const content = document.getElementById('article-content');

  if (!tocNav || !content) return;

  const allHeadings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (!allHeadings.length) {
    if (tocCard) tocCard.style.display = 'none';
    return;
  }

  const levels = Array.from(allHeadings, (h) => +h.tagName[1]);
  const minLevel = Math.min(...levels);
  const headings = Array.from(allHeadings).filter(
    (h) => +h.tagName[1] <= minLevel + 2
  );

  if (!headings.length) {
    if (tocCard) tocCard.style.display = 'none';
    return;
  }

  // 生成列表
  const frag = document.createDocumentFragment();
  const list = document.createElement('ol');
  list.className = 'toc-list';

  headings.forEach((h, i) => {
    if (!h.id) h.id = `heading-${i}`;

    const li = document.createElement('li');
    li.className = 'toc-item-wrapper';

    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.className = 'toc-link';
    a.textContent = h.textContent.trim();
    a.dataset.relativeLevel = +h.tagName[1] - minLevel;

    li.appendChild(a);
    list.appendChild(li);
  });

  frag.appendChild(list);
  tocNav.innerHTML = '';
  tocNav.appendChild(frag);

  // 平滑滚动（事件委托）
  tocNav.addEventListener('click', (e) => {
    const link = e.target.closest('.toc-link');
    if (!link) return;
    e.preventDefault();
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) {
      window.scrollTo({
        top: target.offsetTop - 80,
        behavior: 'smooth',
      });
    }
  });

  // 滚动高亮 (Intersection Observer)
  const links = tocNav.querySelectorAll('.toc-link');
  let currentActive = -1;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const idx = headings.indexOf(entry.target);
        if (entry.isIntersecting && idx !== -1) {
          if (currentActive !== idx) {
            links.forEach((l, i) => l.classList.toggle('active', i === idx));
            currentActive = idx;
          }
        }
      });
    },
    { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
  );

  headings.forEach((h) => observer.observe(h));
}

// 版本选择器
function initDropdowns() {
  document.addEventListener(
    'click',
    (e) => {
      document.querySelectorAll('.doc-version-dropdown.show').forEach((d) => {
        if (!d.closest('.doc-version-selector')?.contains(e.target)) {
          d.classList.remove('show');
        }
      });
    },
    { passive: true }
  );
}

// 初始化
function init() {
  initLazyLoad();
  initTOC();
  initDropdowns();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
