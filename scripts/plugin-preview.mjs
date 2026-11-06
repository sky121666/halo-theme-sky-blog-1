export function previewPageUrl(path, baseUrl, theme) {
  const url = new URL(path, baseUrl);
  const isResource =
    /^\/(?:apis?|plugins|themes|js|webjars|upload)(?:\/|$)/.test(url.pathname) ||
    /\.(?:xml|rss|txt|js|css|json|map|png|jpe?g|svg|webp|gif|woff2?)$/i.test(url.pathname);
  if (theme && url.origin === new URL(baseUrl).origin && !isResource) {
    url.searchParams.set("preview-theme", theme);
  }
  return url.href;
}

export function renderedThemeIdentity(html, expectedTheme) {
  const themes = [
    ...new Set([...html.matchAll(/(?:src|href)=["'][^"']*\/themes\/([^/"']+)\/assets\//g)].map((match) => match[1])),
  ];
  return { ok: themes.length === 1 && themes[0] === expectedTheme, themes };
}
