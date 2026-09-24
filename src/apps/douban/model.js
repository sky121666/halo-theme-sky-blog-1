/** Douban 1.2.6 exposes flat DTOs; older releases wrap these fields in spec/faves. */
export function normalizeDoubanItem(item) {
  const entry = item && typeof item === "object" ? item : {};
  const spec = entry.spec || entry;
  return {
    ...spec,
    favesCreateTime: entry.favesCreateTime ?? entry.faves?.createTime ?? "",
    favesRemark: entry.favesRemark ?? entry.faves?.remark ?? "",
  };
}
