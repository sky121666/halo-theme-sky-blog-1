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
function createShareModal() {
  return {
    // 页面信息
    permalink: '',
    title: '',
    
    // 状态
    isShareOpen: false,
    copied: false,
    
    // 启用的平台 ID 列表（从配置读取）
    shareItemIds: [],
    
    // 预设的所有分享平台
    presetShareItems: [
      {
        id: "wechat",
        name: "微信",
        icon: "icon-[simple-icons--wechat]",
        type: "qrcode",  // 特殊类型：打开二维码页面
        url: "/themes/theme-sky-blog-1/assets/qrcode/qrcode-share.html?url={url}"
      },
      {
        id: "x",
        name: "X",
        icon: "icon-[simple-icons--x]",
        type: "url",
        url: "https://twitter.com/intent/tweet?url={url}&text={title}"
      },
      {
        id: "telegram",
        name: "Telegram",
        icon: "icon-[simple-icons--telegram]",
        type: "url",
        url: "https://telegram.me/share/url?url={url}&text={title}"
      },
      {
        id: "facebook",
        name: "Facebook",
        icon: "icon-[simple-icons--facebook]",
        type: "url",
        url: "https://facebook.com/sharer/sharer.php?u={url}"
      },
      {
        id: "qq",
        name: "QQ",
        icon: "icon-[simple-icons--tencentqq]",
        type: "url",
        url: "https://connect.qq.com/widget/shareqq/index.html?url={url}&title={title}"
      },
      {
        id: "qzone",
        name: "QQ空间",
        icon: "icon-[simple-icons--qzone]",
        type: "url",
        url: "https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url={url}&title={title}"
      },
      {
        id: "weibo",
        name: "微博",
        icon: "icon-[simple-icons--sinaweibo]",
        type: "url",
        url: "https://service.weibo.com/share/share.php?url={url}&title={title}"
      },
      {
        id: "douban",
        name: "豆瓣",
        icon: "icon-[simple-icons--douban]",
        type: "url",
        url: "https://www.douban.com/share/service?href={url}&name={title}"
      },
      {
        id: "native",
        name: "系统分享",
        icon: "icon-[tabler--device-desktop]",
        type: "native"  // 原生浏览器分享
      }
    ],
    
    // 初始化
    init() {
      // 从模板的 data 属性读取文章信息
      const postTitle = this.$el.dataset.postTitle || '';
      const siteTitle = this.$el.dataset.siteTitle || '';
      const postUrl = this.$el.dataset.postUrl || '';
      const shareTitleTemplate = this.$el.dataset.shareTitleTemplate || '';
      
      // 读取启用的平台 ID 列表
      const shareItemIdsStr = this.$el.dataset.shareItemIds || '';
      this.shareItemIds = shareItemIdsStr ? shareItemIdsStr.split(',') : [];
      
      // 设置分享链接（转换为绝对 URL）
      if (postUrl) {
        // 如果是相对路径，转换为绝对 URL
        if (postUrl.startsWith('/')) {
          const origin = window.location.origin;
          this.permalink = origin + postUrl;
        } else if (postUrl.startsWith('http://') || postUrl.startsWith('https://')) {
          // 已经是绝对 URL
          this.permalink = postUrl;
        } else {
          // 其他情况使用当前页面 URL
          this.permalink = window.location.href;
        }
      } else {
        this.permalink = window.location.href;
      }
      
      // 设置分享标题
      if (shareTitleTemplate && shareTitleTemplate.trim() !== '') {
        // 自定义模板
        this.title = shareTitleTemplate
          .replace(/{title}/g, postTitle)
          .replace(/{site}/g, siteTitle)
          .replace(/{author}/g, document.querySelector('meta[name="author"]')?.content || '');
      } else {
        // 默认使用文章标题
        this.title = postTitle || document.title;
      }
      
      // console.log('🔗 分享功能初始化', {
      //   标题: this.title,
      //   原始链接: postUrl,
      //   完整链接: this.permalink,
      //   启用平台: this.shareItemIds,
      //   可用平台数: this.activeShareItems.length
      // });
    },
    
    // 计算属性：过滤出启用的分享平台
    get activeShareItems() {
      if (!this.shareItemIds || this.shareItemIds.length === 0) {
        // 如果没有配置，返回所有平台
        return this.presetShareItems;
      }
      
      return this.shareItemIds
        .map(id => this.presetShareItems.find(item => item.id === id))
        .filter(Boolean)
        .filter(item => {
          // 如果是 native 类型，检查浏览器是否支持
          if (item?.type === 'native') {
            return navigator.canShare?.({
              title: this.title,
              url: this.permalink
            });
          }
          return true;
        });
    },
    
    // 关闭抽屉
    closeShareDrawer() {
      this.isShareOpen = false;
    },
    
    // 复制链接
    async copyUrl() {
      try {
        await navigator.clipboard.writeText(this.permalink);
        this.copied = true;
        setTimeout(() => {
          this.copied = false;
        }, 2000);
      } catch (err) {
        // console.error('❌ 复制失败:', err);
      }
    },
    
    // 处理分享
    handleShare(platformId) {
      const platform = this.activeShareItems.find(item => item?.id === platformId);
      if (!platform) {
        // console.error('❌ 未找到分享平台:', platformId);
        return;
      }
      
      // console.log('📤 分享到', platform.name);
      
      // 根据平台类型处理
      if (platform.type === 'native') {
        // 原生分享
        this.shareNative();
      } else if (platform.type === 'qrcode') {
        // 微信二维码（打开独立窗口）
        this.shareToWeChat();
      } else {
        // URL 分享（其他平台）
        this.shareToUrl(platform);
      }
    },
    
    // 原生分享
    shareNative() {
      if (navigator.share) {
        navigator.share({
          title: this.title,
          url: this.permalink
        }).catch(err => {
          // console.error('❌ 原生分享失败:', err);
        });
      }
    },
    
    // URL 分享
    shareToUrl(platform) {
      // 替换 URL 模板中的变量
      const shareUrl = platform.url
        .replace(/{url}/g, encodeURIComponent(this.permalink))
        .replace(/{title}/g, encodeURIComponent(this.title));
      
      // 计算居中位置
      const width = 600;
      const height = 500;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;
      const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,scrollbars=yes,resizable=yes`;
      
      // 打开分享窗口
      window.open(
        shareUrl,
        `分享到${platform.name}`,
        features
      );
    },
    
    // 微信二维码分享 - 打开独立二维码页面
    shareToWeChat() {
      // 计算居中位置
      const width = 400;
      const height = 500;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;
      const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,scrollbars=no,resizable=no`;
      
      // 构建二维码页面 URL（使用 assets 路径）
      const qrcodePageUrl = `/themes/theme-sky-blog-1/assets/qrcode/qrcode-share.html?url=${encodeURIComponent(this.permalink)}`;
      
      // console.log('📱 打开微信二维码页面:', {
      //   链接: this.permalink,
      //   二维码页面: qrcodePageUrl
      // });
      
      // 打开新窗口显示二维码
      window.open(
        qrcodePageUrl,
        '微信扫码分享',
        features
      );
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
     */
    applyTheme() {
      const themeName = this.isDark ? this.darkTheme : this.lightTheme;
      const themeMode = this.isDark ? 'dark' : 'light';
      
      document.documentElement.setAttribute('data-theme', themeName);
      document.documentElement.setAttribute('data-color-scheme', themeMode);
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
 * 文档目录抽屉控制器
 * 模板使用：templates/modules/doc/floating-dock.html
 */
function createDocTocDrawer() {
  return {
    isOpen: false,
    retryCount: 0,
    maxRetries: 10,
    
    init() {
      // 监听 isOpen 变化，在打开时初始化目录
      this.$watch('isOpen', (value) => {
        if (value) {
          this.retryCount = 0;
          this.$nextTick(() => this.initTocContent());
        }
      });
    },
    
    initTocContent() {
      const drawerNav = document.getElementById('doc-toc-drawer-nav');
      const tocNav = document.getElementById('toc-nav');
      
      if (!drawerNav) return;
      
      // 如果抽屉已经有内容，不重复初始化
      if (drawerNav.querySelector('.toc-list')) return;
      
      // 复制侧边栏目录内容
      if (tocNav && tocNav.innerHTML.trim()) {
        drawerNav.innerHTML = tocNav.innerHTML;
        this.bindClickEvents(drawerNav);
      } else if (this.retryCount < this.maxRetries) {
        // 目录可能还没生成，延迟重试
        this.retryCount++;
        setTimeout(() => this.initTocContent(), 100);
      }
    },
    
    bindClickEvents(container) {
      const links = container.querySelectorAll('.toc-link');
      const self = this;
      links.forEach(link => {
        // 移除旧的事件监听器（克隆替换）
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);
        
        newLink.addEventListener('click', function(e) {
          e.preventDefault();
          const headingId = this.getAttribute('data-heading-id') || this.getAttribute('href').slice(1);
          const heading = document.getElementById(headingId);
          if (heading) {
            window.scrollTo({
              top: heading.offsetTop - 80,
              behavior: 'smooth'
            });
            self.isOpen = false;
          }
        });
      });
    }
  };
}

/**
 * 文档菜单抽屉控制器
 * 模板使用：templates/modules/doc/floating-dock.html
 */
function createDocSidebarDrawer() {
  return {
    isOpen: false
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
 * 初始化所有组件
 * 注册模板中实际使用的 Alpine.js 组件
 */
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
  Alpine.data('docTocDrawer', createDocTocDrawer);
  Alpine.data('docSidebarDrawer', createDocSidebarDrawer);
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
  createDocTocDrawer,
  createDocSidebarDrawer
};
