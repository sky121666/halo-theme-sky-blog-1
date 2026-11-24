/**
 * 单页面脚本
 * 模板位置：templates/page.html
 */

// 导入页面样式（已包含 article-content.css）
import './page.css';
import { createPage } from "../../common/js/page.js";

const page = createPage();
export const { mount, registerAlpine } = page;
import { initializePageCover } from './cover.js';

// 导入公共文章内容脚本

// 页面初始化
page.onMount(() => {
  if (!document.getElementById('page-container')) return;
  return initializePageCover(document.getElementById('page-cover'));
});
