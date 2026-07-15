/**
 * 作者归档页 JavaScript
 * 路由：/authors/:name
 */

import './author.css';
import { notifySwupPageReady, registerPageLifecycle } from '../../common/js/page-runtime.js';

// 页面初始化
registerPageLifecycle(() => {
  // 作者页面目前只展示文章列表，无需额外JS逻辑
}, { entry: 'author' });

notifySwupPageReady();
