import { fetchAnnualPublicPosts, localDateKey, annualWindow } from './article-heatmap-data.js';

export function registerGithubHeatmap(Alpine) {
  Alpine.data('githubHeatmap', () => ({
        loading: true,
        error: false,
        username: '',
        _initialized: false,
        _destroyed: false,
        _idleHandle: null,
        _loadTimer: null,
        _themeObserver: null,
        _themeFrame: null,
        _preloader: null,

        init() {
          this.username = this.$el.dataset.githubUsername || '';
          if (this._initialized) return;
          this._initialized = true;
          this._destroyed = false;

          if (!this.username) {
            this.loading = false;
            this.error = true;
            return;
          }

          // 延迟加载热力图，不阻塞首屏
          this.$nextTick(() => {
            if (this._destroyed) return;
            if ('requestIdleCallback' in window) {
              this._idleHandle = window.requestIdleCallback(() => {
                this._idleHandle = null;
                if (!this._destroyed) this.loadImage();
              }, { timeout: 3000 });
            } else {
              this._loadTimer = window.setTimeout(() => {
                this._loadTimer = null;
                if (!this._destroyed) this.loadImage();
              }, 200);
            }
          });

          this._themeObserver = new MutationObserver(() => {
            if (this._themeFrame !== null) cancelAnimationFrame(this._themeFrame);
            this._themeFrame = requestAnimationFrame(() => {
              this._themeFrame = null;
              if (!this._destroyed) this.updateImageSrc();
            });
          });
          this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        },

        getPrimaryHex() {
          const probe = this.$refs.colorProbe;
          if (!probe) return '6366f1';
          const color = getComputedStyle(probe).backgroundColor;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          return [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        },

        getImageUrl() {
          return `https://ghchart.rshah.org/${this.getPrimaryHex()}/${this.username}`;
        },

        loadImage() {
          if (this._destroyed) return;
          this.loading = true;
          this.error = false;

          const imgEl = this.$refs.img;
          if (!imgEl) {
            this.loading = false;
            this.error = true;
            return;
          }

          const url = this.getImageUrl();
          const preloader = new Image();
          this._preloader = preloader;

          preloader.onload = () => {
            if (this._destroyed || this._preloader !== preloader) return;
            this._preloader = null;
            imgEl.src = url;
            this.loading = false;
            this.error = false;
          };

          preloader.onerror = () => {
            if (this._destroyed || this._preloader !== preloader) return;
            this._preloader = null;
            this.loading = false;
            this.error = true;
          };

          preloader.src = url;
        },

        updateImageSrc() {
          if (this._destroyed) return;
          const img = this.$refs.img;
          if (img && !this.error) {
            img.src = this.getImageUrl();
          }
        },

        retry() {
          this.loadImage();
        },

        destroy() {
          this._destroyed = true;
          this._themeObserver?.disconnect();
          this._themeObserver = null;
          if (this._themeFrame !== null) cancelAnimationFrame(this._themeFrame);
          this._themeFrame = null;
          if (this._idleHandle !== null && 'cancelIdleCallback' in window) {
            window.cancelIdleCallback(this._idleHandle);
          }
          this._idleHandle = null;
          if (this._loadTimer !== null) window.clearTimeout(this._loadTimer);
          this._loadTimer = null;
          if (this._preloader) {
            this._preloader.onload = null;
            this._preloader.onerror = null;
            this._preloader = null;
          }
        }
      }));
}

export function registerArticleHeatmap(Alpine) {
  Alpine.data('articleHeatmap', () => ({
            totalCount: 0,
            isEmpty: false,
            isLoading: true,
            error: false,
            data: new Map(),
            postsByDate: new Map(),
            months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            _initialized: false,
            _destroyed: false,
            _resizeObserver: null,
            _themeObserver: null,
            _resizeTimer: null,
            _renderFrame: null,
            _tooltipTimer: null,
            _visibilityObserver: null,
            _requestController: null,

            init() {
              // 防止重复初始化
              if (this._initialized) return;
              this._initialized = true;
              this._destroyed = false;

              if (typeof IntersectionObserver === 'undefined') {
                this.loadData();
                return;
              }
              this._visibilityObserver = new IntersectionObserver((entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                this._visibilityObserver?.disconnect();
                this._visibilityObserver = null;
                this.loadData();
              }, { rootMargin: '200px' });
              this._visibilityObserver.observe(this.$el);
            },

            async loadData() {
              this._requestController?.abort();
              const controller = new AbortController();
              this._requestController = controller;
              this.isLoading = true;
              this.error = false;
              try {
                const posts = await fetchAnnualPublicPosts({ signal: controller.signal });
                if (this._destroyed || controller.signal.aborted) return;
                this.parseData(posts);
                this.isEmpty = this.totalCount === 0;
                if (!this.isEmpty) {
                  this.$nextTick(() => {
                    if (this._destroyed) return;
                    this.render();
                    this.setupResizeObserver();
                    this.setupThemeObserver();
                  });
                }
              } catch {
                if (!this._destroyed && !controller.signal.aborted) this.error = true;
              } finally {
                if (!this._destroyed && !controller.signal.aborted) this.isLoading = false;
                if (this._requestController === controller) this._requestController = null;
              }
            },

            parseData(posts) {
              this.totalCount = 0;
              this.data = new Map();
              this.postsByDate = new Map();
              posts.forEach(post => {
                const date = localDateKey(post.date);
                if (!date) return;
                this.data.set(date, (this.data.get(date) || 0) + 1);
                if (!this.postsByDate.has(date)) {
                  this.postsByDate.set(date, []);
                }
                this.postsByDate.get(date).push({ title: post.title, slug: post.slug });
                this.totalCount++;
              });
            },

            getColors() {
              const colorToRgba = (el) => {
                if (!el) return 'rgba(128,128,128,0.1)';
                const color = getComputedStyle(el).backgroundColor;
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 1;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, 1, 1);
                const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
                return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
              };

              return {
                0: colorToRgba(this.$refs.level0),
                1: colorToRgba(this.$refs.level1),
                2: colorToRgba(this.$refs.level2),
                3: colorToRgba(this.$refs.level3),
                4: colorToRgba(this.$refs.level4)
              };
            },

            render() {
              if (this._destroyed) return;
              if (this._renderFrame !== null) cancelAnimationFrame(this._renderFrame);
              this._renderFrame = requestAnimationFrame(() => {
                this._renderFrame = null;
                if (this._destroyed) return;
                const container = this.$refs.container;
                if (!container) return;

                const colors = this.getColors();
                const containerWidth = container.clientWidth;

                // 响应式计算尺寸
                const weeks = 53;
                const days = 7;
                const labelWidth = 28;
                const monthLabelHeight = 16;
                const availableWidth = containerWidth - labelWidth - 10;
                const cellSize = Math.max(8, Math.min(12, Math.floor(availableWidth / weeks) - 3));
                const cellGap = Math.max(2, Math.min(3, cellSize * 0.25));

                const gridWidth = weeks * (cellSize + cellGap);
                const gridHeight = days * (cellSize + cellGap);
                const width = labelWidth + gridWidth;
                const height = monthLabelHeight + gridHeight;

                const { start, end } = annualWindow();
                const startDate = new Date(start);
                startDate.setDate(startDate.getDate() - startDate.getDay());

                // 生成月份标签
                const monthLabels = [];
                let lastMonth = -1;
                for (let w = 0; w < weeks; w++) {
                  const d = new Date(startDate);
                  d.setDate(d.getDate() + w * 7);
                  const month = d.getMonth();
                  if (month !== lastMonth) {
                    const x = labelWidth + w * (cellSize + cellGap);
                    monthLabels.push(`<text x="${x}" y="10" class="heatmap-month-label">${this.months[month]}</text>`);
                    lastMonth = month;
                  }
                }

                // 生成星期标签
                const weekLabels = [1, 3, 5].map(d => {
                  const y = monthLabelHeight + d * (cellSize + cellGap) + cellSize * 0.75;
                  return `<text x="0" y="${y}" class="heatmap-label">${this.weekdays[d]}</text>`;
                });

                // 生成格子
                const cells = [];
                for (let i = 0; i < weeks * days; i++) {
                  const date = new Date(startDate);
                  date.setDate(date.getDate() + i);

                  if (date < start || date >= end) continue;

                  const dateStr = localDateKey(date);
                  const count = this.data.get(dateStr) || 0;
                  const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4;

                  const week = Math.floor(i / days);
                  const day = i % days;
                  const x = labelWidth + week * (cellSize + cellGap);
                  const y = monthLabelHeight + day * (cellSize + cellGap);
                  const fillColor = colors[level];
                  const delay = Math.min(i * 3, 800);
                  const hasPostsClass = count > 0 ? 'has-posts' : '';

                  cells.push(`<rect
                        x="${x}" y="${y}"
                        width="${cellSize}" height="${cellSize}"
                        rx="2" ry="2"
                        fill="${fillColor}"
                        class="article-heatmap-cell heatmap-cell-animated ${hasPostsClass}"
                        style="animation-delay: ${delay}ms"
                        data-date="${dateStr}"
                        data-count="${count}"
                      ></rect>`);
                }

                container.innerHTML = `<svg class="article-heatmap-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                      <g>${monthLabels.join('')}</g>
                      <g>${weekLabels.join('')}</g>
                      <g>${cells.join('')}</g>
                    </svg>`;

                // 绑定事件
                this.bindEvents();
              });
            },

            bindEvents() {
              const container = this.$refs.container;
              const tooltip = this.$refs.tooltip;
              if (!container || !tooltip) return;

              const cells = container.querySelectorAll('.article-heatmap-cell');

              cells.forEach(cell => {
                cell.addEventListener('mouseenter', (e) => this.showTooltip(e, cell));
                cell.addEventListener('mouseleave', () => this.hideTooltip());
                cell.addEventListener('click', () => this.handleClick(cell));
              });
            },

            showTooltip(e, cell) {
              const tooltip = this.$refs.tooltip;
              if (!tooltip) return;

              const dateStr = cell.getAttribute('data-date');
              const count = parseInt(cell.getAttribute('data-count') || '0');
              const posts = this.postsByDate.get(dateStr) || [];

              const [year, month, day] = dateStr.split('-').map(Number);
              const dateElement = document.createElement('div');
              dateElement.className = 'heatmap-tooltip-date';
              dateElement.textContent = `${year}年${month}月${day}日`;
              const countElement = document.createElement('div');
              countElement.className = 'heatmap-tooltip-count';
              countElement.textContent = `${count} 篇文章`;
              tooltip.replaceChildren(dateElement, countElement);
              if (posts.length > 0) {
                const postList = document.createElement('div');
                postList.className = 'heatmap-tooltip-posts';
                posts.slice(0, 3).forEach(post => {
                  const item = document.createElement('span');
                  item.className = 'heatmap-tooltip-post';
                  item.textContent = post.title;
                  postList.append(item);
                });
                if (posts.length > 3) {
                  const more = document.createElement('span');
                  more.className = 'heatmap-tooltip-post';
                  more.textContent = `还有 ${posts.length - 3} 篇...`;
                  postList.append(more);
                }
                tooltip.append(postList);
              }
              tooltip.style.display = 'block';

              const rect = cell.getBoundingClientRect();
              const tooltipRect = tooltip.getBoundingClientRect();

              let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
              let top = rect.top - tooltipRect.height - 8;

              if (top < 0) top = rect.bottom + 8;
              if (left < 0) left = 8;
              if (left + tooltipRect.width > window.innerWidth) {
                left = window.innerWidth - tooltipRect.width - 8;
              }

              tooltip.style.left = left + 'px';
              tooltip.style.top = top + 'px';

              requestAnimationFrame(() => tooltip.classList.add('visible'));
            },

            hideTooltip() {
              const tooltip = this.$refs.tooltip;
              if (!tooltip) return;

              tooltip.classList.remove('visible');
              if (this._tooltipTimer !== null) window.clearTimeout(this._tooltipTimer);
              this._tooltipTimer = window.setTimeout(() => {
                this._tooltipTimer = null;
                if (this._destroyed) return;
                tooltip.style.display = 'none';
              }, 150);
            },

            handleClick(cell) {
              const dateStr = cell.getAttribute('data-date');
              const count = parseInt(cell.getAttribute('data-count') || '0');
              if (count > 0) {
                const target = new URL(this.$el.dataset.archivesBase || '/archives', window.location.origin);
                target.searchParams.set('date', dateStr);
                window.location.href = target.href;
              }
            },

            setupResizeObserver() {
              if (typeof ResizeObserver === 'undefined') return;

              this._resizeObserver?.disconnect();
              this._resizeObserver = new ResizeObserver(() => {
                if (this._resizeTimer !== null) window.clearTimeout(this._resizeTimer);
                this._resizeTimer = window.setTimeout(() => {
                  this._resizeTimer = null;
                  if (!this._destroyed) this.render();
                }, 100);
              });
              this._resizeObserver.observe(this.$refs.container);
            },

            setupThemeObserver() {
              this._themeObserver?.disconnect();
              this._themeObserver = new MutationObserver(() => {
                if (!this._destroyed) this.render();
              });
              this._themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme']
              });
            },

            destroy() {
              this._destroyed = true;
              this._visibilityObserver?.disconnect();
              this._visibilityObserver = null;
              this._requestController?.abort();
              this._requestController = null;
              this._resizeObserver?.disconnect();
              this._resizeObserver = null;
              this._themeObserver?.disconnect();
              this._themeObserver = null;
              if (this._resizeTimer !== null) window.clearTimeout(this._resizeTimer);
              this._resizeTimer = null;
              if (this._renderFrame !== null) cancelAnimationFrame(this._renderFrame);
              this._renderFrame = null;
              if (this._tooltipTimer !== null) window.clearTimeout(this._tooltipTimer);
              this._tooltipTimer = null;
            }
          }));
}

