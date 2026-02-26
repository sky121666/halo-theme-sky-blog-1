/**
 * Sky Theme Components - JavaScript 组件模块
 * 只包含模板中实际使用的功能
 */

/* global Alpine */

/**
 * 悬浮 Dock 控制器
 * 模板使用：templates/modules/floating-dock.html, templates/modules/post/floating-dock.html
 */
function createFloatingDock() {
  return {
    isVisible: true,
    isCommentDrawerOpen: false,
    scrollTimeout: null,
    scrollPercent: 0,

    init() {
      this.updateVisibility();

      let ticking = false;

      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            this.updateVisibility();
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    },

    updateVisibility() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;

      // 只在页面最顶部（< 50px）时隐藏
      this.isVisible = scrollTop >= 50;
      this.scrollPercent = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
    },

    scrollToTop() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    },

    // 文章页专用方法
    openShareModal() {
      const checkbox = document.getElementById('share-drawer');
      if (checkbox) {
        checkbox.checked = true;
        // 触发 Alpine 的响应式更新
        checkbox.dispatchEvent(new Event('change'));
      }
    },

    toggleCommentDrawer() {
      this.isCommentDrawerOpen = !this.isCommentDrawerOpen;
      const checkbox = document.getElementById('comment-drawer');
      if (checkbox) {
        checkbox.checked = this.isCommentDrawerOpen;
      }
    }
  };
}

/**
 * 分享抽屉控制器
 * 模板使用：templates/modules/post/floating-dock.html
 * 参考 theme-earth 的优雅设计：预设平台 + ID 过滤模式
 */
/**
 * 通用分享弹窗组件
 * 模板使用：templates/modules/share-modal.html
 * 
 * 支持的 data 属性：
 * - data-share-url: 分享链接
 * - data-share-title: 分享标题
 * - data-share-item-ids: 启用的平台ID列表（逗号分隔）
 * 
 * 触发方式：$dispatch('open-share-modal')
 */
