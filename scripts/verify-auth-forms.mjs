#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const readTemplate = (name) => readFileSync(new URL(`../templates/${name}`, import.meta.url), "utf8");
const common = readTemplate("gateway_fragments/common.html");
const signup = readTemplate("gateway_fragments/signup.html");
const loginLocal = readTemplate("login_local.html");
const scripts = (html) => [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const sendCodeScript = scripts(common).find((source) => source.includes("window.sendVerificationCode"));
const requestScript = scripts(signup).find((source) => source.includes('fetch("/signup/send-email-code"'));
const coreScript = process.env.HALO_AUTH_CORE_SCRIPT ? readFileSync(process.env.HALO_AUTH_CORE_SCRIPT, "utf8") : null;
const encryptionScript = scripts(common).find((source) => source.includes("function encryptPassword"));

// Execute the production submit handler; replace only the DOM surface and RSA boundary.
function encryptedLoginFlow() {
  let onSubmit;
  const notices = [];
  const plaintext = { value: "reader-test-password" };
  const password = { value: "" };
  const form = {
    addEventListener: (type, callback) => {
      if (type === "submit") onSubmit = callback;
    },
    appendChild: (element) => notices.push(element),
  };
  const document = {
    addEventListener: (type, callback) => {
      if (type === "DOMContentLoaded") callback();
    },
    getElementById: (id) => ({ "login-form": form, plainPassword: plaintext, password })[id],
    createElement: () => {
      const attributes = new Map();
      const element = {
        textContent: "",
        setAttribute: (name, value) => attributes.set(name, value),
        getAttribute: (name) => attributes.get(name) ?? null,
        focus: () => { document.activeElement = element; },
        remove: () => notices.splice(notices.indexOf(element), 1),
      };
      return element;
    },
  };
  const context = { document };
  assert.ok(encryptionScript);
  runInNewContext(encryptionScript, context);
  return {
    password, plaintext, notices, document,
    encryptWith: (encrypt) => {
      context.JSEncrypt = class {
        setPublicKey() {}
        encrypt(value) { return encrypt(value); }
      };
    },
    submit: () => {
      const event = new Event("submit", { cancelable: true });
      assert.doesNotThrow(() => onSubmit(event), "encryption failures must be handled inside the form");
      return event;
    },
  };
}

test("登录加密库缺失时阻止提交并显示恢复提示，重复尝试不堆叠提示", () => {
  const flow = encryptedLoginFlow();
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal(flow.submit().defaultPrevented, true);
    assert.equal(flow.password.value, "");
    assert.equal(flow.notices.length, 1);
    assert.equal(flow.notices[0].getAttribute("role"), "alert");
    assert.match(flow.notices[0].textContent, /刷新|重试/);
  }
});

for (const result of [false, null, "", " \t"]) {
  test(`登录加密返回 ${JSON.stringify(result)} 时不提交无效密文`, () => {
    const flow = encryptedLoginFlow();
    flow.encryptWith(() => result);
    assert.equal(flow.submit().defaultPrevented, true);
    assert.equal(flow.password.value, "");
    assert.equal(flow.notices.length, 1);
  });
}

test("登录加密异常清除旧密文，保留输入且不向提示泄露异常内容", () => {
  const flow = encryptedLoginFlow();
  flow.password.value = "old-ciphertext";
  flow.encryptWith((value) => { throw new Error(value); });
  assert.equal(flow.submit().defaultPrevented, true);
  assert.equal(flow.password.value, "");
  assert.equal(flow.plaintext.value, "reader-test-password");
  assert.equal(flow.notices.length, 1);
  assert.ok(!flow.notices[0].textContent.includes("reader-test-password"));
});

test("登录加密恢复后移除错误提示并按原协议提交密文", () => {
  const flow = encryptedLoginFlow();
  assert.equal(flow.submit().defaultPrevented, true);
  flow.encryptWith((value) => value === "reader-test-password" ? "rsa-ciphertext" : false);
  assert.equal(flow.submit().defaultPrevented, false);
  assert.equal(flow.password.value, "rsa-ciphertext");
  assert.equal(flow.plaintext.value, "reader-test-password");
  assert.equal(flow.notices.length, 0);
});

