#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const readTemplate = (name) => readFileSync(new URL(`../templates/${name}`, import.meta.url), "utf8");
const common = readTemplate("gateway_fragments/common.html");
const login = readTemplate("gateway_fragments/login.html");
const loginPage = readTemplate("login.html");
const authScript = readFileSync(new URL("../src/pages/auth/auth-common.js", import.meta.url), "utf8");
const illustrationScript = readFileSync(new URL("../src/pages/auth/themes/illustration.js", import.meta.url), "utf8");
const socialScript = [...common.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .find((script) => script.includes('document.querySelectorAll(".social-auth-provider-form")'));

function socialLogin(checked, count = 2) {
  const checkbox = checked === null ? null : Object.assign(new EventTarget(), { checked });
  const forms = Array.from({ length: count }, (_, index) =>
    Object.assign(new EventTarget(), {
      action: `https://halo.test/login/social/provider-${index}?remember-me=false&source=login`,
    }),
  );
  const document = Object.assign(new EventTarget(), {
    getElementById: (id) => (id === "remember-me" ? checkbox : null),
    querySelectorAll: () => forms,
  });
  assert.ok(socialScript, "社交登录脚本应存在于实际模板中");
  runInNewContext(socialScript, { document, window: { location: { origin: "https://halo.test" } }, URL });
  document.dispatchEvent(new Event("DOMContentLoaded"));
  return { checkbox, forms };
}

function submit(form) {
  form.dispatchEvent(new Event("submit", { cancelable: true }));
  return new URL(form.action, "https://halo.test");
}

function attribute(tag, name) {
  return tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
}

// Evaluate the resource attributes used here; a real Halo render remains the integration check.
function evaluateAttribute(value, variables) {
  if (value.startsWith("|") && value.endsWith("|")) {
    return value.slice(1, -1).replace(/\$\{([^}]+)\}/g, (_, expression) =>
      runInNewContext(expression, variables),
    );
  }
  if (value.startsWith("${") && value.endsWith("}")) {
    return runInNewContext(value.slice(2, -1).replaceAll("#strings.", "strings."), {
      ...variables,
      strings: { startsWith: (value, prefix) => value.startsWith(prefix) },
    });
  }
  return value;
}