function createShareModal() {
  return {
    // 页面信息
    permalink: '',
    title: '',

    // 状态
    isOpen: false,
    copied: false,

    // 启用的平台 ID 列表
    shareItemIds: [],

    // 预设的所有分享平台（含颜色）
    presetShareItems: [
      { id: "wechat", name: "微信", icon: "icon-[simple-icons--wechat]", color: "#07c160", type: "qrcode" },
      { id: "x", name: "X", icon: "icon-[simple-icons--x]", color: "#000000", type: "url", url: "https://twitter.com/intent/tweet?url={url}&text={title}" },
      { id: "telegram", name: "Telegram", icon: "icon-[simple-icons--telegram]", color: "#26a5e4", type: "url", url: "https://telegram.me/share/url?url={url}&text={title}" },
      { id: "facebook", name: "Facebook", icon: "icon-[simple-icons--facebook]", color: "#1877f2", type: "url", url: "https://facebook.com/sharer/sharer.php?u={url}" },
      { id: "qq", name: "QQ", icon: "icon-[simple-icons--tencentqq]", color: "#12b7f5", type: "url", url: "https://connect.qq.com/widget/shareqq/index.html?url={url}&title={title}" },
      { id: "qzone", name: "QQ空间", icon: "icon-[simple-icons--qzone]", color: "#fece00", type: "url", url: "https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url={url}&title={title}" },
      { id: "weibo", name: "微博", icon: "icon-[simple-icons--sinaweibo]", color: "#e6162d", type: "url", url: "https://service.weibo.com/share/share.php?url={url}&title={title}" },
      { id: "douban", name: "豆瓣", icon: "icon-[simple-icons--douban]", color: "#007722", type: "url", url: "https://www.douban.com/share/service?href={url}&name={title}" },
      { id: "native", name: "更多", icon: "icon-[heroicons--share]", color: "#6366f1", type: "native" }
    ],

    // 初始化
    init() {
      // 从 data 属性读取配置
      const shareUrl = this.$el.dataset.shareUrl || this.$el.dataset.postUrl || '';
      const shareTitle = this.$el.dataset.shareTitle || this.$el.dataset.postTitle || '';
      const shareItemIdsStr = this.$el.dataset.shareItemIds || '';

      this.shareItemIds = shareItemIdsStr ? shareItemIdsStr.split(',').map(s => s.trim()) : [];
      this.title = shareTitle || document.title;

      // 设置分享链接（转换为绝对 URL）
      if (shareUrl) {
        if (shareUrl.startsWith('/')) {
          this.permalink = window.location.origin + shareUrl;
        } else if (shareUrl.startsWith('http')) {
          this.permalink = shareUrl;
        } else {
          this.permalink = window.location.href;
        }
      } else {
        this.permalink = window.location.href;
      }

      // 暴露到全局，供原生 onclick 调用（解决 teleport 后的作用域问题）
      window.__shareModal = this;
    },

    // 计算属性：过滤出启用的分享平台
    get activeShareItems() {
      if (!this.shareItemIds || this.shareItemIds.length === 0) {
        return this.presetShareItems;
      }
      return this.shareItemIds
        .map(id => this.presetShareItems.find(item => item.id === id))
        .filter(Boolean);
      // 注意：不再过滤 native 类型，让所有配置的平台都显示
      // 点击时再判断浏览器是否支持
    },

    // 打开弹窗
    openModal() {
      this.isOpen = true;
      document.body.style.overflow = 'hidden';
    },

    // 关闭弹窗
    closeModal() {
      this.isOpen = false;
      document.body.style.overflow = '';
    },

    // 复制链接
    async copyUrl() {
      try {
        await navigator.clipboard.writeText(this.permalink);
        this.copied = true;
        setTimeout(() => { this.copied = false; }, 2000);
      } catch (err) {
        // 复制失败静默处理
      }
    },

    // 处理分享 - 直接在点击事件中处理，确保用户手势有效
    handleShare(platformId) {
      const platform = this.activeShareItems.find(item => item?.id === platformId);
      if (!platform) {
        return;
      }


      if (platform.type === 'native') {
        // 原生分享必须在用户手势中直接调用
        if (navigator.share) {
          const self = this;
          navigator.share({
            title: this.title,
            url: this.permalink
          }).then(() => {
            self.closeModal();
          }).catch((err) => {
            self.closeModal();
          });
        } else {
          // 不支持原生分享（非 HTTPS 或浏览器不支持）
          this.copyUrl();
          // 不关闭弹窗，让用户看到"已复制"提示
        }
      } else if (platform.type === 'qrcode') {
        this.closeModal();
        this.shareToWeChat();
      } else {
        this.closeModal();
        this.shareToUrl(platform);
      }
    },

    // URL 分享
    shareToUrl(platform) {
      const shareUrl = platform.url
        .replace(/{url}/g, encodeURIComponent(this.permalink))
        .replace(/{title}/g, encodeURIComponent(this.title));
      const width = 600, height = 500;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;
      window.open(shareUrl, `分享到${platform.name}`,
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,scrollbars=yes,resizable=yes`);
    },

    // 微信二维码分享
    shareToWeChat() {
      const width = 400, height = 500;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;
      const qrcodePageUrl = `/themes/theme-sky-blog-1/assets/qrcode/qrcode-share.html?url=${encodeURIComponent(this.permalink)}`;
      window.open(qrcodePageUrl, '微信扫码分享',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,scrollbars=no,resizable=no`);
    }
  };
}

/**
 * 评论抽屉控制器
 * 模板使用：templates/modules/post/floating-dock.html
 */
function createCommentDrawer() {
  return {
    isOpen: false,

    init() {
      // 监听抽屉状态
      const checkbox = document.getElementById('comment-drawer');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          this.isOpen = e.target.checked;
        });
      }

      // 监听关闭抽屉事件
      window.addEventListener('close-comment-drawer', () => {
        this.closeDrawer();
      });
    },

    closeDrawer() {
      this.isOpen = false;
      const checkbox = document.getElementById('comment-drawer');
      if (checkbox) {
        checkbox.checked = false;
      }
    }
  };
}

/**
 * 首页头部控制器
 * 模板使用：templates/modules/index/header.html
 */
