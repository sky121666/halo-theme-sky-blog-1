/**
 * TOC 目录导航公共工具函数
 * 适用于 post、doc 等需要目录的页面
 */

/** Preserve author IDs and reserve unique IDs for headings without one. */
export function ensureHeadingIds(headingElements) {
  const usedIds = new Set(Array.from(headingElements, heading => heading.id).filter(Boolean));
  headingElements.forEach((heading, index) => {
    if (heading.id) return;
    const baseId = `heading-${index}`;
    let id = baseId;
    let suffix = 1;
    // The document check also reserves IDs on non-heading and filtered headings.
    while (usedIds.has(id) || document.getElementById(id)) id = `${baseId}-${suffix++}`;
    heading.id = id;
    usedIds.add(id);
  });
}

/**
 * 构建动态目录树结构 - 基于相对层级
 * @param {Array} headingElements - 过滤后的标题元素列表
 * @param {number} minLevel - 最小层级（基准层级）
 * @returns {Array} 目录树数据
 */
export function buildDynamicTocTree(headingElements, minLevel) {
  const tocTree = [];
  const stack = [];
  ensureHeadingIds(headingElements);

  headingElements.forEach((headingElement) => {
    const absoluteLevel = parseInt(headingElement.tagName.charAt(1));
    const relativeLevel = absoluteLevel - minLevel;

    const tocItem = {
      id: headingElement.id,
      text: headingElement.textContent.trim(),
      absoluteLevel: absoluteLevel,
      relativeLevel: relativeLevel,
      element: headingElement,
      children: [],
    };

    // 清理栈，移除比当前级别高或相等的节点
    while (stack.length > 0 && stack[stack.length - 1].relativeLevel >= relativeLevel) {
      stack.pop();
    }

    // 添加到父节点或根节点
    if (stack.length === 0) {
      tocTree.push(tocItem);
    } else {
      stack[stack.length - 1].children.push(tocItem);
    }

    stack.push(tocItem);
  });

  return tocTree;
}

/**
 * 递归创建动态目录HTML结构
 * @param {Array} tocTree - 树形结构数据
 * @param {Object} options - 可选配置
 * @returns {HTMLElement} 生成的ol元素
 */
export function createDynamicTocHTML(tocTree, options = {}) {
  const {
    addTooltip = false,  // 是否添加 tooltip
    onClick = null       // 点击回调函数
  } = options;

  const ol = document.createElement('ol');
  ol.className = 'toc-list';

  tocTree.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'toc-item-wrapper';

    // 设置动态缩进级别
    li.style.setProperty('--toc-indent-multiplier', item.relativeLevel.toString());

    // 创建目录链接
    const linkElement = document.createElement('a');
    linkElement.href = `#${encodeURIComponent(item.id)}`;
    linkElement.textContent = item.text;
    linkElement.className = addTooltip ? 'toc-link tooltip tooltip-right' : 'toc-link';

    // 设置数据属性
    linkElement.setAttribute('data-relative-level', item.relativeLevel.toString());
    linkElement.setAttribute('data-absolute-level', item.absoluteLevel.toString());
    linkElement.setAttribute('data-heading-id', item.id);

    // 添加 tooltip
    if (addTooltip) {
      linkElement.setAttribute('data-tip', item.text);
    }

    // 添加点击事件
    if (onClick) {
      linkElement.setAttribute('data-no-swup', '');
      linkElement.addEventListener('click', (event) => {
        if (!isPlainTocClick(event)) return;
        event.preventDefault();
        onClick(item.element, event);
      });
    }

    li.appendChild(linkElement);

    // 递归创建子节点
    if (item.children.length > 0) {
      const childrenOl = createDynamicTocHTML(item.children, options);
      li.appendChild(childrenOl);
    }

    ol.appendChild(li);
  });

  return ol;
}

/**
 * 平滑滚动到指定标题
 * @param {HTMLElement} headingElement - 目标标题元素
 * @param {number} offset - 偏移量（默认 80px，导航栏高度）
 */
export function smoothScrollToHeading(headingElement, offset = 80, { updateHash = true, behavior = 'smooth' } = {}) {
  if (!headingElement || !headingElement.isConnected) return;

  // Match Swup's same-page anchor behavior: update this entry, keep its index.
  if (updateHash && headingElement.id) {
    const url = new URL(window.location.href);
    url.hash = encodeURIComponent(headingElement.id);
    const nextUrl = url.pathname + url.search + url.hash;
    window.history.replaceState({ ...window.history.state, url: nextUrl }, '', nextUrl);
  }
  const targetPosition = Math.max(0, headingDocumentTop(headingElement) - offset);

  window.scrollTo({
    top: targetPosition,
    behavior
  });
}

/**
 * 分析标题层级结构
 * @param {NodeList} headingElements - 所有标题元素
 * @returns {Object} 层级分析结果
 */
export function analyzeHeadingHierarchy(headingElements) {
  const headingArray = Array.from(headingElements);

  // 获取所有标题的级别
  const levels = headingArray.map(heading => parseInt(heading.tagName.charAt(1)));

  // 找到最小级别（最高级标题）
  const minLevel = Math.min(...levels);

  // 计算最大显示层级（最多显示3级）
  const maxDisplayLevel = minLevel + 2;

  // 过滤标题：只保留前3个相对层级
  const filteredHeadings = headingArray.filter(heading => {
    const level = parseInt(heading.tagName.charAt(1));
    return level <= maxDisplayLevel;
  });

  return {
    filteredHeadings,
    minLevel,
    maxDisplayLevel,
    totalLevels: levels.length > 0 ? Math.max(...levels) - minLevel + 1 : 0
  };
}

/** Document coordinates also work for headings inside positioned ancestors. */
export function headingDocumentTop(element) {
  return element.getBoundingClientRect().top + window.scrollY;
}

export function isPlainTocClick(event) {
  return !event.defaultPrevented && event.button === 0 &&
    !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Restore fragment destinations after reveal transforms settle (including back/forward). */
export async function restoreHeadingFragment(content, signal) {
  const hash = window.location.hash;
  if (!content || !hash || signal?.aborted) return;
  let id = hash.slice(1);
  try { id = decodeURIComponent(id); } catch { /* A literal percent may be part of the ID. */ }
  const heading = [...content.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')]
    .find(element => element.id === id || element.id === hash.slice(1));
  if (!heading) return;
  // Reveal the destination before measuring: scrolling into an unrevealed
  // ancestor would otherwise start its translation after restoration.
  for (let element = heading; element; element = element.parentElement) {
    if (element.classList?.contains('lazy-anim')) element.classList.add('visible');
  }
  await new Promise(resolve => requestAnimationFrame(resolve));
  const animations = [];
  for (let element = heading; element; element = element.parentElement) {
    for (const animation of element.getAnimations?.() || []) {
      if (animation.effect?.getTiming().iterations !== Infinity) animations.push(animation.finished);
    }
  }
  await Promise.allSettled(animations);
  if (signal?.aborted || window.location.hash !== hash || !heading.isConnected) return;
  smoothScrollToHeading(heading, 80, { updateHash: false, behavior: 'instant' });
}
