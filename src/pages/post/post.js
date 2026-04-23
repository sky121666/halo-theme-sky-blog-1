/**
 * Sky Theme - 文章页面特定脚本
 * 仅在文章页面加载的JavaScript功能
 */

// 导入文章页面特定样式（已包含 article-content.css）
import './post.css';

// 导入公共文章内容脚本
import '../../static/js/article-content.js';

// 导入 TOC 公共工具函数
import {
  buildDynamicTocTree, 
  createDynamicTocHTML, 
  smoothScrollToHeading,
  analyzeHeadingHierarchy 
} from '../../common/js/toc-utils.js';
import {
    notifySwupPageReady,
    registerAlpinePageComponents,
    runPageInit
} from '../../common/js/page-runtime.js';

/**
 * 文章页 Alpine.js 组件
 * 使用 alpine:init 事件动态注册，避免加载顺序问题
 */
(function() {
  function _registerAlpineComponents() {
    /**
     * 文章摘要打字机效果组件
     */
    Alpine.data('articleExcerpt', () => ({
        typing: true,
        text: '',
        fullText: '',
        charIndex: 0,
        typingSpeed: 50, // 打字速度（毫秒）
        _typingTimer: null,
        _cleanupRegistered: false,

        init() {
            this.resetTypingState();

            // 从 data-text 属性获取完整文本
            const excerptEl = this.$refs.excerptText;
            if (excerptEl) {
                this.fullText = excerptEl.dataset.text || '';
                this.registerCleanup();
                this.startTyping();
            }
        },

        resetTypingState() {
            this.clearTypingTimer();
            this.typing = true;
            this.text = '';
            this.fullText = '';
            this.charIndex = 0;
        },

        clearTypingTimer() {
            if (this._typingTimer) {
                clearTimeout(this._typingTimer);
                this._typingTimer = null;
            }
        },

        registerCleanup() {
            if (this._cleanupRegistered) return;
            this._cleanupRegistered = true;
            document.addEventListener('sky:page-cleanup', () => {
                this.clearTypingTimer();
            }, { once: true });
        },

        startTyping() {
            const excerptEl = this.$refs.excerptText;
            if (!excerptEl || !excerptEl.isConnected) {
                this.clearTypingTimer();
                return;
            }

            if (this.charIndex < this.fullText.length) {
                this.text += this.fullText.charAt(this.charIndex);
                excerptEl.textContent = this.text;
                this.charIndex++;
                
                // 根据标点符号调整打字速度
                const currentChar = this.fullText.charAt(this.charIndex - 1);
                let delay = this.typingSpeed;
                
                if ('，。！？、；：'.includes(currentChar)) {
                    delay = 200; // 标点符号后稍作停顿
                } else if (',.!?;:'.includes(currentChar)) {
                    delay = 150;
                }
                
                this._typingTimer = setTimeout(() => this.startTyping(), delay);
            } else {
                // 打字完成，隐藏光标
                this._typingTimer = setTimeout(() => {
                    this.typing = false;
                }, 500);
            }
        }
    }));

    /**
     * 文章页点赞组件
     */
    Alpine.data('postLike', () => ({
        isLiked: false,
        likeCount: 0,
        postName: '',

        init() {
            // 从父级 Dock 元素读取文章数据
            const dockElement = this.$el.closest('[data-post-name]');
            if (dockElement) {
                this.postName = dockElement.dataset.postName || '';
                this.likeCount = parseInt(dockElement.dataset.upvoteCount || '0');

                // 检查点赞状态
                this.checkLikeStatus();
            }
        },

        checkLikeStatus() {
            if (!this.postName) return;

            // 从 localStorage 读取已点赞列表
            const upvotedNames = JSON.parse(
                localStorage.getItem('halo.upvoted.post.names') || '[]'
            );

            // 判断当前文章是否已点赞
            this.isLiked = upvotedNames.includes(this.postName);
        },

        async toggleLike() {
            if (!this.postName) {
                // console.warn('文章名称未找到');
                return;
            }

            // 检查是否已点赞（防止重复）
            if (this.isLiked) {
                // console.log('已经点赞过了');
                return;
            }

            try {
                // console.log('发送点赞请求:', this.postName);

                // 调用 Halo 官方点赞 API
                const response = await fetch('/apis/api.halo.run/v1alpha1/trackers/upvote', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        group: 'content.halo.run',
                        plural: 'posts',
                        name: this.postName
                    })
                });

                // console.log('点赞响应状态:', response.status);

                if (response.ok) {
                    // console.log('点赞成功');

                    // 更新点赞状态
                    this.isLiked = true;
                    this.likeCount += 1;

                    // 保存到 localStorage
                    const upvotedNames = JSON.parse(
                        localStorage.getItem('halo.upvoted.post.names') || '[]'
                    );
                    if (!upvotedNames.includes(this.postName)) {
                        upvotedNames.push(this.postName);
                        localStorage.setItem(
                            'halo.upvoted.post.names',
                            JSON.stringify(upvotedNames)
                        );
                    }
                } else {
                    await response.text();
                    // console.error('点赞失败:', response.status, errorText);
                }
            } catch {
                // console.error('点赞请求错误:', error);
            }
        }
    }));

    /**
     * 文章页评论数量组件
     */
    Alpine.data('postComment', () => ({
        commentCount: 0,

        init() {
            // 从父级 Dock 元素读取评论数据
            const dockElement = this.$el.closest('[data-comment-count]');
            if (dockElement) {
                this.commentCount = parseInt(dockElement.dataset.commentCount || '0');
            }
        },

        toggleCommentDrawer() {
            const checkbox = document.getElementById('comment-drawer');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
            }
        }
    }));
}
  registerAlpinePageComponents(_registerAlpineComponents);
})();

