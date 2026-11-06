// Enrich link safety without replacing relationships supplied by authors/plugins.
export function decorateExternalLinks(root, location) {
  root.querySelectorAll('a[href]').forEach((link) => {
    let url;
    try {
      url = new URL(link.href, location.href);
    } catch {
      return;
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === location.origin) return;
    link.setAttribute('target', '_blank');
    link.relList.add('noopener', 'noreferrer');
  });
}
