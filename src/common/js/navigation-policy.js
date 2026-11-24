const documentRoutes = ["/login", "/signup", "/logout", "/password-reset", "/uc", "/console",
  "/dishes", "/schedule-calendar", "/maintenance"];

const localQueryKeys = {
  "/links": ["view", "scope", "groupName", "linkName", "itemId", "group", "link"],
  "/douban": ["dataType", "genre", "page", "size", "type", "status"],
};

export function ignoreDocumentVisit(url, base, element) {
  if (element?.closest("[data-no-swup]")) return true;
  const target = new URL(url, base);
  const origin = new URL(base).origin;
  return target.origin !== origin || documentRoutes.some((path) =>
    target.pathname === path || target.pathname.startsWith(path + "/"));
}

export function resolveThemeUrl(input, origin) {
  const url = new URL(input, origin);
  const keys = localQueryKeys[url.pathname.replace(/\/$/, "")];
  if (!keys) return input;
  for (const key of keys) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.pathname + url.search;
}
