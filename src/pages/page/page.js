/**
 * 单页面脚本
 * 模板位置：templates/page.html
 */

// 导入页面样式
import './page.css';

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
  initPageContent();
});

/**
 * 初始化页面内容
 */
function initPageContent() {
  const content = document.getElementById('page-content');
  if (!content) return;

  // 处理外部链接 - 添加 target="_blank"
  const links = content.querySelectorAll('a[href^="http"]');
  links.forEach((link) => {
    if (!link.hostname.includes(window.location.hostname)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });

  // 处理图片 - 添加懒加载
  const images = content.querySelectorAll('img:not([loading])');
  images.forEach((img) => {
    img.setAttribute('loading', 'lazy');
  });

  // 移除内容中可能存在的内联 style 标签（如 blur 效果）
  const inlineStyles = content.querySelectorAll('style');
  inlineStyles.forEach((style) => {
    if (style.textContent.includes('blur')) {
      style.remove();
    }
  });
}
