#!/usr/bin/env node

// Local-only authenticated Passkey probe. Creates and removes one disposable Halo user.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { themeCodeIdentity } from "./theme-code-identity.mjs";

if (!process.argv.includes("--allow-local-write")) {
  throw new Error("This probe creates a disposable local account; pass --allow-local-write only with authorization");
}
const root = path.resolve(import.meta.dirname, "..");
const statePath = path.join(os.tmpdir(), "codex-passkey-runtime-qa-state.json");
const reportArg = process.argv.find((arg) => arg.startsWith("--report="))?.slice("--report=".length);
const reportPath = reportArg ? path.resolve(reportArg) : null;
const cleanupOnly = process.argv.includes("--cleanup");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const equal = line.indexOf("=");
      return [
        line.slice(0, equal).trim(),
        line
          .slice(equal + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);
const base = new URL(env.HALO_BASE_URL || "http://localhost:8090");
if (!["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Only local Halo is allowed");
if (!env.HALO_PAT) throw new Error("HALO_PAT is required for account creation and cleanup");
const adminHeaders = { Authorization: `Bearer ${env.HALO_PAT}` };
const startedAt = new Date().toISOString();
const codeHash = themeCodeIdentity(root).codeHash;

async function api(route, { method = "GET", body, headers = {}, allowed = [200] } = {}) {
  const url = new URL(route, base);
  if (url.origin !== base.origin) throw new Error("Cross-origin request refused");
  const response = await fetch(url, {
    method,
    redirect: "manual",
    headers: { ...adminHeaders, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body == null ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  if (!allowed.includes(response.status)) throw new Error(`${method} ${route}: HTTP ${response.status}`);
  return { status: response.status, data };
}

function addCookies(jar, response) {
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";", 1)[0];
    const equal = pair.indexOf("=");
    if (equal > 0) jar.set(pair.slice(0, equal), pair.slice(equal + 1));
  }
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function solveAltcha(html, jar) {
  const challengePath = html.match(/<altcha-widget\b[^>]*\bchallengeurl=["']([^"']+)["']/i)?.[1];
  if (!challengePath) throw new Error("Login form Altcha challenge URL not found");
  const challengeUrl = new URL(challengePath, base);
  if (challengeUrl.origin !== base.origin || challengeUrl.pathname !== "/captcha/altcha") {
    throw new Error("Unexpected Altcha challenge URL");
  }
  const response = await fetch(challengeUrl, {
    redirect: "manual",
    headers: { Cookie: cookieHeader(jar), Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  addCookies(jar, response);
  if (!response.ok) throw new Error(`Altcha challenge HTTP ${response.status}`);
  const challenge = await response.json();
  if (challenge.algorithm !== "SHA-256" || !Number.isInteger(challenge.maxnumber) || challenge.maxnumber > 1000000) {
    throw new Error("Unsupported Altcha challenge parameters");
  }
  const started = Date.now();
  for (let number = 0; number <= challenge.maxnumber; number += 1) {
    const candidate = crypto.createHash("sha256").update(`${challenge.salt}${number}`).digest("hex");
    if (candidate === challenge.challenge) {
      return Buffer.from(JSON.stringify({ ...challenge, number, took: Date.now() - started })).toString("base64");
    }
  }
  throw new Error("Altcha challenge could not be solved within the published limit");
}

async function login(username, password) {
  const jar = new Map();
  const form = await fetch(new URL("/login", base), { redirect: "manual", signal: AbortSignal.timeout(15000) });
  addCookies(jar, form);
  const html = await form.text();
  const csrf = html.match(/name=["']_csrf["'][^>]*value=["']([^"']+)["']/)?.[1];
  if (!csrf) throw new Error("Login form CSRF field not found");
  const encodedKey = html.match(/const publicKey\s*=\s*([^;]+);/)?.[1];
  if (!encodedKey) throw new Error("Halo login RSA public key not found");
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(JSON.parse(encodedKey), "base64"),
    format: "der",
    type: "spki",
  });
  const encryptedPassword = crypto
    .publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(password))
    .toString("base64");
  const altcha = await solveAltcha(html, jar);
  const response = await fetch(new URL("/login", base), {
    method: "POST",
    redirect: "manual",
    headers: { Cookie: cookieHeader(jar), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password: encryptedPassword, _csrf: csrf, altcha }),
    signal: AbortSignal.timeout(15000),
  });
  addCookies(jar, response);
  return {
    status: response.status,
    redirectPath: response.headers.get("location"),
    cookieNames: [...jar.keys()],
    cookie: cookieHeader(jar),
  };
}

async function userRequest(route, cookie) {
  const response = await fetch(new URL(route, base), {
    redirect: "manual",
    headers: { Cookie: cookie, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  return { status: response.status, data };
}

async function permissionSnapshot(username) {
  const { data } = await api(`/apis/api.console.halo.run/v1alpha1/users/${username}/permissions`);
  const credentialUrl = "/apis/api.passkey.halo.run/v1alpha1/credentials";
  const matchingRoles = (data.permissions || [])
    .filter((role) =>
      role.rules?.some(
        (rule) =>
          rule.nonResourceURLs?.includes(credentialUrl) &&
          rule.verbs?.some((verb) => verb === "get" || verb === "*"),
      ),
    )
    .map((role) => role.metadata?.name);
  return {
    directRoles: (data.roles || []).map((role) => role.metadata?.name),
    credentialPermissionRoles: matchingRoles,
    credentialGetEffective: matchingRoles.length > 0,
  };
}

async function cleanup(username) {
  if (!username.startsWith("codex-passkey-qa-")) throw new Error("Refusing to clean an unrecognized account");
  const bindings = (await api("/api/v1alpha1/rolebindings?size=200")).data;
  if (bindings.total > bindings.items.length) throw new Error("RoleBinding list was truncated");
  const matching = bindings.items.filter((binding) => binding.subjects?.some((subject) => subject.name === username));
  for (const binding of matching) {
    if (binding.subjects?.some((subject) => subject.name !== username)) {
      throw new Error(`Refusing to delete shared RoleBinding ${binding.metadata.name}`);
    }
    await api(`/api/v1alpha1/rolebindings/${binding.metadata.name}`, {
      method: "DELETE",
      allowed: [200, 202, 204, 404],
    });
  }
  await api(`/api/v1alpha1/users/${username}`, { method: "DELETE", allowed: [200, 202, 204, 404] });
  let userStatus = 200;
  let remainingRoleBindings = 1;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const user = await api(`/api/v1alpha1/users/${username}`, { allowed: [200, 404] });
    const after = (await api("/api/v1alpha1/rolebindings?size=200")).data;
    userStatus = user.status;
    remainingRoleBindings =
      after.items?.filter((binding) => binding.subjects?.some((subject) => subject.name === username)).length ?? 0;
    if (userStatus === 404 && remainingRoleBindings === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (userStatus !== 404 || remainingRoleBindings !== 0) throw new Error("Disposable account cleanup is incomplete");
  if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
  return { userGetAfterCleanup: userStatus, deletedRoleBindings: matching.length, remainingRoleBindings };
}

if (cleanupOnly) {
  if (!fs.existsSync(statePath)) throw new Error("No disposable Passkey probe state to clean");
  const { username } = JSON.parse(fs.readFileSync(statePath, "utf8"));
  console.log(JSON.stringify({ username, cleanup: await cleanup(username) }));
} else {
  if (fs.existsSync(statePath)) throw new Error("Previous disposable probe state exists; run --cleanup first");
  const username = `codex-passkey-qa-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(3).toString("hex")}`;
  const password = crypto.randomBytes(32).toString("base64url");
  const report = {
    schemaVersion: 1,
    startedAt,
    environment: { baseUrl: base.origin, haloVersion: null, themeCodeHash: codeHash, passkeyVersion: "1.0.4" },
    disposableUser: username,
    initial: null,
    withExplicitPluginRole: null,
    cleanup: null,
    error: null,
  };
  fs.writeFileSync(statePath, `${JSON.stringify({ username, startedAt })}\n`, { mode: 0o600 });
  try {
    const docs = await api("/v3/api-docs");
    report.environment.haloVersion = docs.data.info.version;
    await api("/apis/api.console.halo.run/v1alpha1/users", {
      method: "POST",
      body: {
        name: username,
        displayName: "Codex Passkey 临时验收",
        email: `${username}@example.invalid`,
        password,
        roles: ["post-contributor"],
      },
      allowed: [200, 201],
    });
    let emailVerified = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const user = (await api(`/api/v1alpha1/users/${username}`)).data;
      if (user.spec.emailVerified === true) {
        emailVerified = true;
        break;
      }
      user.spec.emailVerified = true;
      try {
        await api(`/api/v1alpha1/users/${username}`, { method: "PUT", body: user });
        emailVerified = true;
        break;
      } catch (error) {
        if (!error.message.includes("HTTP 409") || attempt === 7) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!emailVerified) throw new Error("Disposable account email verification state did not persist");

    const firstLogin = await login(username, password);
    const firstUser = await userRequest("/apis/uc.api.halo.run/v1alpha1/users/-", firstLogin.cookie);
    report.initial = {
      loginStatus: firstLogin.status,
      loginRedirectPath: firstLogin.redirectPath,
      cookieNames: firstLogin.cookieNames,
      currentUserStatus: firstUser.status,
      credentialsStatus: null,
      permissions: await permissionSnapshot(username),
    };
    if (firstUser.status !== 200 || firstUser.data?.name !== username) {
      throw new Error(`Disposable account login did not establish the expected user (HTTP ${firstUser.status})`);
    }
    const firstCredentials = await userRequest("/apis/api.passkey.halo.run/v1alpha1/credentials", firstLogin.cookie);
    report.initial.credentialsStatus = firstCredentials.status;

    const bindingName = `${username}-plugin-role`;
    await api("/api/v1alpha1/rolebindings", {
      method: "POST",
      body: {
        apiVersion: "v1alpha1",
        kind: "RoleBinding",
        metadata: { name: bindingName },
        roleRef: { apiGroup: "", kind: "Role", name: "plugin-passkey-role-template-authenticated" },
        subjects: [{ apiGroup: "", kind: "User", name: username }],
      },
      allowed: [200, 201],
    });
    let afterBindingPermissions;
    const permissionWaitStarted = Date.now();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      afterBindingPermissions = await permissionSnapshot(username);
      if (afterBindingPermissions.credentialGetEffective) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const permissionWaitMs = Date.now() - permissionWaitStarted;
    const secondLogin = await login(username, password);
    const secondUser = await userRequest("/apis/uc.api.halo.run/v1alpha1/users/-", secondLogin.cookie);
    if (secondUser.status !== 200 || secondUser.data?.name !== username) {
      throw new Error(`Role-bound login did not establish the expected user (HTTP ${secondUser.status})`);
    }
    const secondCredentials = await userRequest("/apis/api.passkey.halo.run/v1alpha1/credentials", secondLogin.cookie);
    report.withExplicitPluginRole = {
      loginStatus: secondLogin.status,
      currentUserStatus: secondUser.status,
      credentialsStatus: secondCredentials.status,
      permissions: afterBindingPermissions,
      permissionWaitMs,
    };
  } catch (error) {
    report.error = error.message;
  } finally {
    try {
      report.cleanup = await cleanup(username);
    } catch (error) {
      report.cleanup = {
        error: error.message,
        recovery: `node scripts/verify-passkey-disposable.mjs --allow-local-write --cleanup`,
      };
    }
    report.finishedAt = new Date().toISOString();
    if (reportPath) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    }
    console.log(JSON.stringify(report));
    if (report.error || report.cleanup.error || report.initial?.credentialsStatus !== 200) process.exitCode = 1;
  }
}
