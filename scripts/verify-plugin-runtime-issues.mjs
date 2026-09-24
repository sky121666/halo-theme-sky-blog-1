#!/usr/bin/env node

// Read-only local runtime checks for plugin-owned issues that the theme cannot mask.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { themeCodeIdentity } from "./theme-code-identity.mjs";

const root = path.resolve(import.meta.dirname, "..");
const argumentsByName = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const equal = arg.indexOf("=");
      return [arg.slice(2, equal), arg.slice(equal + 1)];
    }),
);
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const equal = line.indexOf("=");
    if (equal < 1) continue;
    const name = line.slice(0, equal).trim();
    if (process.env[name] != null) continue;
    let value = line.slice(equal + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    process.env[name] = value;
  }
}

const baseUrl = new URL(argumentsByName.base || process.env.HALO_BASE_URL || "http://localhost:8090");
if (!(["localhost", "127.0.0.1"].includes(baseUrl.hostname) && ["http:", "https:"].includes(baseUrl.protocol))) {
  throw new Error("Runtime issue checks are restricted to localhost or 127.0.0.1");
}
const freshSinceArg = argumentsByName["cache-fresh-since"];
const freshSince = Date.parse(freshSinceArg || "");
if (!Number.isFinite(freshSince)) {
  throw new Error("Pass --cache-fresh-since=<UTC ISO time> from the latest local Page Cache refresh");
}
const reportPath = argumentsByName.report && path.resolve(argumentsByName.report);
const runId = Date.now().toString(36);
const startedAt = new Date().toISOString();
const codeAtStart = themeCodeIdentity(root);
const results = [];
const timeoutMs = 30000;
const pat = process.env.HALO_PAT;

function result(id, owner, status, detail = {}) {
  const entry = { id, owner, status, ...detail };
  results.push(entry);
  return entry;
}

function cacheAge(response) {
  const cacheAt = response.headers.get("x-halo-cache-at");
  if (!cacheAt) return { cacheAt: null, stale: false };
  const parsed = Date.parse(cacheAt);
  return { cacheAt, stale: !Number.isFinite(parsed) || parsed + 1000 < freshSince };
}

async function request(route, { accept = "text/html", headers = {}, timeout = timeoutMs } = {}) {
  const url = new URL(route, baseUrl);
  if (url.origin !== baseUrl.origin) throw new Error("Cross-origin runtime request refused");
  const response = await fetch(url, {
    redirect: "manual",
    headers: { Accept: accept, ...headers },
    signal: AbortSignal.timeout(timeout),
  });
  return { response, body: await response.text() };
}

function canonicalLinks(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => {
      const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1];
      if (!rel?.toLowerCase().split(/\s+/).includes("canonical")) return null;
      return tag.match(/\bhref=["']([^"']+)["']/i)?.[1]?.replaceAll("&amp;", "&") || null;
    })
    .filter(Boolean);
}

