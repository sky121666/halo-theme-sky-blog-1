/**
 * 分类索引与归档页共用脚本。
 * 分类切换和翻页由真实链接交给 Halo/Swup 处理，确保 URL、分页器与每页文章数一致。
 */
import './categories.css';
import { notifySwupPageReady, registerAlpinePageComponents } from '../../common/js/page-runtime.js';

function publishVisibleCategoryItems(root) {
  const items = Array.from(root.querySelectorAll('#category-posts article')).map((article) => {
    const title = article.querySelector('h2, h3');
    const link = title?.querySelector('a') || article.querySelector('a');
    const permalink = link?.getAttribute('href') || '#';
    return {
      spec: { title: title?.textContent?.trim() || '' },
      status: { permalink },
      stats: {},
      metadata: { name: permalink },
    };
  });
  document.dispatchEvent(new CustomEvent('category-items', { detail: items }));
}

function registerCategoryComponents() {
  const page = () => ({
    init() {
      publishVisibleCategoryItems(this.$root);
    },
  });
  Alpine.data('categoriesPage', page);
  Alpine.data('categoryArchive', page);
}

registerAlpinePageComponents(registerCategoryComponents);
notifySwupPageReady();