const STEAM_CARD_CACHE_KEY = "steam_card_cache";
const STEAM_CARD_CACHE_TTL = 3 * 60 * 1000; // 3分钟
const STEAM_API_BASES = ["/apis/api.steam.timxs.com/v1alpha1", "/apis/api.steam.halo.run/v1alpha1"];

async function fetchSteamCardEndpoint(endpoint, signal) {
  for (const base of STEAM_API_BASES) {
    if (signal?.aborted) return null;
    try {
      const response = await fetch(`${base}${endpoint}`, { signal });
      if (response.ok) return await response.json();
    } catch (error) {
      if (error?.name === "AbortError" || signal?.aborted) return null;
      // 尝试下一个命名空间
    }
  }
  return null;
}

const steamCardCache = {
  get(key) {
    try {
      const data = localStorage.getItem(`${STEAM_CARD_CACHE_KEY}_${key}`);
      if (!data) return null;
      const { value, expiry } = JSON.parse(data);
      if (Date.now() > expiry) {
        localStorage.removeItem(`${STEAM_CARD_CACHE_KEY}_${key}`);
        return null;
      }
      return value;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(
        `${STEAM_CARD_CACHE_KEY}_${key}`,
        JSON.stringify({
          value,
          expiry: Date.now() + STEAM_CARD_CACHE_TTL,
        }),
      );
    } catch {
      // 忽略缓存写入失败
    }
  },
};