function createHeaderController() {
  return {
    scrollOffset: 0,
    scrolled: false,
    showMoments: true,
    showPublishModal: false,
    isTablet: false,

    init() {
      // 检测设备类型
      this.detectDevice();

      // 监听窗口大小变化
      window.addEventListener('resize', () => {
        this.detectDevice();
      });

      // 监听滚动事件，使用节流优化性能
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            this.updateScrollOffset();
            ticking = false;
          });
          ticking = true;
        }
      });
    },

    detectDevice() {
      this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    },

    updateScrollOffset() {
      this.scrollOffset = window.scrollY;

      // 更新scrolled状态，用于背景蒙版透明度控制
      this.scrolled = this.scrollOffset > 50;

      // 平板端优化：减少视差效果强度
      if (this.isTablet) {
        this.scrollOffset *= 0.7;
      }
    }
  };
}

/**
 * 导航栏控制器
 * 模板使用：templates/modules/nav.html
 */
function createNavbarController() {
  return {
    scrolled: false,

    init() {
      // 使用 requestAnimationFrame 节流的滚动监听
      let ticking = false;

      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            const newScrolled = window.scrollY > 20;
            // 只在状态变化时更新 DOM
            if (this.scrolled !== newScrolled) {
              this.scrolled = newScrolled;
              const navbar = this.$el.querySelector('.navbar');
              if (navbar) {
                navbar.classList.toggle('scrolled', this.scrolled);
              }
            }
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    }
  };
}

/**
 * 主题切换控制器
 * 模板使用：templates/modules/nav.html
 * 统一管理整个应用的主题状态
 * 在 <html> 元素上添加 data-color-scheme 属性，便于 CSS 统一判断亮暗模式
 */
function createThemeToggle() {
  return {
    isDark: false,
    lightTheme: '',
    darkTheme: '',

    init() {
      // 在初始化时保存主题配置到组件实例
      this.lightTheme = this.$el.dataset.lightTheme || 'light';
      this.darkTheme = this.$el.dataset.darkTheme || 'dark';
      const defaultTheme = this.$el.dataset.defaultTheme || 'dark_theme';

      // 从 localStorage 读取用户偏好
      const savedTheme = localStorage.getItem('theme-mode');

      // 确定当前主题状态（同步到组件状态，不触发切换）
      this.isDark = savedTheme ? (savedTheme === 'dark_theme') : (defaultTheme === 'dark_theme');

      // 注意：不调用 applyTheme()，因为主题已经在 <head> 内联脚本中设置好了
      // 这里只是同步状态到组件，避免闪烁
    },

    toggleTheme() {
      this.isDark = !this.isDark;
      const themeMode = this.isDark ? 'dark_theme' : 'light_theme';

      localStorage.setItem('theme-mode', themeMode);
      this.applyTheme();
    },

    /**
     * 应用主题到 HTML 元素
     * 同时设置 data-theme（具体主题名）和 data-color-scheme（light/dark 标识）
     * 切换时临时禁用过渡，防止闪烁
     */
    applyTheme() {
      const themeName = this.isDark ? this.darkTheme : this.lightTheme;
      const themeMode = this.isDark ? 'dark' : 'light';
      const html = document.documentElement;

      // 临时禁用所有过渡
      html.classList.add('theme-transitioning');

      // 应用新主题
      html.setAttribute('data-theme', themeName);
      html.setAttribute('data-color-scheme', themeMode);

      // 下一帧恢复过渡
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          html.classList.remove('theme-transitioning');
        });
      });
    }
  };
}



/**
 * 简单悬浮 Dock 控制器
 * 模板使用：templates/modules/doc/floating-dock.html (docs-dock, catalog-dock)
 * 与主站 floatingDock 保持一致：页面顶部隐藏，滚动后显示
 */
