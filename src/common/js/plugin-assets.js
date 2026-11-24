const loadedAssets = new Map();

export function loadPluginScript(source, type = "", attributes = {}) {
  const url = new URL(source, window.location.href);
  if (url.origin !== window.location.origin) return Promise.reject(new Error("插件资源应由本站提供"));
  const key = url.href;
  if (loadedAssets.has(key)) return loadedAssets.get(key);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = key;
    script.type = type;
    for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
    script.dataset.themePluginResource = "";
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error("无法加载插件资源 " + url.pathname));
    };
    const timer = setTimeout(fail, 8000);
    script.addEventListener("error", fail, { once: true });
    script.addEventListener("load", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    document.head.append(script);
  }).catch((error) => {
    loadedAssets.delete(key);
    throw error;
  });
  loadedAssets.set(key, promise);
  return promise;
}

export function rememberDocumentPluginScript(source) {
  const url = new URL(source, window.location.href);
  if (url.origin === window.location.origin) loadedAssets.set(url.href, Promise.resolve());
}