export function registerSteamCard(Alpine) {
  Alpine.data("steamCard", () => ({
            loading: true,
            profile: null,
            stats: null,
            badges: null,
            gameHeaderUrl: null,
            _initialized: false,
            _destroyed: false,
            _abortController: null,

            async init() {
              // 防止重复初始化
              if (this._initialized) return;
              this._initialized = true;
              this._destroyed = false;
              const controller = new AbortController();
              this._abortController = controller;

              try {
                // 尝试从缓存读取
                const cachedProfile = steamCardCache.get("profile");
                const cachedStats = steamCardCache.get("stats");
                const cachedBadges = steamCardCache.get("badges");

                // 如果全部命中缓存，直接使用
                if (cachedProfile && cachedStats && cachedBadges) {
                  this.profile = cachedProfile;
                  this.stats = cachedStats;
                  this.badges = cachedBadges;
                } else {
                  // 否则请求 API
                  const [profileRes, statsRes, badgesRes] = await Promise.all([
                    cachedProfile
                      ? Promise.resolve(cachedProfile)
                      : fetchSteamCardEndpoint("/profile", controller.signal),
                    cachedStats ? Promise.resolve(cachedStats) : fetchSteamCardEndpoint("/stats", controller.signal),
                    cachedBadges ? Promise.resolve(cachedBadges) : fetchSteamCardEndpoint("/badges", controller.signal),
                  ]);

                  if (controller.signal.aborted || this._destroyed) return;
                  this.profile = profileRes;
                  this.stats = statsRes;
                  this.badges = badgesRes;

                  // 写入缓存
                  if (profileRes) steamCardCache.set("profile", profileRes);
                  if (statsRes) steamCardCache.set("stats", statsRes);
                  if (badgesRes) steamCardCache.set("badges", badgesRes);
                }

                // 设置游戏背景图
                const gameId = this.profile?.summary?.gameId || this.profile?.summary?.gameid;
                if (this.profile?.playing && gameId) {
                  this.gameHeaderUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${gameId}/header.jpg`;
                }
              } catch {
                // Silent fail
              } finally {
                if (this._abortController === controller) this._abortController = null;
                if (!controller.signal.aborted && !this._destroyed) this.loading = false;
              }
            },

            destroy() {
              this._destroyed = true;
              this._abortController?.abort();
              this._abortController = null;
            },
          }));
}
