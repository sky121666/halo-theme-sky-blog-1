/**
 * 单页面脚本
 * 模板位置：templates/page.html
 */

// 导入页面样式（已包含 article-content.css）
import './page.css';
import { notifySwupPageReady, registerPageLifecycle } from '../../common/js/page-runtime.js';

// 导入公共文章内容脚本
import '../../static/js/article-content.js';

// 页面初始化
registerPageLifecycle(() => {
  if (!document.getElementById('page-container')) return;
}, { entry: 'page' });

notifySwupPageReady();