/**
 * 文章页面功能管理器
 * 使用单一作用域避免压缩时变量名冲突
 */
(function () {
    'use strict';

    // AbortController for page-level event listeners — aborted on each PJAX navigation
    let _pageAbort = null;

    function isPostPage() {
        return Boolean(
            document.getElementById('article-content') &&
            document.querySelector('[data-post-name]')
        );
    }

    function cleanupPostPage() {
        _pageAbort?.abort();
        _pageAbort = null;
        document.body.style.overflow = '';
        window.openPostTocDrawer = undefined;
        window.closePostTocDrawer = undefined;
    }

    /**
     * 文章页面管理器
     */
    const pageManager = {
        /**
         * 初始化所有功能
         */
        init() {
            // 中止旧页监听器，创建新信号
            _pageAbort?.abort();
            _pageAbort = new AbortController();
            this._signal = _pageAbort.signal;

            this.initWordCount();
            this.initHeadingAnchors();
            this.initTOC();
            this.initReadingProgress();
            this.initCodeCopy();
            this.initScrollToTop();
            this.initTocDrawer();
        },

        /**
         * 初始化目录抽屉（原生实现）
         */
        initTocDrawer() {
            const overlay = document.getElementById('post-toc-overlay');
            const drawer = document.getElementById('post-toc-drawer');
            const drawerNav = document.getElementById('post-toc-drawer-nav');

            if (!overlay || !drawer) return;

            // 每次初始时清空小窗目录缓存，确保新文章目录正确生成
            if (drawerNav) drawerNav.innerHTML = '';

            // 暴露全局方法
            window.openPostTocDrawer = () => {
                overlay.classList.add('open');
                drawer.classList.add('open');
                document.body.style.overflow = 'hidden';

                // 初始化目录内容
                if (drawerNav && !drawerNav.querySelector('.toc-list')) {
                    this.initTocDrawerContent(drawerNav);
                }
            };

            window.closePostTocDrawer = () => {
                overlay.classList.remove('open');
                drawer.classList.remove('open');
                document.body.style.overflow = '';
            };

            // ESC 键关闭（使用 abort signal 自动清理）
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && drawer.classList.contains('open')) {
                    window.closePostTocDrawer();
                }
            }, { signal: this._signal });
        },

        /**
         * 初始化目录抽屉内容
         */
        initTocDrawerContent(drawerNav) {
            // 优先复制侧边栏目录
            const tocNav = document.getElementById('toc-nav');
            if (tocNav && tocNav.innerHTML.trim()) {
                drawerNav.innerHTML = tocNav.innerHTML;
                this.bindTocDrawerEvents(drawerNav);
                return;
            }

            // 自行生成目录
            const articleContent = document.getElementById('article-content');
            if (!articleContent) {
                drawerNav.innerHTML = '<p class="text-base-content/50 text-sm">暂无目录</p>';
                return;
            }

            const headings = articleContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
            if (headings.length === 0) {
                drawerNav.innerHTML = '<p class="text-base-content/50 text-sm">暂无目录</p>';
                return;
            }

            // 生成目录
            const headingArray = Array.from(headings);
            const levels = headingArray.map(h => parseInt(h.tagName.charAt(1)));
            const minLevel = Math.min(...levels);

            const ol = document.createElement('ol');
            ol.className = 'toc-list';

            headingArray.forEach((heading, index) => {
                if (!heading.id) heading.id = `heading-${index}`;
                const level = parseInt(heading.tagName.charAt(1));
                const relativeLevel = level - minLevel;

                const li = document.createElement('li');
                li.className = 'toc-item-wrapper';
                li.style.setProperty('--toc-indent-multiplier', relativeLevel.toString());

                const link = document.createElement('a');
                link.href = `#${heading.id}`;
                link.textContent = heading.textContent.trim();
                link.className = 'toc-link';
                link.setAttribute('data-heading-id', heading.id);

                li.appendChild(link);
                ol.appendChild(li);
            });

            drawerNav.appendChild(ol);
            this.bindTocDrawerEvents(drawerNav);
        },

        /**
         * 绑定目录抽屉点击事件
         */
        bindTocDrawerEvents(container) {
            const links = container.querySelectorAll('.toc-link');
            links.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const headingId = link.getAttribute('data-heading-id') || link.getAttribute('href').slice(1);
                    const heading = document.getElementById(headingId);
                    if (heading) {
                        window.closePostTocDrawer();
                        setTimeout(() => {
                            window.scrollTo({
                                top: heading.offsetTop - 80,
                                behavior: 'smooth'
                            });
                        }, 100);
                    }
                });
            });
        },

        /**
         * 初始化标题锚点链接
         */
        initHeadingAnchors() {
            const articleContent = document.getElementById('article-content');
            if (!articleContent) return;

            const headings = articleContent.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');

            headings.forEach(heading => {
                const id = heading.getAttribute('id');
                if (!id) return;

                // 创建锚点链接包装器
                heading.style.position = 'relative';
                heading.style.cursor = 'pointer';

                // 创建锚点图标
                const anchor = document.createElement('a');
                anchor.href = `#${id}`;
                anchor.className = 'heading-anchor';
                anchor.innerHTML = '<span class="icon-[heroicons--link] w-4 h-4"></span>';
                anchor.setAttribute('aria-label', '复制链接');
                anchor.style.cssText = `
                    position: absolute;
                    left: -1.5em;
                    top: 50%;
                    transform: translateY(-50%);
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    color: var(--color-primary);
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                `;

                // 悬停显示
                heading.addEventListener('mouseenter', () => {
                    anchor.style.opacity = '1';
                });

                heading.addEventListener('mouseleave', () => {
                    anchor.style.opacity = '0';
                });

                // 点击复制链接
                anchor.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const url = window.location.origin + window.location.pathname + `#${id}`;

                    try {
                        await navigator.clipboard.writeText(url);
                        anchor.innerHTML = '<span class="icon-[heroicons--check] w-4 h-4"></span>';
                        setTimeout(() => {
                            anchor.innerHTML = '<span class="icon-[heroicons--link] w-4 h-4"></span>';
                        }, 2000);
                    } catch {
                        // 复制失败静默处理
                    }
                });

                heading.insertBefore(anchor, heading.firstChild);
            });
        },

        /**
         * 初始化目录导航 - 动态层级识别系统
         */
        initTOC() {
            const tocNavigation = document.getElementById('toc-nav');
            const tocCard = document.getElementById('toc-card');
            if (!tocNavigation) return;

            // 只从文章正文内容区域获取标题元素
            const articleContent = document.getElementById('article-content');
            if (!articleContent) {
                if (tocCard) tocCard.style.display = 'none';
                return;
            }

            const headingElements = articleContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
            if (headingElements.length === 0) {
                if (tocCard) tocCard.style.display = 'none';
                return;
            }

            // 动态识别层级结构 - 自动检测最高级标题
            const hierarchyInfo = analyzeHeadingHierarchy(headingElements);
            if (hierarchyInfo.filteredHeadings.length === 0) {
                if (tocCard) tocCard.style.display = 'none';
                return;
            }

            // 有目录，显示卡片
            if (tocCard) tocCard.style.display = 'block';

            // 构建动态目录树结构
            const tocTree = buildDynamicTocTree(hierarchyInfo.filteredHeadings, hierarchyInfo.minLevel);
            const tocList = createDynamicTocHTML(tocTree, {
                addTooltip: true,
                onClick: (element) => smoothScrollToHeading(element, 80)
            });

            // 清空现有内容并生成HTML结构
            tocNavigation.innerHTML = '';
            tocNavigation.appendChild(tocList);

            // 初始化滚动高亮功能
            this.initTocScrollHighlight(hierarchyInfo.filteredHeadings);

            // 初始化自适应布局监听
            this.initAdaptiveLayout();
        },

        /**
         * 初始化自适应布局监听
         */
        initAdaptiveLayout() {
            const tocContainer = document.querySelector('.toc-container');
            if (!tocContainer) return;

            if (window.ResizeObserver) {
                const resizeObserver = new ResizeObserver(() => {
                    this.updateTocLayout();
                });
                resizeObserver.observe(document.documentElement);
                // ResizeObserver 无法使用 signal，使用 abort 信号手动断开
                this._signal.addEventListener('abort', () => resizeObserver.disconnect(), { once: true });
            }

            window.addEventListener('resize', () => {
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    this.updateTocLayout();
                }, 150);
            }, { signal: this._signal });

            this.updateTocLayout();
        },

        /**
         * 更新目录布局
         */
        updateTocLayout() {
            const tocContainer = document.querySelector('.toc-container');
            if (!tocContainer) return;

            // 获取实际内容高度
            const tocNav = document.getElementById('toc-nav');
            if (!tocNav) return;

            const actualContentHeight = tocNav.scrollHeight;

            // 使用 CSS 的 max-height 限制，不手动设置
            // 如果内容少，容器会自动收缩

            // 检查是否需要滚动
            const maxHeight = parseFloat(getComputedStyle(tocContainer).maxHeight);
            const needsScroll = actualContentHeight > maxHeight;
            tocContainer.classList.toggle('has-scroll', needsScroll);
        },




        /**
         * 初始化目录滚动高亮功能
         * @param {NodeList} headingElements - 标题元素列表
         */
        initTocScrollHighlight(headingElements) {
            let isUpdating = false;

            const updateActiveSection = () => {
                const scrollPosition = window.scrollY + 120;
                const windowHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;
                let activeIndex = -1;

                if (scrollPosition + windowHeight >= documentHeight - 50) {
                    activeIndex = headingElements.length - 1;
                } else {
                    headingElements.forEach((headingElement, headingIndex) => {
                        const headingTop = headingElement.offsetTop;
                        const nextHeading = headingElements[headingIndex + 1];
                        const nextHeadingTop = nextHeading ? nextHeading.offsetTop : documentHeight;
                        if (headingTop <= scrollPosition && scrollPosition < nextHeadingTop) {
                            activeIndex = headingIndex;
                        }
                    });
                }

                this.updateTocHighlight(activeIndex);
                isUpdating = false;
            };

            const handleScroll = () => {
                if (!isUpdating) {
                    requestAnimationFrame(updateActiveSection);
                    isUpdating = true;
                }
            };

            // 使用 abort signal 自动清理
            window.addEventListener('scroll', handleScroll, { passive: true, signal: this._signal });
            updateActiveSection();
        },

        /**
         * 更新目录高亮状态 - 优化滚动定位算法
         * @param {number} activeIndex - 当前激活的标题索引
         */
        updateTocHighlight(activeIndex) {
            const tocLinks = document.querySelectorAll('.toc-link');

            tocLinks.forEach((linkElement, linkIndex) => {
                if (linkIndex === activeIndex) {
                    linkElement.classList.add('active');

                    // 确保激活项在可视区域内 - 优化滚动定位算法
                    const tocContainer = document.querySelector('.toc-container');
                    if (tocContainer) {
                        // 使用更精确的位置计算方法
                        this.scrollToActiveItem(tocContainer, linkElement);
                    }
                } else {
                    linkElement.classList.remove('active');
                }
            });
        },

        /**
         * 将激活的目录项滚动到可视区域中心 - 增强版滚动算法
         * @param {HTMLElement} container - 目录容器元素
         * @param {HTMLElement} activeItem - 激活的目录项元素
         */
        scrollToActiveItem(container, activeItem) {

            // 计算容器的可视区域信息
            const containerTop = container.scrollTop;
            const containerHeight = container.clientHeight;
            const containerScrollHeight = container.scrollHeight;

            // 计算元素在容器内的相对位置
            let itemOffsetTop = 0;
            let currentElement = activeItem;
            while (currentElement && currentElement !== container) {
                itemOffsetTop += currentElement.offsetTop;
                currentElement = currentElement.offsetParent;
                if (currentElement === container) break;
            }

            // 如果无法通过offsetParent计算，使用getBoundingClientRect方法
            if (currentElement !== container) {
                const containerAbsoluteTop = container.getBoundingClientRect().top + window.scrollY;
                const itemAbsoluteTop = activeItem.getBoundingClientRect().top + window.scrollY;
                itemOffsetTop = itemAbsoluteTop - containerAbsoluteTop + container.scrollTop;
            }

            const itemHeight = activeItem.offsetHeight;

            // 计算可视区域范围
            const visibleTop = containerTop;
            const visibleBottom = containerTop + containerHeight;
            const itemTop = itemOffsetTop;
            const itemBottom = itemOffsetTop + itemHeight;

            // 增强的可见性检测 - 考虑部分可见情况
            const isFullyVisible = itemTop >= visibleTop && itemBottom <= visibleBottom;
            // 如果元素不完全可见，计算最佳滚动位置
            if (!isFullyVisible) {
                let targetScrollTop;

                // 边界检测和调整 - 增强版边界处理
                const maxScrollTop = Math.max(0, containerScrollHeight - containerHeight);
                const minScrollTop = 0;

                // 优先将元素居中显示
                const centerOffset = containerHeight / 2 - itemHeight / 2;
                targetScrollTop = itemOffsetTop - centerOffset;

                // 智能边界处理策略
                if (targetScrollTop < minScrollTop) {
                    // 接近顶部边界时的处理
                    if (itemOffsetTop < containerHeight / 3) {
                        // 如果元素在容器上部1/3区域，滚动到顶部
                        targetScrollTop = minScrollTop;
                    } else {
                        // 否则给元素留出一些上边距
                        targetScrollTop = Math.max(minScrollTop, itemOffsetTop - 40);
                    }
                } else if (targetScrollTop > maxScrollTop) {
                    // 接近底部边界时的处理
                    const itemDistanceFromBottom = containerScrollHeight - itemOffsetTop - itemHeight;
                    if (itemDistanceFromBottom < containerHeight / 3) {
                        // 如果元素在容器下部1/3区域，滚动到底部
                        targetScrollTop = maxScrollTop;
                    } else {
                        // 否则给元素留出一些下边距
                        targetScrollTop = Math.min(maxScrollTop, itemOffsetTop - containerHeight + itemHeight + 40);
                    }
                }

                // 特殊情况处理：元素完全在可视区域上方
                if (itemBottom < visibleTop) {
                    const distanceAbove = visibleTop - itemBottom;
                    if (distanceAbove > containerHeight) {
                        // 距离很远时，居中显示
                        targetScrollTop = Math.max(minScrollTop, itemOffsetTop - centerOffset);
                    } else {
                        // 距离较近时，滚动到元素顶部附近
                        targetScrollTop = Math.max(minScrollTop, itemOffsetTop - 20);
                    }
                }
                // 特殊情况处理：元素完全在可视区域下方
                else if (itemTop > visibleBottom) {
                    const distanceBelow = itemTop - visibleBottom;
                    if (distanceBelow > containerHeight) {
                        // 距离很远时，居中显示
                        targetScrollTop = Math.min(maxScrollTop, itemOffsetTop - centerOffset);
                    } else {
                        // 距离较近时，滚动到元素底部附近
                        targetScrollTop = Math.min(maxScrollTop, itemOffsetTop - containerHeight + itemHeight + 20);
                    }
                }

                // 防抖处理：避免频繁的小幅度滚动
                const currentScrollTop = container.scrollTop;
                const scrollDifference = Math.abs(targetScrollTop - currentScrollTop);

                // 只有滚动距离超过阈值时才执行滚动
                if (scrollDifference > 5) {
                    // 根据滚动距离调整滚动行为
                    const scrollBehavior = scrollDifference > containerHeight ? 'auto' : 'smooth';

                    container.scrollTo({
                        top: targetScrollTop,
                        behavior: scrollBehavior
                    });

                    // 调试信息（开发环境可启用）
                    // if (window.location.hostname === 'localhost') {
                    //     console.log('TOC Scroll Debug:', {
                    //         itemOffsetTop,
                    //         containerHeight,
                    //         containerScrollHeight,
                    //         targetScrollTop,
                    //         currentScrollTop,
                    //         scrollDifference,
                    //         scrollBehavior,
                    //         isFullyVisible,
                    //         isPartiallyVisible,
                    //         maxScrollTop,
                    //         minScrollTop
                    //     });
                    // }
                }
            }
        },

        /**
         * 初始化阅读进度条
         */
        initReadingProgress() {
            const progressBar = document.getElementById('reading-progress');
            if (!progressBar) return;

            let isUpdatingProgress = false;

            const updateProgress = () => {
                const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
                const scrollProgress = (window.scrollY / documentHeight) * 100;
                progressBar.style.width = `${Math.min(scrollProgress, 100)}%`;
                isUpdatingProgress = false;
            };

            const handleProgressScroll = () => {
                if (!isUpdatingProgress) {
                    requestAnimationFrame(updateProgress);
                    isUpdatingProgress = true;
                }
            };

            window.addEventListener('scroll', handleProgressScroll, { passive: true, signal: this._signal });
        },

        /**
         * 初始化代码复制功能
         */
        initCodeCopy() {
            const codeBlocks = document.querySelectorAll('pre code');

            codeBlocks.forEach((codeElement) => {
                const preElement = codeElement.parentElement;
                if (!preElement) return;

                // 创建复制按钮
                const copyButton = document.createElement('button');
                copyButton.className = 'absolute top-2 right-2 px-3 py-1 bg-base-200 hover:bg-base-300 rounded text-sm transition-colors';
                copyButton.textContent = '复制';
                copyButton.setAttribute('aria-label', '复制代码');

                // 设置相对定位
                preElement.style.position = 'relative';
                preElement.appendChild(copyButton);

                // 添加复制功能
                copyButton.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(codeElement.textContent);
                        copyButton.textContent = '已复制';
                        copyButton.classList.add('bg-success', 'text-success-content');

                        setTimeout(() => {
                            copyButton.textContent = '复制';
                            copyButton.classList.remove('bg-success', 'text-success-content');
                        }, 2000);
                    } catch {
                        // console.error('复制失败:', copyError);
                        copyButton.textContent = '复制失败';
                        setTimeout(() => {
                            copyButton.textContent = '复制';
                        }, 2000);
                    }
                });
            });
        },

        /**
         * 初始化字数统计和阅读时间计算
         */
        initWordCount() {
            const articleContent = document.getElementById('article-content');
            const wordCountEl = document.getElementById('word-count');
            const readingTimeEl = document.getElementById('reading-time');

            if (!articleContent || !wordCountEl || !readingTimeEl) return;

            // 克隆内容以便处理
            const clone = articleContent.cloneNode(true);

            // 移除所有代码块
            const codeBlocks = clone.querySelectorAll('pre');
            codeBlocks.forEach(block => block.remove());

            // 获取纯文本内容
            const text = clone.textContent || clone.innerText || '';

            // 统计中文字符数
            const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
            const chineseCount = chineseChars.length;

            // 统计英文单词数
            const englishText = text.replace(/[\u4e00-\u9fa5]/g, ' ');
            const englishWords = englishText.match(/[a-zA-Z]+/g) || [];
            const englishCount = englishWords.length;

            // 总字数（中文字符 + 英文单词）
            const totalWords = chineseCount + englishCount;

            // 计算阅读时间（中文 300 字/分钟，英文 200 词/分钟）
            const readingTimeMinutes = Math.ceil(
                (chineseCount / 300) + (englishCount / 200)
            );

            // 更新显示
            wordCountEl.textContent = totalWords.toLocaleString();
            readingTimeEl.textContent = Math.max(1, readingTimeMinutes);
        },

        /**
         * 初始化回到顶部功能
         */
        initScrollToTop() {
            const scrollTopButton = document.getElementById('scroll-to-top');
            if (!scrollTopButton) return;

            let isCheckingScroll = false;

            const toggleButtonVisibility = () => {
                if (window.scrollY > 300) {
                    scrollTopButton.classList.remove('opacity-0', 'pointer-events-none');
                    scrollTopButton.classList.add('opacity-100');
                } else {
                    scrollTopButton.classList.add('opacity-0', 'pointer-events-none');
                    scrollTopButton.classList.remove('opacity-100');
                }
                isCheckingScroll = false;
            };

            const handleScrollCheck = () => {
                if (!isCheckingScroll) {
                    requestAnimationFrame(toggleButtonVisibility);
                    isCheckingScroll = true;
                }
            };

            window.addEventListener('scroll', handleScrollCheck, { passive: true, signal: this._signal });

            scrollTopButton.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, { signal: this._signal });
        }
    };

    const handlePageEnter = () => {
        if (!isPostPage()) return;
        pageManager.init();
    };

    if (window.SkyPjax?.onPage) {
        window.SkyPjax.onPage(handlePageEnter, { immediate: false });
        window.SkyPjax.onCleanup(cleanupPostPage);
    } else {
        runPageInit(handlePageEnter);
    }

})();

notifySwupPageReady();