// Only fetch, timers and alerts are substituted; both handlers come from the production templates.
function sendCodeFlow(responses, email = "reader@example.test") {
  const alerts = [];
  const requests = [];
  const timers = new Map();
  let onClick;
  const button = {
    textContent: "发送验证码",
    disabled: false,
    addEventListener: (type, callback) => {
      if (type === "click") onClick = callback;
    },
  };
  const document = {
    addEventListener: (type, callback) => {
      if (type === "DOMContentLoaded") callback();
    },
    getElementById: (id) => (id === "email" ? { value: email } : button),
  };
  const context = {
    document,
    window: {},
    alert: (message) => alerts.push(message),
    fetch: async (url, options) => {
      requests.push({ url, options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response instanceof Response, "An explicit HTTP response is required");
      return response;
    },
    setInterval: (callback) => {
      const id = timers.size + 1;
      timers.set(id, callback);
      return id;
    },
    clearInterval: (id) => timers.delete(id),
  };
  assert.ok(sendCodeScript);
  assert.ok(requestScript);
  runInNewContext(sendCodeScript, context);
  context.sendVerificationCode = context.window.sendVerificationCode;
  runInNewContext(requestScript, context);
  return { click: () => onClick(), button, alerts, requests, timers };
}

const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status });
const failures = [
  {
    name: "400 errors array",
    response: () => jsonResponse(400, { errors: ["Invalid email"] }),
    message: "Invalid email",
  },
  {
    name: "429 problem detail",
    response: () => jsonResponse(429, { title: "Too Many Requests", detail: "Please try again later" }),
    message: "Please try again later",
  },
  { name: "403 problem title", response: () => jsonResponse(403, { title: "Forbidden" }), message: "Forbidden" },
  { name: "500 empty JSON", response: () => jsonResponse(500, {}), message: "发送失败，请稍后重试" },
  { name: "500 null JSON", response: () => jsonResponse(500, null), message: "发送失败，请稍后重试" },
  {
    name: "500 non-JSON body",
    response: () => new Response("<h1>Server error</h1>", { status: 500 }),
    message: "发送失败，请稍后重试",
  },
  {
    name: "302 non-success response",
    response: () => new Response("", { status: 302 }),
    message: "发送失败，请稍后重试",
  },
  {
    name: "empty errors with useful detail",
    response: () => jsonResponse(400, { errors: [""], detail: "Email is required" }),
    message: "Email is required",
  },
  {
    name: "malformed error fields",
    response: () => jsonResponse(400, { errors: "invalid", detail: { reason: "bad" }, title: "Bad request" }),
    message: "Bad request",
  },
  { name: "network failure", response: () => new TypeError("Network unavailable"), message: "Network unavailable" },
];

for (const { name, response, message } of failures) {
  test(`验证码 ${name} 提示错误并允许再次发送，不启动成功倒计时`, async () => {
    const flow = sendCodeFlow([response(), new Response(null, { status: 204 })]);
    await flow.click();
    assert.deepEqual(flow.alerts, [message]);
    assert.equal(flow.button.disabled, false);
    assert.equal(flow.button.textContent, "发送验证码");
    assert.equal(flow.timers.size, 0);
    await flow.click();
    assert.equal(flow.button.disabled, true);
    assert.equal(flow.timers.size, 1);
  });
}

for (const status of [200, 204, 299]) {
  test(`验证码 ${status} 成功才开始倒计时，到期恢复发送入口`, async () => {
    const flow = sendCodeFlow([new Response(null, { status })]);
    await flow.click();
    assert.deepEqual(flow.alerts, []);
    assert.equal(flow.button.disabled, true);
    assert.equal(flow.timers.size, 1);
    for (let second = 0; second < 60; second++) {
      for (const tick of flow.timers.values()) tick();
    }
    assert.equal(flow.button.disabled, false);
    assert.equal(flow.button.textContent, "发送验证码");
    assert.equal(flow.timers.size, 0);
    const [{ url, options }] = flow.requests;
    assert.equal(url, "/signup/send-email-code");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { email: "reader@example.test" });
  });
}

test("验证码邮箱缺失时保留重试入口且不发请求", async () => {
  const flow = sendCodeFlow([], "");
  await flow.click();
  assert.deepEqual(flow.alerts, ["请先输入邮箱地址"]);
  assert.equal(flow.button.disabled, false);
  assert.equal(flow.requests.length, 0);
  assert.equal(flow.timers.size, 0);
});

