/**
 * 作者归档页 JavaScript
 * 路由：/authors/:name
 */

import './author.css';
import { createPage } from "../../common/js/page.js";

const page = createPage();
export const { mount, registerAlpine } = page;

// 页面初始化
page.onMount(() => {
  // 作者页面目前只展示文章列表，无需额外JS逻辑
});
