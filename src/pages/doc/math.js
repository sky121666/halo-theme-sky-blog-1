import { skyDebug } from '../../common/js/debug.js';

const ASSET_PATH = '/plugins/plugin-katex/assets/static/katex.min.js';
let loading = null;

function officialAsset(document) {
  return Array.from(document.querySelectorAll('#swup-scripts script[src]')).find((script) => {
    try {
      const url = new URL(script.src, document.baseURI);
      return url.origin === new URL(document.baseURI).origin && url.pathname === ASSET_PATH;
    } catch {
      return false;
    }
  })?.src;
}

function loadKatex(source, document, window) {
  if (typeof window.katex?.render === 'function') return Promise.resolve(window.katex);
  if (loading) return loading;
  // Docsme's defer script is inert after PJAX insertion. Load only the official
  // asset declared by the current plugin response, never a guessed CDN resource.
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = true;
    let timer;
    const complete = (error) => {
      clearTimeout(timer);
      script.remove();
      if (error) reject(error);
      else resolve(window.katex);
    };
    script.addEventListener('load', () => complete(
      typeof window.katex?.render === 'function' ? null : new Error('KaTeX API unavailable')
    ), { once: true });
    script.addEventListener('error', () => complete(new Error('KaTeX asset failed')), { once: true });
    timer = setTimeout(() => complete(new Error('KaTeX asset timeout')), 10000);
    document.head.appendChild(script);
  }).finally(() => { loading = null; });
  return loading;
}

export async function renderDocsMath({ signal, document = globalThis.document, window = globalThis.window } = {}) {
  const content = document.getElementById('article-content');
  if (!content || signal?.aborted) return;
  const source = officialAsset(document);
  if (!source) return; // Plugin absent/disabled: do not revive a previous page's API.
  const nodes = Array.from(content.querySelectorAll('[math-inline], [math-display]'));
  if (!nodes.some((node) => !node.querySelector('.katex, .katex-error'))) return;

  try {
    const katex = await loadKatex(source, document, window);
    if (signal?.aborted || !content.isConnected) return;
    for (const node of nodes) {
      if (!node.isConnected || !content.contains(node) || node.querySelector('.katex, .katex-error')) continue;
      try {
        katex.render(node.innerText || node.textContent || '', node, {
          displayMode: node.hasAttribute('math-display'),
          throwOnError: false,
        });
      } catch {
        // One malformed formula must not stop the rest of the document.
        skyDebug.warn('docs-math', '公式渲染失败，保留正文');
      }
    }
  } catch {
    skyDebug.warn('docs-math', '公式资源不可用，保留原文，下次进入时重试');
  }
}
