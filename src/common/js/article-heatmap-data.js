const POSTS_API = "/apis/api.content.halo.run/v1alpha1/posts";
const PAGE_SIZE = 100;

export function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function annualWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 364);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end, startKey: localDateKey(start) };
}

/** Fetch every public listed post in the visitor's last 365 calendar days. */
export async function fetchAnnualPublicPosts({ signal, fetchImpl = fetch, now = new Date() } = {}) {
  const { start, end } = annualWindow(now);
  const posts = [];
  const seenNames = new Set();
  let page = 1;

  while (true) {
    const query = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE), sort: "spec.publishTime,desc" });
    const response = await fetchImpl(`${POSTS_API}?${query}`, {
      signal,
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`文章列表请求失败：HTTP ${response.status}`);

    const result = await response.json();
    if (!Array.isArray(result?.items) || typeof result.hasNext !== "boolean") {
      throw new Error("文章列表响应格式不正确");
    }

    let reachedEarlierPosts = false;
    for (const item of result.items) {
      const publishedAt = new Date(item?.spec?.publishTime);
      if (Number.isNaN(publishedAt.getTime())) continue;
      if (publishedAt < start) {
        reachedEarlierPosts = true;
        break;
      }
      if (publishedAt >= end || item.spec.visible !== "PUBLIC" || item.spec.publish !== true || item.spec.deleted === true || item.status?.hideFromList === true) continue;
      const name = item.metadata?.name;
      if (!name || seenNames.has(name)) continue;
      seenNames.add(name);
      posts.push({ name, title: String(item.spec.title || ""), slug: String(item.spec.slug || ""), date: item.spec.publishTime });
    }

    if (reachedEarlierPosts || !result.hasNext) return posts;
    if (result.items.length === 0 || (Number.isInteger(result.totalPages) && page >= result.totalPages)) {
      throw new Error("文章列表分页状态不一致");
    }
    page += 1;
  }
}
