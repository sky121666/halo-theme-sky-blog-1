/**
 * 友情链接页脚本
 * 模板位置：templates/links.html
 */
import './links.css';

// API 地址
const LINK_SUBMIT_API = '/apis/anonymous.link.submit.kunkunyu.com/v1alpha1/linksubmits/-/submit';
const LINK_GROUPS_API = '/apis/anonymous.link.submit.kunkunyu.com/v1alpha1/linkgroups';

// Alpine.js 友链提交表单组件
document.addEventListener('alpine:init', () => {
  Alpine.data('linkSubmitForm', () => ({
    form: {
      type: 'add',
      displayName: '',
      url: '',
      logo: '',
      email: '',
      description: '',
      rssUrl: '',
      groupName: '',
    },
    groups: [],
    submitting: false,
    result: {
      show: false,
      success: false,
      message: '',
    },

    init() {
      this.fetchGroups();
    },

    // 获取分组列表
    async fetchGroups() {
      try {
        const res = await fetch(LINK_GROUPS_API);
        if (res.ok) {
          this.groups = await res.json();
        }
      } catch (e) {
        console.warn('获取友链分组失败:', e);
      }
    },

    // 提交友链
    async submitLink() {
      this.submitting = true;
      this.result.show = false;

      try {
        const res = await fetch(LINK_SUBMIT_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(this.form),
        });

        if (res.ok) {
          this.result = {
            show: true,
            success: true,
            message: '友链申请已提交，请等待站长审核！',
          };
          // 重置表单
          this.resetForm();
          // 3秒后关闭弹窗
          setTimeout(() => {
            document.getElementById('link-submit-modal').close();
            this.result.show = false;
          }, 3000);
        } else {
          const error = await res.json().catch(() => ({}));
          this.result = {
            show: true,
            success: false,
            message: error.message || '提交失败，请稍后重试',
          };
        }
      } catch (e) {
        this.result = {
          show: true,
          success: false,
          message: '网络错误，请检查网络连接',
        };
      } finally {
        this.submitting = false;
      }
    },

    // 重置表单
    resetForm() {
      this.form = {
        type: 'add',
        displayName: '',
        url: '',
        logo: '',
        email: '',
        description: '',
        rssUrl: '',
        groupName: '',
      };
    },
  }));
});

// 友链卡片交互增强
document.addEventListener('DOMContentLoaded', () => {
  // 图片加载失败时显示默认图标
  const linkImages = document.querySelectorAll('.link-card img');
  linkImages.forEach((img) => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      const fallback = img.nextElementSibling;
      if (fallback) {
        fallback.style.display = 'flex';
      }
    });
  });
});
