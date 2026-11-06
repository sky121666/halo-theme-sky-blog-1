export const MANAGED_QUERY_KEYS = ["view", "scope", "groupName", "linkName", "itemId", "group", "link"];

// Only Links owns these query keys. Other parameters (including preview-theme
// and server-rendered application results) still identify a different page.
export function isSameLinksResource(current, target) {
  try {
    const from = new URL(current);
    const to = new URL(target, from);
    if (!/^\/links\/?$/.test(from.pathname) || from.origin !== to.origin || from.pathname !== to.pathname) {
      return false;
    }
    for (const url of [from, to]) {
      for (const key of MANAGED_QUERY_KEYS) url.searchParams.delete(key);
      url.searchParams.sort();
    }
    return from.searchParams.toString() === to.searchParams.toString();
  } catch {
    return false;
  }
}

// Retain Swup's index and any third-party metadata. Without this URL update,
// returning from another page would load the route copied before a local push.
export function linksHistoryState(state, url) {
  return state?.source === "swup" && state.url !== url ? { ...state, url } : state;
}
