#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { pluginContracts } from "./plugin-contracts.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const themeAsset = '<script src="/themes/theme-sky-blog-1/assets/js/main.js"></script>';
const loginHtml = `${themeAsset}<form class="halo-form"></form>`;
const photosHtml = `${themeAsset}<div class="photo-grid">图库</div><script src="photos.js"></script>`;

function plugin(name, { enabled = true, phase = "STARTED", version = "1.0.0" } = {}) {
  return { metadata: { name }, spec: { enabled, version }, status: { phase } };
}

async function fixture({ plugins = [], pages = {}, inventoryStatus = 200 } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-page-scope-"));
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ method: request.method, path: request.url });
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }
    if (request.url.startsWith("/apis/api.console.halo.run/v1alpha1/plugins")) {
      response.writeHead(inventoryStatus, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ items: plugins }));
      return;
    }
    if (request.url === "/v3/api-docs") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ info: { version: "2.22.0-fixture" } }));
      return;
    }
    const page = pages[request.url] ?? (request.url === "/login" ? { body: loginHtml } : null);
    response.writeHead(page?.status ?? (page ? 200 : 404), {
      "Content-Type": page?.contentType || "text/html; charset=utf-8",
    });
    response.end(page?.body || "fixture route absent");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function run(script = "verify-plugin-pages.mjs", { env = {}, args = [] } = {}) {
    const reportPath = path.join(directory, `report-${Date.now()}-${Math.random()}.json`);
    const commandArgs = [path.join(scriptDirectory, script), ...args];
    if (script === "verify-plugin-pages.mjs") commandArgs.push(`--report=${reportPath}`);
    const childEnvironment = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      HALO_BASE_URL: baseUrl,
      HALO_PAT: "fixture-read-only-token",
      HALO_API_TIMEOUT_MS: "1000",
      SMOKE_TIMEOUT_MS: "1000",
      ...env,
    };
    const child = spawn(process.execPath, commandArgs, { cwd: directory, env: childEnvironment });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    const exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    const report = script === "verify-plugin-pages.mjs" ? JSON.parse(await fs.readFile(reportPath, "utf8")) : null;
    return { exitCode, stdout, stderr, report };
  }

  return {
    run,
    requests,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await fs.rm(directory, { recursive: true, force: true });
    },
  };
}

function row(result, name) {
  const found = result.report.results.find((entry) => entry.name === name);
  assert.ok(found, `report must include ${name}`);
  return found;
}

// Catches unowned base/deep/API checks requesting routes from absent plugins.
test("missing plugins are not applicable across pages, optional checks and deep APIs", async () => {
  const site = await fixture();
  try {
    const result = await site.run(undefined, { env: { VERIFY_PLUGIN_DEEP: "true", BANGUMI_VALIDATE_INVALID: "true" } });
    assert.equal(result.exitCode, 0, result.stderr || result.stdout);
    assert.equal(row(result, "Login").outcome, "passed");
    for (const [name, owner] of [
      ["Photos", "PluginPhotos"],
      ["Moments", "PluginMoments"],
      ["Docsme", "plugin-docsme"],
      ["Bangumi", "plugin-bilibili-bangumi"],
      ["Steam", "steam"],
      ["Equipment", "equipment"],
      ["Douban", "plugin-douban"],
      ["Login Passkey", "auth-passkey"],
      ["Dishes External Route", "dishes"],
      ["Schedule External Route", "schedule-calendar"],
      ["Photo Detail", "PluginPhotos"],
      ["Home Docs Widget", "plugin-docsme"],
      ["Home Links Widget", "PluginLinks"],
      ["Home Moments Widget", "PluginMoments"],
      ["Feed XML", "PluginFeed"],
      ["Sitemap XML", "PluginSitemap"],
      ["Robots Sitemap", "PluginSitemap"],
      ["Links 2.2.1 Public API", "PluginLinks"],
      ["Douban Items API", "plugin-douban"],
      ["Online Summary API", "online"],
      ["Bangumi Page Boundary", "plugin-bilibili-bangumi"],
    ]) {
      const entry = row(result, name);
      assert.equal(entry.plugin, owner, name);
      assert.equal(entry.outcome, "not-applicable", name);
      assert.equal(entry.ok, null, `${name} must not count as a pass`);
    }
    assert.equal(result.report.summary.failed, 0);
    assert.equal(result.report.summary.passed, 1);
    assert.match(result.stdout, /SKIP\s+Photos/);
    assert.ok(site.requests.every((request) => request.method === "GET"));
    assert.deepEqual(site.requests.map((request) => request.path).sort(), [
      "/apis/api.console.halo.run/v1alpha1/plugins?size=200", "/login", "/v3/api-docs",
    ]);
  } finally {
    await site.close();
  }
});

