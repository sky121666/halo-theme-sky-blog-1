#!/usr/bin/env node

import assert from "node:assert/strict";
import { normalizeDoubanItem } from "../src/apps/douban/model.js";
import { LINK_APPLICATION_API, requestLinkCaptcha, submitLinkApplication } from "../src/apps/links/application.js";

// Shape sampled from the public 1.2.6 API; do not require private user data.
const current = {
  id: "douban-movie-fixture",
  name: "示例电影",
  poster: "https://example.com/poster.jpg",
  link: "https://movie.douban.com/subject/123/",
  score: "8.1",
  year: "2023",
  type: "movie",
  dataType: "db",
  cardSubtitle: "2023 / 剧情",
  favesCreateTime: "2024-03-17T18:27:16Z",
  favesRemark: "一段观后感",
};
assert.deepEqual(normalizeDoubanItem(current), current);
const { favesCreateTime, favesRemark, ...spec } = current;
assert.deepEqual(normalizeDoubanItem({ spec, faves: { createTime: favesCreateTime, remark: favesRemark } }), current);
assert.deepEqual(normalizeDoubanItem(null), { favesCreateTime: "", favesRemark: "" });
assert.equal(normalizeDoubanItem({ name: "<img onerror=alert(1)>" }).name, "<img onerror=alert(1)>");

const requests = [];
const signal = new AbortController().signal;
const fetchImpl = async (url, options) => {
  requests.push({ url, ...options });
  return new Response(
    JSON.stringify(
      url.endsWith("/captcha")
        ? { challengeId: "one-use-challenge", image: "data:image/png;base64,fixture", expiresInSeconds: 300 }
        : { id: "pending-application", status: "PENDING" },
    ),
    { status: url.endsWith("/captcha") ? 200 : 201 },
  );
};
const captcha = await requestLinkCaptcha({ signal, fetchImpl });
const submitted = await submitLinkApplication(
  {
    url: "https://example.com",
    displayName: "示例站点",
    rssUrl: "https://example.com/feed.xml",
    captchaCode: "ABCDE",
    groupName: "admin-only-group",
    status: "APPROVED",
  },
  captcha.challengeId,
  { signal, fetchImpl },
);
assert.equal(submitted.status, "PENDING");
assert.equal(requests[0].url, `${LINK_APPLICATION_API}/captcha`);
assert.equal(requests[1].url, LINK_APPLICATION_API);
for (const request of requests) {
  assert.equal(request.method, "POST");
  assert.equal(request.credentials, "omit");
  assert.equal(request.signal, signal);
  assert.equal(request.headers?.Authorization, undefined);
}
const body = JSON.parse(requests[1].body);
assert.deepEqual(body.feedUrls, ["https://example.com/feed.xml"]);
assert.equal(body.challengeId, captcha.challengeId);
assert.equal(body.captchaCode, "ABCDE");
assert.equal(body.groupName, undefined);
assert.equal(body.status, undefined);

for (const [status, type, message] of [
  [400, "invalid-link-application", /网站信息/],
  [400, "invalid-link-application-captcha", /验证码错误/],
  [403, "link-application-disabled", /暂未开放/],
  [409, "duplicate-link-application", /勿重复/],
  [409, "link-application-capacity-reached", /已满/],
  [429, "request-not-permitted", /频繁/],
  [503, "link-application-unavailable", /不可用/],
  [502, "unknown", /稍后再试/],
]) {
  await assert.rejects(
    submitLinkApplication({}, "consumed", {
      fetchImpl: async () => new Response(JSON.stringify({ type: `https://halo.run/probs/${type}` }), { status }),
    }),
    message,
  );
}
await assert.rejects(
  requestLinkCaptcha({
    fetchImpl: async () => new Response(JSON.stringify({ challengeId: "x", image: "https://example.com/track" })),
  }),
  /加载失败/,
);
console.log(
  "Plugin upgrade regressions passed: Douban flat/legacy DTOs; Links guest API, errors and credential boundaries.",
);