function createSimpleFloatingDock() {
  return {
    isVisible: false,

    init() {
      this.updateVisibility();

      let ticking = false;
      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            this.updateVisibility();
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    },

    updateVisibility() {
      // 滚动超过 50px 时显示
      this.isVisible = window.scrollY >= 50;
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
}

/**
 * 文档页悬浮 Dock 控制器
 * 模板使用：templates/modules/doc/floating-dock.html (doc-dock)
 * 与主站 floatingDock 保持一致：页面顶部隐藏，滚动后显示
 */
function createDocFloatingDock() {
  return {
    isVisible: false,

    init() {
      this.updateVisibility();

      let ticking = false;
      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            this.updateVisibility();
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    },

    updateVisibility() {
      // 滚动超过 50px 时显示
      this.isVisible = window.scrollY >= 50;
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    toggleCommentDrawer() {
      window.dispatchEvent(new CustomEvent('toggle-doc-comment-drawer'));
    },

    toggleTocDrawer() {
      window.dispatchEvent(new CustomEvent('toggle-doc-toc-drawer'));
    },

    toggleSidebarDrawer() {
      window.dispatchEvent(new CustomEvent('toggle-doc-sidebar-drawer'));
    }
  };
}

/**
 * 文档评论抽屉控制器
 * 模板使用：templates/modules/doc/floating-dock.html
 */
function createDocCommentDrawer() {
  return {
    isOpen: false,

    closeDrawer() {
      this.isOpen = false;
    }
  };
}

/**
 * 右侧可折叠悬浮 Dock 控制器
 * 模板使用：templates/modules/floating-dock-side.html
 */
function createSideFloatingDock() {
  return {
    isVisible: false,
    isExpanded: false,

    init() {
      this.updateVisibility();

      let ticking = false;
      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            this.updateVisibility();
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    },

    updateVisibility() {
      const newVisible = window.scrollY >= 50;
      // 滚动时自动收起展开的菜单
      if (!newVisible && this.isVisible) {
        this.isExpanded = false;
      }
      this.isVisible = newVisible;
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
}

/**
 * 欢迎天气卡片（多源支持）
 * 模板使用：templates/modules/widgets/welcome-card.html
 * 定位源：pconline CF Worker（默认）/ 高德 IP 定位
 * 天气源：心知天气（默认免费）/ 高德天气 / 和风天气
 */
function welcomeWeatherCard() {
  const CACHE_KEY = 'sky_weather_cache_v13';
  const CACHE_DURATION = 30 * 60 * 1000;

  // 清除旧缓存
  try { for (let i = 1; i <= 12; i++) { const k = i === 1 ? 'sky_weather_cache' : `sky_weather_cache_v${i}`; localStorage.removeItem(k); } } catch (e) { }

  return {
    loading: true, weather: null, location: '', errorMsg: '', greeting: '', currentDate: '',
    weatherIcon: '', weatherIconSvg: '', weatherBg: '', config: {},

    init() {
      // 天气源已固化为自有后端的无感 Open-Meteo，不再需要复杂的来源和 Key 管理
      this.config = {
        enabled: this.$el.dataset.weatherProvider !== 'none'
      };
      if (!this.config.enabled) return;

      this.updateGreeting();
      this.updateDate();
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => this.loadWeather(), { timeout: 2000 });
      } else {
        setTimeout(() => this.loadWeather(), 100);
      }
    },

    updateGreeting() {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 9) this.greeting = '早上好 ☀️';
      else if (hour >= 9 && hour < 12) this.greeting = '上午好 🌤️';
      else if (hour >= 12 && hour < 14) this.greeting = '中午好 🌞';
      else if (hour >= 14 && hour < 18) this.greeting = '下午好 ⛅';
      else if (hour >= 18 && hour < 22) this.greeting = '晚上好 🌙';
      else this.greeting = '夜深了 🌟';
    },

    updateDate() {
      const now = new Date();
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      this.currentDate = `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
    },

    getDefaultWeather() {
      return {
        location: '--',
        weather: { temp: '--', description: '加载中...', humidity: '--', wind: '--', feels_like: '--' },
        weatherIcon: 'https://basmilius.github.io/weather-icons/production/fill/all/clear-day.svg',
        weatherBg: 'sunny'
      };
    },

    // ═══════ 主流程 ═══════

    async loadWeather() {
      console.log('[Weather] 开始加载天气...');
      const cached = this.getCache();
      if (cached) {
        console.log('[Weather] 命中缓存，城市:', cached.location);
        this.applyWeatherData(cached);
        this.loading = false;
        return;
      }
      console.log('[Weather] 无缓存，显示默认数据，后台获取真实天气');
      this.applyWeatherData(this.getDefaultWeather());
      this.loading = false;

      try {
        const loc = await this.getLocationByPconline();
        console.log('[Weather] 定位结果:', loc.city, '(来源:', loc.source + ')');
        if (!loc.city || loc.city === '未知') { console.warn('[Weather] 定位失败'); return; }
        await this.getWeatherByWttrProxy(loc);
      } catch (e) {
        console.warn('[Weather] 天气获取失败:', e.message);
        this.errorMsg = '服务维护中';
      }
    },

    // ═══════ IP 定位路由 ═══════

    async getLocationByPconline() {
      console.log('[Weather] 通过 pconline 获取位置...');
      try {
        const data = await this.fetchWithTimeout('https://pconline.xoku.cn/', {}, 6000).then(r => r.json());
        const rawCity = data.city || data.addr || '';
        const city = rawCity.replace('市', '').trim() || '未知';
        console.log('[Weather] pconline 返回:', city, data);
        const bad = city.includes('美国') || city.includes('CloudFlare') || city.includes('节点') || city === '未知';
        if (city && !bad) return { city, adcode: '', source: 'pconline' };
        console.warn('[Weather] pconline 返回异常城市，降级');
        return { city: '未知', adcode: '', source: 'fallback' };
      } catch (e) {
        console.warn('[Weather] pconline 失败:', e.message);
        return { city: '未知', adcode: '', source: 'fallback' };
      }
    },

    // ═══════ 天气查询路由 ═══════

    async getWeatherByWttrProxy(loc) {
      console.log('[Weather] Open-Meteo CF 反代请求:', loc.city);
      try {
        const url = `https://pconline.xoku.cn/weather?city=${encodeURIComponent(loc.city)}`;
        const res = await this.fetchWithTimeout(url, {}, 8000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.error) throw new Error(data.error);
        if (data.temp === undefined) throw new Error('返回数据格式异常');

        // WMO weather_code 映射到 Basmilius 图标
        const code = data.weather_code;
        const iconInfo = this.getWeatherMapFromWmoCode(code);

        const wd = {
          location: data.location || loc.city,
          weather: {
            temp: data.temp,
            feels_like: data.feels_like,
            humidity: data.humidity,
            description: data.description,
            wind: `${this.degToDir(data.wind_direction)} ${data.wind_speed}km/h`
          },
          weatherIcon: iconInfo.icon,
          weatherBg: iconInfo.bg
        };
        console.log('[Weather] 天气请求成功:', wd.location + ',', wd.weather.description + ',', wd.weather.temp + '°C');
        await this.loadSvgIcon(wd.weatherIcon);
        wd.weatherIconSvg = this.weatherIconSvg;
        this.applyWeatherData(wd);
        this.setCache(wd);
      } catch (e) {
        console.warn('[Weather] 天气查询失败:', e.message);
        throw e;
      }
    },

    fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
    },

    // ═══════ 天气代码 → 图标 & 背景映射 ═══════

    _isNight() { const h = new Date().getHours(); return h >= 18 || h < 6; },
    _iconBase: 'https://basmilius.github.io/weather-icons/production/fill/all/',

    // 风向角度 → 方位文字
    degToDir(deg) {
      if (deg == null) return '';
      const dirs = ['北风', '东北偏北风', '东北风', '东北偏东风', '东风', '东南偏东风', '东南风', '东南偏南风', '南风', '西南偏南风', '西南风', '西南偏西风', '西风', '西北偏西风', '西北风', '西北偏北风'];
      return dirs[Math.round(deg / 22.5) % 16];
    },

    // WMO 标准天气代码映射 (Open-Meteo 使用)
    getWeatherMapFromWmoCode(code) {
      const n = this._isNight();
      let icon = 'not-available';
      let bg = n ? 'night-cloudy' : 'cloudy';

      if (code === 0) {
        icon = n ? 'clear-night' : 'clear-day';
        bg = n ? 'night-clear' : 'sunny';
      } else if (code === 1 || code === 2) {
        icon = n ? 'partly-cloudy-night' : 'partly-cloudy-day';
        bg = n ? 'night-cloudy' : 'cloudy';
      } else if (code === 3) {
        icon = 'cloudy';
        bg = n ? 'night-cloudy' : 'cloudy';
      } else if (code === 45 || code === 48) {
        icon = 'fog';
        bg = 'foggy';
      } else if (code >= 51 && code <= 57) {
        icon = 'drizzle';
        bg = 'rainy';
      } else if (code >= 61 && code <= 67) {
        icon = 'rain';
        bg = 'rainy';
      } else if (code >= 71 && code <= 77) {
        icon = 'snow';
        bg = 'snowy';
      } else if (code >= 80 && code <= 82) {
        icon = 'rain';
        bg = code === 82 ? 'stormy' : 'rainy';
      } else if (code === 85 || code === 86) {
        icon = 'snow';
        bg = 'snowy';
      } else if (code >= 95 && code <= 99) {
        icon = 'thunderstorms';
        bg = 'stormy';
      } else {
        icon = n ? 'partly-cloudy-night' : 'partly-cloudy-day';
      }
      return { icon: `${this._iconBase}${icon}.svg`, bg };
    },

    // ═══════ 缓存 ═══════

    getCache() {
      try {
        const c = localStorage.getItem(CACHE_KEY);
        if (!c) return null;
        const d = JSON.parse(c);
        if (Date.now() - d.timestamp > CACHE_DURATION) { localStorage.removeItem(CACHE_KEY); return null; }
        return d;
      } catch (e) { return null; }
    },

    _lastDispatchedBg: null,
    setCache(data) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
        if (data.weatherBg && data.weatherBg !== this._lastDispatchedBg) {
          this._lastDispatchedBg = data.weatherBg;
          window.dispatchEvent(new CustomEvent('sky-weather-updated', { detail: { weatherBg: data.weatherBg, location: data.location } }));
        }
      } catch (e) { }
    },

    // ═══════ 通用工具 ═══════

    applyWeatherData(d) {
      this.location = d.location;
      this.weather = d.weather;
      this.weatherIcon = d.weatherIcon;
      this.weatherIconSvg = d.weatherIconSvg || '';
      this.weatherBg = d.weatherBg || 'sunny';
    },

    async loadSvgIcon(url) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          let svg = await res.text();
          svg = svg.replace(/<\?xml[^>]*\?>/g, '');
          svg = svg.replace(/<svg/, '<svg class="w-full h-full"');
          this.weatherIconSvg = svg;
        } else { this.weatherIconSvg = ''; }
      } catch (e) { this.weatherIconSvg = ''; }
    }
  };
}

function initializeAll() {
  // 注册模板中使用的组件
  Alpine.data('floatingDock', createFloatingDock);
  Alpine.data('shareModal', createShareModal);
  Alpine.data('commentDrawer', createCommentDrawer);
  Alpine.data('headerController', createHeaderController);
  Alpine.data('navbarController', createNavbarController);
  Alpine.data('createThemeToggle', createThemeToggle);
  Alpine.data('sideFloatingDock', createSideFloatingDock);

  // 文档页组件
  Alpine.data('simpleFloatingDock', createSimpleFloatingDock);
  Alpine.data('docFloatingDock', createDocFloatingDock);
  Alpine.data('docCommentDrawer', createDocCommentDrawer);

  // 小工具组件
  Alpine.data('welcomeWeatherCard', welcomeWeatherCard);
}


export {
  initializeAll,
  createFloatingDock,
  createShareModal,
  createCommentDrawer,
  createHeaderController,
  createNavbarController,
  createThemeToggle,
  createSideFloatingDock,
  createSimpleFloatingDock,
  createDocFloatingDock,
  createDocCommentDrawer,
  welcomeWeatherCard
};
