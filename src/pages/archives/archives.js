/**
 * 归档页脚本
 * 模板位置：templates/archives.html
 */
import './archives.css';
import { notifySwupPageReady, registerAlpinePageComponents } from '../../common/js/page-runtime.js';

// Alpine.js 归档滚动组件
(function() {
  function _registerAlpineComponents() {
  Alpine.data('archiveScroll', () => ({
    currentMonth: {},

    init() {
      this.updateCurrentMonth();
    },

    updateCurrentMonth() {
      const sections = document.querySelectorAll('.month-section');
      const headerOffset = 100; // 粘性标题的高度偏移

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const year = section.dataset.year;
        const month = section.dataset.month;

        // 当月份区块进入视口顶部时更新
        if (rect.top <= headerOffset + 50 && rect.bottom > headerOffset) {
          this.currentMonth[year] = month;
        }
      });
    },
  }));
}
  registerAlpinePageComponents(_registerAlpineComponents);
  notifySwupPageReady();
})();
