export function collectionCanonical(content, source, publicOrigin) {
  if (!content.dataset.collectionBase) return undefined;
  const sections = content.querySelectorAll("[data-collection-pager]");
  const candidates = sections.length
    ? Array.from(sections).filter((section) => !section.hidden)
    : [content];
  const section = candidates.find((candidate) => candidate.querySelector("h1")) ?? content;
  const base = new URL(section.dataset.collectionBase || source.pathname, publicOrigin || source.origin);
  base.search = "";
  base.hash = "";
  const current = Number(section.dataset.collectionPage);
  const pages = Number(section.dataset.collectionTotalPages);
  if (!Number.isInteger(current) || current <= 1 || !Number.isInteger(pages) || current > pages) return base.href;
  if (section.dataset.collectionMode === "photos") {
    base.searchParams.set("page", String(current));
    const size = section.dataset.collectionSize || source.searchParams.get("size");
    if (size) base.searchParams.set("size", size);
    return base.href;
  }
  if (section.dataset.collectionMode === "path") {
    return new URL(base.pathname.replace(/\/$/, "") + "/page/" + current, base).href;
  }
  base.searchParams.set("p", String(current));
  return base.href;
}
