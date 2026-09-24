#!/usr/bin/env node

import assert from "node:assert/strict";
import { annualWindow, fetchAnnualPublicPosts, localDateKey } from "../src/common/js/article-heatmap-data.js";

const now = new Date("2026-09-23T12:00:00Z");
const { start, end, startKey } = annualWindow(now);
assert.equal(startKey, localDateKey(start));
assert.equal(end.getTime() > start.getTime(), true);
const dates = new Set();
for (const day = new Date(start); day < end; day.setDate(day.getDate() + 1)) dates.add(localDateKey(day));
assert.equal(dates.size, 365);

const boundary = localDateKey("2026-09-22T16:30:00Z");
if (process.env.TZ === "Asia/Shanghai") assert.equal(boundary, "2026-09-23");
if (process.env.TZ === "America/Los_Angeles") assert.equal(boundary, "2026-09-22");

const recentItems = Array.from({ length: 605 }, (_, index) => ({
  metadata: { name: `post-${index}` },
  spec: {
    title: `文章 ${index}`,
    slug: `post-${index}`,
    publishTime: new Date(now.getTime() - index * 3600_000).toISOString(),
    visible: "PUBLIC",
    publish: true,
  },
  status: { hideFromList: false },
}));
const oldItem = structuredClone(recentItems[0]);
oldItem.metadata.name = "too-old";
oldItem.spec.publishTime = new Date(start.getTime() - 1).toISOString();
const items = [...recentItems, oldItem];
const calls = [];
const fetchImpl = async (url, options) => {
  const query = new URL(url, "https://example.com").searchParams;
  const page = Number(query.get("page"));
  calls.push({ page, credentials: options.credentials, signal: options.signal });
  const slice = items.slice((page - 1) * 100, page * 100);
  return new Response(JSON.stringify({ items: slice, hasNext: page * 100 < items.length, totalPages: Math.ceil(items.length / 100) }));
};

const posts = await fetchAnnualPublicPosts({ now, fetchImpl });
assert.equal(posts.length, 605, "一年内超过 500 篇时不得截断");
assert.deepEqual(calls.map((call) => call.page), [1, 2, 3, 4, 5, 6, 7]);
assert.ok(calls.every((call) => call.credentials === "omit"));

await assert.rejects(
  fetchAnnualPublicPosts({ now, fetchImpl: async () => new Response("unavailable", { status: 503 }) }),
  /HTTP 503/,
);
await assert.rejects(
  fetchAnnualPublicPosts({ now, fetchImpl: async () => new Response(JSON.stringify({ items: [] })) }),
  /格式不正确/,
);

console.log(`Annual heatmap API/date checks passed in ${process.env.TZ || "system timezone"}.`);