// Catches optional coverage silently disappearing when its URL is unset.
test("an active optional feature without a target URL is explicitly not covered", async () => {
  const site = await fixture({ plugins: [plugin("PluginPhotos")], pages: { "/photos": { body: photosHtml } } });
  try {
    const result = await site.run();
    assert.equal(result.exitCode, 0, result.stderr || result.stdout);
    const detail = row(result, "Photo Detail");
    assert.equal(detail.outcome, "not-covered");
    assert.equal(detail.ok, null);
    assert.match(detail.error, /PHOTO_DETAIL_URL/);
    assert.equal(result.report.summary.notCovered, 1);
    assert.equal(result.report.summary.complete, false);
    assert.match(result.stdout, /NOT-COVERED\s+Photo Detail/);
    assert.doesNotMatch(result.stdout, /Plugin smoke passed/);
  } finally {
    await site.close();
  }
});

// Catches a disabled Passkey plugin making the basic login check fail.
test("basic login passes while a disabled Passkey entry is not applicable", async () => {
  const site = await fixture({ plugins: [plugin("auth-passkey", { enabled: false })] });
  try {
    const result = await site.run();
    assert.equal(result.exitCode, 0, result.stderr || result.stdout);
    assert.equal(row(result, "Login").outcome, "passed");
    assert.equal(row(result, "Login Passkey").outcome, "not-applicable");
    assert.match(row(result, "Login Passkey").error, /disabled/);
  } finally {
    await site.close();
  }
});

// Catches over-skipping: an active plugin still requires its rendered entry.
test("an active Passkey plugin with a missing entry fails independently of login", async () => {
  const site = await fixture({ plugins: [plugin("auth-passkey")] });
  try {
    const result = await site.run();
    assert.equal(result.exitCode, 1);
    assert.equal(row(result, "Login").outcome, "passed");
    assert.equal(row(result, "Login Passkey").outcome, "failed");
    assert.match(result.stdout, /FAIL\s+Login Passkey/);
  } finally {
    await site.close();
  }
});

test("an active Passkey entry can pass its own check", async () => {
  const site = await fixture({
    plugins: [plugin("auth-passkey")],
    pages: { "/login": { body: `${loginHtml}<a href="login?method=passkey"><img src="/plugins/auth-passkey/assets/static/passkey.svg"></a>` } },
  });
  try {
    const result = await site.run();
    assert.equal(result.exitCode, 0, result.stderr || result.stdout);
    assert.equal(row(result, "Login Passkey").outcome, "passed");
  } finally {
    await site.close();
  }
});

test("an active plugin whose required route returns 404 remains a failure", async () => {
  const site = await fixture({ plugins: [plugin("PluginPhotos")] });
  try {
    const result = await site.run();
    assert.equal(result.exitCode, 1);
    assert.equal(row(result, "Photos").outcome, "failed");
    assert.equal(row(result, "Photos").status, 404);
  } finally {
    await site.close();
  }
});

// Catches an unavailable inventory being mistaken for known active plugins.
for (const [name, options, env] of [
  ["missing credentials", {}, { HALO_PAT: "" }],
  ["an unreadable inventory", { inventoryStatus: 401 }, {}],
  ["an unknown runtime phase", { plugins: [plugin("PluginPhotos", { phase: "UNKNOWN" })] }, {}],
]) {
  test(`${name} leaves plugin checks unverified and exits incomplete`, async () => {
    const site = await fixture(options);
    try {
      const result = await site.run(undefined, { env });
      assert.equal(result.exitCode, 2, result.stderr || result.stdout);
      assert.equal(row(result, "Login").outcome, "passed");
      assert.equal(row(result, "Photos").outcome, "not-covered");
      assert.equal(row(result, "Photos").ok, null);
      assert.ok(!site.requests.some((request) => request.path === "/photos"));
      assert.doesNotMatch(result.stdout, /Plugin smoke passed/);
    } finally {
      await site.close();
    }
  });
}

for (const [name, body, expectedExit, expectedOutcome] of [
  ["valid", '{"online":2}', 0, "passed"],
  ["invalid", '{"message":"count absent"}', 1, "failed"],
]) {
  test(`a known active deep API with ${name} data reports its actual result`, async () => {
    const site = await fixture({
      plugins: [plugin("online")],
      pages: { "/apis/online-user.zyx2012.cn/v1alpha1/stats/summary": { body, contentType: "application/json" } },
    });
    try {
      const result = await site.run(undefined, { env: { VERIFY_PLUGIN_DEEP: "true" } });
      assert.equal(result.exitCode, expectedExit, result.stderr || result.stdout);
      assert.equal(row(result, "Online Summary API").outcome, expectedOutcome);
      assert.equal(row(result, "Links 2.2.1 Public API").outcome, "not-applicable");
    } finally {
      await site.close();
    }
  });
}

test("a configured active optional page is still validated", async () => {
  const site = await fixture({ plugins: [plugin("vote")], pages: { "/vote-fixture": { body: themeAsset } } });
  try {
    const result = await site.run(undefined, { env: { VOTE_PAGE_URL: "/vote-fixture" } });
    assert.equal(result.exitCode, 1);
    assert.equal(row(result, "Vote Block").outcome, "failed");
    assert.equal(row(result, "Vote Block").plugin, "vote");
  } finally {
    await site.close();
  }
});