function attributes(tag) {
  return new Map([...tag.matchAll(/([:\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

function controls(html) {
  return [...html.matchAll(/<div class="relative toggle-password-display-flag">([\s\S]*?)<\/div>/g)].map((match) => {
    const inputAttributes = attributes(match[1].match(/<input\b[^>]*>/)[0]);
    const buttonTag = match[1].match(/<(button|div)\b[^>]*class="[^"]*\btoggle-password-button\b[^"]*"[^>]*>/);
    const buttonAttributes = attributes(buttonTag[0]);
    const input = new EventTarget();
    let inputType = inputAttributes.get("type");
    const observers = [];
    Object.defineProperty(input, "type", {
      get: () => inputType,
      set: (value) => {
        inputType = value;
        observers.forEach((callback) => queueMicrotask(callback));
      },
    });
    const button = Object.assign(new EventTarget(), {
      tagName: buttonTag[1].toUpperCase(),
      dataset: {},
      getAttribute: (name) => buttonAttributes.get(name) ?? null,
      setAttribute: (name, value) => buttonAttributes.set(name, value),
    });
    const displayIcon = { style: { display: "" } };
    const hiddenIcon = { style: { display: "none" } };
    return {
      input,
      inputId: inputAttributes.get("id"),
      button,
      observers,
      querySelector: (selector) =>
        ({
          input,
          'input[type="password"]': input,
          ".toggle-password-button": button,
          ".password-display-icon": displayIcon,
          ".password-hidden-icon": hiddenIcon,
        })[selector] ?? null,
      state: () => [
        input.type,
        button.getAttribute("aria-pressed"),
        displayIcon.style.display,
        hiddenIcon.style.display,
      ],
    };
  });
}

function stateScript(html) {
  // Resolve the shared Thymeleaf fragment only when this form actually includes it.
  const reference = html.match(/th:replace="~\{login_local::passwordDisplayState\}"/);
  return reference ? scripts(loginLocal).find((source) => source.includes("MutationObserver")) : "";
}

for (const page of [
  "login_local.html",
  "gateway_fragments/signup.html",
  "gateway_fragments/password_reset_email_reset.html",
]) {
  const html = readTemplate(page);
  test(`${page} 密码按钮具有原生按钮语义、名称和关联状态`, () => {
    const pageControls = controls(html);
    assert.ok(pageControls.length > 0);
    for (const { button, inputId } of pageControls) {
      assert.equal(button.tagName, "BUTTON");
      assert.equal(button.getAttribute("type"), "button");
      assert.ok(button.getAttribute("aria-label")?.trim());
      assert.equal(button.getAttribute("aria-controls"), inputId);
      assert.equal(button.getAttribute("aria-pressed"), "false");
    }
  });

  test(`${page} 复用实际 Halo 显隐后同步 ARIA 状态，每次只切换一次`, { skip: !coreScript }, async () => {
    const pageControls = controls(html);
    const document = Object.assign(new EventTarget(), {
      querySelectorAll: (selector) => (selector === ".toggle-password-display-flag" ? pageControls : []),
    });
    class MutationObserver {
      constructor(callback) {
        this.callback = callback;
      }
      observe(input) {
        pageControls.find((control) => control.input === input).observers.push(this.callback);
      }
    }
    const context = { document, MutationObserver };
    runInNewContext(coreScript, context);
    runInNewContext(stateScript(html) ?? "", context);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    for (const control of pageControls) {
      control.button.dispatchEvent(new Event("click"));
      await Promise.resolve();
      assert.deepEqual(control.state(), ["text", "true", "none", "block"]);
      control.button.dispatchEvent(new Event("click"));
      await Promise.resolve();
      assert.deepEqual(control.state(), ["password", "false", "block", "none"]);
      control.input.type = "text";
      await Promise.resolve();
      assert.equal(control.button.getAttribute("aria-pressed"), "true");
    }
  });
}

test("登录页忘记密码链接处于正常键盘导航顺序", () => {
  const tag = [...loginLocal.matchAll(/<a\b[^>]*>/g)].find((match) => match[0].includes("/password-reset/email"))?.[0];
  assert.ok(tag);
  assert.ok(Number(attributes(tag).get("tabindex") ?? 0) >= 0);
});