function altchaSources(version) {
  const variables = { site: { version } };
  return [...common.matchAll(/<script\b((?:[^"'>]|"[^"]*"|'[^']*')*)>/g)]
    .map((match) => match[1])
    .filter((tag) => tag.includes("altcha"))
    .filter((tag) => {
      const condition = attribute(tag, "th:if");
      const unless = attribute(tag, "th:unless");
      return (
        (!condition || evaluateAttribute(condition, variables)) &&
        (!unless || !evaluateAttribute(unless, variables))
      );
    })
    .map((tag) => evaluateAttribute(attribute(tag, "th:src") ?? attribute(tag, "src"), variables));
}

function oauthFailureAlert(search) {
  const alert = [...login.matchAll(/<div\b((?:[^"'>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/div>/g)]
    .find((match) => attribute(match[1], "role") === "alert" && match[1].includes("param.oauth2_error"));
  if (!alert) return "";
  const values = new URLSearchParams(search).getAll("oauth2_error");
  const visible = evaluateAttribute(attribute(alert[1], "th:if"), {
    param: { oauth2_error: { size: () => values.length } },
  });
  return visible ? alert[2].replace(/<[^>]+>/g, "").trim() : "";
}

function passwordControl({ illustration = false, error = false } = {}) {
  const input = Object.assign(new EventTarget(), { type: "password", tagName: "INPUT" });
  const textInput = Object.assign(new EventTarget(), { type: "text", tagName: "INPUT" });
  const body = { tagName: "BODY" };
  const scene = { className: "art-scene state-idle" };
  const deferred = [];
  const displayIcon = { style: { display: "block" } };
  const hiddenIcon = { style: { display: "none" } };
  const button = new EventTarget();
  const elements = {
    input,
    'input[type="password"]': input,
    ".toggle-password-button": button,
    ".password-display-icon": displayIcon,
    ".password-hidden-icon": hiddenIcon,
  };
  const container = { dataset: {}, querySelector: (selector) => elements[selector] ?? null };
  button.closest = (selector) => (selector === ".toggle-password-display-flag" ? container : null);
  const document = Object.assign(new EventTarget(), {
    activeElement: body,
    getElementById: (id) => (illustration && id === "art-scene" ? scene : null),
    querySelector: () => null,
    querySelectorAll: (selector) => {
      if (selector === ".toggle-password-button") return [button];
      if (selector === ".toggle-password-display-flag") return [container];
      if (selector === 'input[type="text"], input[type="email"], input[type="tel"]') return [textInput];
      if (selector === 'input[type="password"], input.password-field') return [input];
      return [];
    },
  });

  // Halo v2.27.1 application/src/main/resources/static/js/main.js owns this behavior.
  document.addEventListener("DOMContentLoaded", () => {
    button.addEventListener("click", () => {
      if (input.type === "password") {
        input.type = "text";
        displayIcon.style.display = "none";
        hiddenIcon.style.display = "block";
      } else {
        input.type = "password";
        displayIcon.style.display = "block";
        hiddenIcon.style.display = "none";
      }
    });
  });
  runInNewContext(authScript, { document, window: {} });
  if (illustration) {
    runInNewContext(illustrationScript, {
      document,
      window: { innerWidth: 1440, innerHeight: 900, location: { search: error ? "?error" : "" } },
      URLSearchParams,
      requestAnimationFrame: () => {},
      setTimeout: (callback, delay) => deferred.push({ callback, delay }),
    });
  }
  document.dispatchEvent(new Event("DOMContentLoaded"));
  const flushTimers = (maxDelay) => {
    let index;
    while ((index = deferred.findIndex(({ delay }) => delay <= maxDelay)) !== -1) {
      deferred.splice(index, 1)[0].callback();
    }
  };
  return {
    click: () => {
      button.dispatchEvent(new Event("click"));
      flushTimers(10);
    },
    focus: (kind = "password") => {
      const target = kind === "text" ? textInput : input;
      document.activeElement = target;
      target.dispatchEvent(new Event("focus"));
    },
    blur: () => {
      const target = document.activeElement;
      document.activeElement = body;
      target.dispatchEvent(new Event("blur"));
    },
    scene: () => scene.className,
    state: () => [input.type, displayIcon.style.display, hiddenIcon.style.display],
    flushTimers,
  };
}

function signupNoticeVisible(allowRegistration) {
  const notice = [...loginPage.matchAll(/<div\b((?:[^"'>]|"[^"]*"|'[^']*')*)>((?:(?!<div\b)[\s\S])*?)<\/div>/g)]
    .find((match) => match[2].includes('th:href="@{/signup}"'));
  assert.ok(notice, "登录页应保留受注册开关控制的注册提示");
  const condition = attribute(notice[1], "th:if");
  return condition ? evaluateAttribute(condition, { globalInfo: { allowRegistration } }) : true;
}

test("密码显隐首次点击显示明文，再次点击隐藏，图标状态保持一致", () => {
  const control = passwordControl();
  assert.deepEqual(control.state(), ["password", "block", "none"]);
  control.click();
  assert.deepEqual(control.state(), ["text", "none", "block"]);
  control.click();
  assert.deepEqual(control.state(), ["password", "block", "none"]);
});

test("动态插画跟随 Halo 密码显隐，每次点击仅切换一次并在隐藏后恢复输入状态", () => {
  const control = passwordControl({ illustration: true });
  control.focus();
  assert.equal(control.scene(), "art-scene state-typing");
  control.click();
  assert.deepEqual(control.state(), ["text", "none", "block"]);
  assert.equal(control.scene(), "art-scene state-peeking");
  control.click();
  assert.deepEqual(control.state(), ["password", "block", "none"]);
  assert.equal(control.scene(), "art-scene state-typing");
});

test("动态插画在输入框未聚焦时隐藏密码恢复空闲状态", () => {
  const control = passwordControl({ illustration: true });
  control.click();
  assert.equal(control.scene(), "art-scene state-peeking");
  control.click();
  assert.deepEqual(control.state(), ["password", "block", "none"]);
  assert.equal(control.scene(), "art-scene state-idle");
});

test("动态插画保留文本和密码输入框的聚焦与失焦反馈", () => {
  const control = passwordControl({ illustration: true });
  for (const kind of ["text", "password"]) {
    control.focus(kind);
    assert.equal(control.scene(), "art-scene state-typing");
    control.blur();
    assert.equal(control.scene(), "art-scene state-idle");
  }
});

test("明文密码重新聚焦仍保持偷看状态，隐藏后重新聚焦恢复输入状态", () => {
  const control = passwordControl({ illustration: true });
  control.focus();
  control.click();
  control.blur();
  assert.equal(control.scene(), "art-scene state-idle");
  control.focus("text");
  assert.equal(control.scene(), "art-scene state-typing");
  control.blur();
  control.focus();
  assert.deepEqual(control.state(), ["text", "none", "block"]);
  assert.equal(control.scene(), "art-scene state-peeking");
  control.click();
  control.blur();
  control.focus();
  assert.deepEqual(control.state(), ["password", "block", "none"]);
  assert.equal(control.scene(), "art-scene state-typing");
});

test("动态插画错误态优先于聚焦、失焦与密码显隐，结束后恢复空闲", () => {
  const control = passwordControl({ illustration: true, error: true });
  assert.equal(control.scene(), "art-scene state-error");
  control.focus();
  control.click();
  control.blur();
  control.focus();
  assert.deepEqual(control.state(), ["text", "none", "block"]);
  assert.equal(control.scene(), "art-scene state-error");
  control.click();
  control.blur();
  assert.equal(control.scene(), "art-scene state-error");
  control.flushTimers(2500);
  assert.equal(control.scene(), "art-scene state-idle");
});

test("登录页仅在允许注册时展示注册入口", () => {
  assert.equal(signupNoticeVisible(false), false);
  assert.equal(signupNoticeVisible(true), true);
});

test("核心认证脚本使用 Halo 版本更新缓存键", () => {
  assert.match(common, /<script\b[^>]*th:src="\|\/js\/main\.js\?v=\$\{site\.version\}\|"/);
  assert.doesNotMatch(common, /\ssrc="\/js\/main\.js"/);
});

test("Halo 2.27 使用随核心提供的新 ALTCHA 组件，工具脚本随升级刷新", () => {
  for (const version of ["2.27.0", "2.27.1"]) {
    assert.deepEqual(altchaSources(version), [
      "/webjars/altcha/3.2.3/dist/main/altcha.i18n.min.js",
      `/js/altcha-utils.js?v=${version}`,
    ]);
  }
});

test("Halo 2.26 保留官方旧 ALTCHA 组件与计算库，不加载新版资源", () => {
  for (const version of ["2.26.0", "2.26.1"]) {
    assert.deepEqual(altchaSources(version), [
      "/webjars/altcha/2.3.0/dist/altcha.i18n.js",
      `/js/altcha-lib.iife.js?v=${version}`,
      `/js/altcha-utils.js?v=${version}`,
    ]);
  }
});

test("OAuth 失败重定向即使参数为空也显示可重试的中文提示", () => {
  const message = oauthFailureAlert("?oauth2_error");
  assert.match(message, /登录.*失败/);
  assert.match(message, /重试/);
  assert.equal(oauthFailureAlert("?oauth2_error=access_denied"), message);
  assert.equal(oauthFailureAlert(""), "");
  assert.equal(oauthFailureAlert("?oauth2_bind"), "");
});

test("服务端默认选中或浏览器恢复的保持登录状态随首次提交发送", () => {
  const { forms } = socialLogin(true);
  for (const form of forms) {
    assert.equal(submit(form).searchParams.get("remember-me"), "true");
  }
});

test("未选中保持登录时仍发送 false，并保留其他查询参数与提供方路由", () => {
  const { forms } = socialLogin(false);
  forms.forEach((form, index) => {
    const url = submit(form);
    assert.equal(url.searchParams.get("remember-me"), "false");
    assert.equal(url.searchParams.get("source"), "login");
    assert.equal(url.pathname, `/login/social/provider-${index}`);
  });
});

test("每次提交读取最新状态，不依赖 change 事件", () => {
  const { checkbox, forms } = socialLogin(false);
  checkbox.checked = true;
  assert.equal(submit(forms[0]).searchParams.get("remember-me"), "true");
  checkbox.checked = false;
  assert.equal(submit(forms[0]).searchParams.get("remember-me"), "false");
});

test("不支持保持登录的提供方保持默认值", () => {
  const { forms } = socialLogin(null);
  assert.equal(submit(forms[0]).searchParams.get("remember-me"), "false");
});

test("未配置社交登录提供方时可以初始化", () => {
  assert.equal(socialLogin(true, 0).forms.length, 0);
});

test("核心登录错误都有可见提示，包括 OAuth 过期和 Halo 2.27 身份切换失败", () => {
  for (const error of [
    "invalid-credential",
    "rate-limit-exceeded",
    "account-disabled",
    "oauth2-flow-expired",
    "impersonate",
  ]) {
    assert.match(login, new RegExp(`th:if="\\$\\{error == '${error}'\\}"[^>]*>[^<\\s][^<]*<`));
  }
});

test("认证方式入口保留 Passkey 2.0 选择器和 Halo 预览链接", () => {
  const providers = common.slice(common.indexOf('th:fragment="formAuthProviders"'));
  assert.match(providers, /class="auth-provider-grid pill-items"/);
  assert.ok(providers.includes('th:href="@{/login(method=${provider.metadata.name})}"'));
});

test("主题页面链接交给 Halo LinkBuilder，以保留请求级预览身份", () => {
  const templateRoot = new URL("../templates/", import.meta.url);
  const pageRoutes = new Set([
    "/",
    "/about",
    "/archives",
    "/categories",
    "/tags",
    "/moments",
    "/links",
    "/photos",
    "/docs",
    "/bangumis",
    "/steam",
    "/login",
    "/logout",
    "/signup",
  ]);
  const failures = [];
  for (const file of readdirSync(templateRoot, { recursive: true })) {
    if (!file.endsWith(".html") || file.startsWith("assets/")) continue;
    const html = readFileSync(new URL(file, templateRoot), "utf8");
    for (const match of html.matchAll(/<a\b(?:[^"'>]|"[^"]*"|'[^']*')*>/g)) {
      const anchor = match[0];
      const plainHref = anchor.match(/\shref="([^"]*)"/)?.[1];
      const dynamicHref = anchor.match(/\sth:href="([^"]*)"/)?.[1];
      const isPageModel =
        dynamicHref &&
        /^\$\{/.test(dynamicHref) &&
        /(?:\.status\.permalink|\.prevUrl|\.nextUrl|photoUrl\.(?:list|detail)\(|^\$\{backUrl \?: '\/photos'|^\$\{language\.link\}|^\$\{linkNavigation\.(?:previous|next)\.link\}|^\$\{(?:legal\.url|primaryBtnLink|secondaryActionLink|ctaBtnLink)\}|^\$\{secondaryBtnLink\b)/.test(
          dynamicHref,
        );
      if ((pageRoutes.has(plainHref) && !dynamicHref?.startsWith("@{")) || isPageModel) {
        failures.push(`${file}: ${plainHref || dynamicHref}`);
      }
    }
  }
  assert.deepEqual(failures, [], "页面链接必须使用 th:href=@{...}，不能跳回活动主题");
});