const commentResource = "/plugins/PluginCommentWidget/assets/static/comment-widget.js?version=3.5.0";

async function commentFixture(content) {
  return fixture({
    plugins: [plugin("PluginCommentWidget", { version: "3.5.0" })],
    pages: {
      "/comment-fixture": {
        body: `${themeAsset}<section id="plugin-comment-widget"><h2>评论交流</h2>${content}</section>`,
      },
      [commentResource]: { body: "export function init() {}", contentType: "text/javascript" },
    },
  });
}

function commentInitialization(id, { group = "content.halo.run", kind = "Post", name = "fixture" } = {}) {
  return `<script type="module" data-pjax>
    import { init } from "${commentResource}";
    init("#${id}", { group: "${group}", kind: "${kind}", name: "${name}" });
  </script>`;
}

// Catches treating every official comment subject as a content.halo.run Post.
for (const [kind, group, id] of [
  ["Post", "content.halo.run", "comment-content-halo-run-Post-fixture"],
  ["DocTree", "doc.halo.run", "comment-doc-halo-run-DocTree-fixture"],
  ["Moment", "moment.halo.run", "comment-moment-halo-run-Moment-fixture"],
]) {
  test(`Comment Widget accepts a rendered ${kind} container bound to the official initializer`, async () => {
    const site = await commentFixture(`<div id="${id}"></div>${commentInitialization(id, { group, kind })}`);
    try {
      const result = await site.run(undefined, {
        env: { VERIFY_PLUGIN_DEEP: "true", COMMENT_PAGE_URL: "/comment-fixture" },
      });
      assert.equal(result.exitCode, 0, result.stderr || result.stdout);
      assert.equal(row(result, "Comment Widget").outcome, "passed");
    } finally {
      await site.close();
    }
  });
}

// Catches weakening the mounted-widget check into an asset or ID substring check.
const postCommentId = "comment-content-halo-run-Post-fixture";
for (const [name, content] of [
  ["no rendered container", commentInitialization(postCommentId)],
  [
    "no initialization",
    `<div id="${postCommentId}"></div><script type="module">import { init } from "${commentResource}";</script>`,
  ],
  [
    "a different initialization target",
    `<div id="${postCommentId}"></div>${commentInitialization("comment-content-halo-run-Post-other")}`,
  ],
  [
    "a container only inside a comment",
    `<!-- <div id="${postCommentId}"></div> -->${commentInitialization(postCommentId)}`,
  ],
  [
    "a container only inside a template",
    `<template><div id="${postCommentId}"></div></template>${commentInitialization(postCommentId)}`,
  ],
  [
    "an initializer from another module",
    `<div id="${postCommentId}"></div>${commentInitialization(postCommentId).replace(`from "${commentResource}"`, 'from "/unrelated.js"')}<script src="${commentResource}"></script>`,
  ],
  ["a loader without a mount", `<script src="${commentResource}"></script>`],
]) {
  test(`Comment Widget rejects ${name}`, async () => {
    const site = await commentFixture(content);
    try {
      const result = await site.run(undefined, {
        env: { VERIFY_PLUGIN_DEEP: "true", COMMENT_PAGE_URL: "/comment-fixture" },
      });
      assert.equal(result.exitCode, 1, result.stderr || result.stdout);
      assert.equal(row(result, "Comment Widget").outcome, "failed");
    } finally {
      await site.close();
    }
  });
}

// Catches weakening strict drift rejection just to silence newer-version rows.
test("strict version checks still reject a newer version while normal checks only warn", async () => {
  const installed = pluginContracts.map((contract) => plugin(contract.plugin, {
    version: contract.plugin === "shiki" ? "9.9.9" : contract.testedVersion || contract.contractVersion,
  }));
  const site = await fixture({ plugins: installed });
  try {
    const normal = await site.run("check-plugin-versions.mjs", { args: ["--json"] });
    const strict = await site.run("check-plugin-versions.mjs", { args: ["--strict", "--json"] });
    assert.equal(normal.exitCode, 0, normal.stderr);
    assert.equal(strict.exitCode, 1);
    assert.equal(JSON.parse(normal.stdout).summary.failures, 0);
    assert.equal(JSON.parse(strict.stdout).summary.failures, 1);
    assert.equal(JSON.parse(strict.stdout).rows.find((entry) => entry.plugin === "shiki").result, "newer");
  } finally {
    await site.close();
  }
});

test("version help explains strict historical drift and does not require API credentials", async () => {
  const site = await fixture();
  try {
    const result = await site.run("check-plugin-versions.mjs", { args: ["--help"], env: { HALO_PAT: "" } });
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /--strict/);
    assert.match(result.stdout, /historical|历史/i);
    assert.match(result.stdout, /runtime|运行/i);
    assert.equal(site.requests.length, 0);
  } finally {
    await site.close();
  }
});