async function htmlCase(id, owner, route, { canonical, title, marker } = {}) {
  try {
    const { response, body } = await request(route);
    const age = cacheAge(response);
    const links = canonicalLinks(body);
    const canonicalPaths = links.map((href) => {
      try {
        const url = new URL(href, baseUrl);
        return url.pathname + url.search;
      } catch {
        return "invalid";
      }
    });
    const pageTitle = body.match(/<title\b[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";
    const failures = [];
    if (response.status !== 200) failures.push(`HTTP ${response.status}`);
    if (age.stale) failures.push(`stale Page Cache: ${age.cacheAt}`);
    if (canonical && (canonicalPaths.length !== 1 || canonicalPaths[0] !== canonical)) {
      failures.push(`canonical expected ${canonical}, got ${canonicalPaths.join(",") || "none"}`);
    }
    if (title && !pageTitle.includes(title)) failures.push(`title missing ${title}`);
    if (marker && !body.includes(marker)) failures.push(`HTML marker missing ${marker}`);
    return result(id, owner, failures.length ? "failed" : "passed", {
      route,
      httpStatus: response.status,
      cacheAt: age.cacheAt,
      title: pageTitle,
      canonicalPaths,
      failures,
    });
  } catch (error) {
    return result(id, owner, "failed", { route, failures: [error.message] });
  }
}

async function inventory() {
  const { response, body } = await request("/v3/api-docs", { accept: "application/json" });
  const haloVersion = response.ok ? JSON.parse(body)?.info?.version : null;
  if (!pat) return { haloVersion, plugins: null, role: null };
  const authorization = { Authorization: `Bearer ${pat}` };
  const pluginsResponse = await request("/apis/api.console.halo.run/v1alpha1/plugins?size=200", {
    accept: "application/json",
    headers: authorization,
  });
  const plugins = pluginsResponse.response.ok
    ? JSON.parse(pluginsResponse.body)
        .items.filter((item) =>
          ["seo-tools", "auth-passkey", "plugin-bilibili-bangumi", "equipment", "page-cache"].includes(
            item.metadata?.name,
          ),
        )
        .map((item) => ({ id: item.metadata.name, version: item.spec?.version, phase: item.status?.phase }))
    : null;
  const roleResponse = await request("/api/v1alpha1/roles/plugin-passkey-role-template-authenticated", {
    accept: "application/json",
    headers: authorization,
  });
  const role = roleResponse.response.ok ? JSON.parse(roleResponse.body) : null;
  return { haloVersion, plugins, role };
}

let environment;
try {
  environment = await inventory();
} catch (error) {
  environment = { haloVersion: null, plugins: null, role: null, inventoryError: error.message };
}

for (const collection of ["categories", "tags"]) {
  await htmlCase(`seo.${collection}.invalid`, "seo-tools", `/${collection}?p=abc`, {
    canonical: `/${collection}`,
    marker: collection === "categories" ? "文章分类" : "文章标签",
  });
  await htmlCase(`seo.${collection}.alias`, "seo-tools", `/${collection}?page=2`, {
    canonical: `/${collection}?p=2`,
    title: "第 2 页",
  });
  await htmlCase(`seo.${collection}.page`, "seo-tools", `/${collection}?p=2`, {
    canonical: `/${collection}?p=2`,
    title: "第 2 页",
  });
}
for (const route of ["/dishes", "/schedule-calendar"]) {
  await htmlCase(`seo.external.${route.slice(1)}`, "seo-tools", route, { canonical: route });
}

await htmlCase("bangumi.original", "plugin-bilibili-bangumi", "/bangumis", { marker: "bangumi-page" });
for (const route of ["/bangumis?typeNum=2&status=0", "/bangumis?page=2"]) {
  const url = new URL(route, baseUrl);
  url.searchParams.set("runtimeProbe", runId);
  await htmlCase(
    `bangumi.fresh.${url.searchParams.has("page") ? "page" : "filter"}`,
    "plugin-bilibili-bangumi",
    url.pathname + url.search,
    {
      marker: "bangumi-page",
    },
  );
}
result("bangumi.upstream-failure", "plugin-bilibili-bangumi", "not_tested", {
  reason:
    "A healthy request cannot prove Bilibili TLS timeout handling; no plugin or network configuration was changed.",
});

await htmlCase("equipment.original", "equipment", "/equipments", { marker: "equipment-page" });
try {
  const { response, body } = await request("/apis/api.equipment.kunkunyu.com/v1alpha1/equipments?page=1&size=20", {
    accept: "application/json",
  });
  const data = response.ok ? JSON.parse(body) : null;
  result("equipment.public-api", "equipment", response.ok && Array.isArray(data?.items) ? "passed" : "failed", {
    httpStatus: response.status,
    total: data?.total ?? null,
    returnedItems: data?.items?.length ?? null,
  });
} catch (error) {
  result("equipment.public-api", "equipment", "failed", { failures: [error.message] });
}
const equipmentStart = new Date().toISOString();
const equipmentProbe = `/equipments?runtimeProbe=${runId}`;
await htmlCase("equipment.fresh", "equipment", equipmentProbe, { marker: "equipment-page" });
const equipmentEnd = new Date(Date.now() + 1000).toISOString();
const container = argumentsByName["docker-container"] || "halo";
const logs = spawnSync("docker", ["logs", `--since=${equipmentStart}`, `--until=${equipmentEnd}`, container], {
  encoding: "utf8",
  maxBuffer: 2 * 1024 * 1024,
});
if (logs.status === 0) {
  const lines = `${logs.stdout || ""}\n${logs.stderr || ""}`.split(/\r?\n/);
  const warnings = lines.filter((line) => line.includes("Page size must not be greater than 1000"));
  result("equipment.page-size", "equipment", warnings.length ? "failed" : "passed", {
    freshRoute: equipmentProbe,
    warningCount: warnings.length,
    logWindow: [equipmentStart, equipmentEnd],
    failures: warnings.length ? ["Finder requested page size above Halo limit"] : [],
  });
} else {
  result("equipment.page-size", "equipment", "not_tested", {
    reason: "Local Docker logs unavailable; HTML alone cannot detect the Finder page-size warning.",
  });
}

await htmlCase("passkey.login", "auth-passkey", "/login?method=passkey", {
  marker: "passkey.halo.run/v1alpha1/authentication/verify",
});
try {
  const { response } = await request("/apis/api.passkey.halo.run/v1alpha1/credentials", {
    accept: "application/json",
  });
  result(
    "passkey.anonymous-guard",
    "auth-passkey",
    response.status === 302 || response.status === 401 ? "passed" : "failed",
    {
      httpStatus: response.status,
    },
  );
} catch (error) {
  result("passkey.anonymous-guard", "auth-passkey", "failed", { failures: [error.message] });
}
const role = environment.role;
const credentialRule = role?.rules?.some(
  (rule) =>
    rule.verbs?.some((verb) => ["get", "*"].includes(verb)) &&
    rule.nonResourceURLs?.includes("/apis/api.passkey.halo.run/v1alpha1/credentials"),
);
result(
  "passkey.role-declaration",
  "auth-passkey",
  role
    ? credentialRule && role.metadata?.labels?.["rbac.authorization.halo.run/aggregate-to-authenticated"] === "true"
      ? "passed"
      : "failed"
    : "not_tested",
  {
    pluginRolePresent: Boolean(role),
    credentialGetDeclared: Boolean(credentialRule),
    aggregateToAuthenticated:
      role?.metadata?.labels?.["rbac.authorization.halo.run/aggregate-to-authenticated"] === "true",
  },
);

const cookie = process.env.PASSKEY_TEST_COOKIE;
const expectedUser = process.env.PASSKEY_TEST_USER;
if (cookie && expectedUser?.startsWith("codex-passkey-qa-")) {
  try {
    const headers = { Cookie: cookie, Accept: "application/json" };
    const current = await request("/apis/uc.api.halo.run/v1alpha1/users/-", { headers });
    const user = current.response.ok ? JSON.parse(current.body) : null;
    if (current.response.status !== 200 || user?.name !== expectedUser) {
      result("passkey.disposable-user", "auth-passkey", "failed", {
        currentUserStatus: current.response.status,
        failure: "Cookie does not identify the named disposable QA user",
      });
    } else {
      const credentials = await request("/apis/api.passkey.halo.run/v1alpha1/credentials", { headers });
      result("passkey.disposable-user", "auth-passkey", credentials.response.status === 200 ? "passed" : "failed", {
        currentUserStatus: current.response.status,
        credentialsStatus: credentials.response.status,
      });
    }
  } catch (error) {
    result("passkey.disposable-user", "auth-passkey", "failed", { failures: [error.message] });
  }
} else {
  result("passkey.disposable-user", "auth-passkey", "not_tested", {
    reason: "Requires a separately created disposable logged-in QA account; admin PAT is not an ordinary-user test.",
  });
}

const codeAtEnd = themeCodeIdentity(root);
const report = {
  schemaVersion: 1,
  startedAt,
  finishedAt: new Date().toISOString(),
  environment: {
    baseUrl: baseUrl.origin,
    haloVersion: environment.haloVersion,
    theme: {
      version: "2.2.39",
      codeHash: codeAtEnd.codeHash,
      unchangedDuringRun: codeAtStart.codeHash === codeAtEnd.codeHash,
    },
    plugins: environment.plugins,
    inventoryError: environment.inventoryError || null,
    pageCacheFreshSince: freshSinceArg,
    dockerContainer: container,
  },
  scope:
    "Local read-only HTTP and backend-log checks. No deterministic Bilibili failure injection or ordinary-user Passkey session was created.",
  results,
  summary: Object.fromEntries(
    ["passed", "failed", "not_tested"].map((status) => [
      status,
      results.filter((entry) => entry.status === status).length,
    ]),
  ),
};
if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
for (const entry of results) {
  console.log(
    `${entry.status.toUpperCase().padEnd(10)} ${entry.id}${entry.failures?.length ? `: ${entry.failures.join("; ")}` : ""}`,
  );
}
console.log(`Runtime issue checks: ${JSON.stringify(report.summary)}${reportPath ? `; report=${reportPath}` : ""}`);
if (report.summary.failed || !report.environment.theme.unchangedDuringRun) process.exitCode = 1;
