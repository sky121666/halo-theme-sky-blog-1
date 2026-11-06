import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { normalizeHttpUrl } from "../src/apps/links/runtime.js";

const source = fs.readFileSync(new URL("../src/apps/links/runtime.js", import.meta.url), "utf8");
function section(start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

function fixture() {
  class Field {
    value = "";
    attributes = {};
    focused = false;
    constructor(name) { this.name = name; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    focus() { this.focused = true; }
    closest() { return form; }
    matches(selector) { return selector === `[name="${this.name}"]`; }
  }
  const form = {
    elements: Object.fromEntries(
      ["url", "displayName", "description", "logo", "rssUrl"].map((name) => [name, new Field(name)]),
    ),
  };
  const button = Object.assign(new Field("identify"), { disabled: false });
  const status = { hidden: true, textContent: "" };
  const submitStatus = { hidden: false, textContent: "申请内容已生成" };
  const listeners = new Map();
  form.querySelector = () => button;
  const root = {
    querySelector: (selector) =>
      selector === "[data-link-apply-form]" ? form
        : selector === "[data-apply-identify]" ? button
          : selector === "[data-apply-identify-status]" ? status
            : selector === '[data-link-apply-form] [name="url"]' ? form.elements.url
              : selector === "[data-apply-status]" ? submitStatus : null,
    addEventListener: (type, handler) => listeners.set(type, handler),
  };
  const requests = [];
  const lifecycle = new AbortController();
  const state = {};
  const context = {
    root,
    state,
    signal: lifecycle.signal,
    capabilities: { canManage: false },
    normalizeHttpUrl,
    applyFormValues: () =>
      Object.fromEntries(Object.entries(form.elements).map(([name, field]) => [name, field.value])),
    stringValue: (value) => String(value || "").trim(),
    setTimeout,
    clearTimeout,
    AbortController,
    DOMException,
    Element: Field,
    fetchPublicSiteMetadata: (url, signal) =>
      new Promise((resolve, reject) => requests.push({ url, signal, resolve, reject })),
    updateApplyPreview() {},
    renderApplyCapability() {},
    formatMetadataFailure: () => "failure",
  };
  const api = vm.runInNewContext(
    `(function () { "use strict";
      ${section("function timeoutController(", "function metadataValue(")}
      ${section("  function applyStatus(", "  function revealApplyDraft(")}
      ${section('  root.addEventListener(\n    "input"', '  root.addEventListener(\n    "change"')}
      return { identify: identifyApplySite, cancel: cancelApplyIdentification };
    })()`,
    context,
  );
  const reply = {
    title: "Site A",
    description: "Description A",
    logo: "https://a.test/icon.png",
    rssUrl: "https://a.test/rss.xml",
  };
  return {
    form, button, status, submitStatus, state, requests, ...api, lifecycle, reply,
    editUrl(value) {
      form.elements.url.value = value;
      listeners.get("input")({ target: form.elements.url });
    },
  };
}

test("invalid identification is reported beside the URL and clears when the address is edited", async () => {
  const f = fixture();
  await f.identify();
  assert.equal(f.requests.length, 0);
  assert.equal(f.status.hidden, false);
  assert.match(f.status.textContent, /HTTP/);
  assert.equal(f.form.elements.url.focused, true);
  assert.equal(f.form.elements.url.attributes["aria-invalid"], "true");
  f.editUrl("https://a.test/");
  assert.equal(f.status.hidden, true);
  assert.equal(f.status.textContent, "");
  assert.equal(f.form.elements.url.attributes["aria-invalid"], undefined);
  assert.equal(f.submitStatus.textContent, "申请内容已生成");
  assert.equal(f.submitStatus.hidden, false);
});

test("identification loading and success stay local without replacing submission feedback", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test/";
  const pending = f.identify();
  assert.match(f.status.textContent, /正在识别/);
  assert.equal(f.button.attributes["aria-busy"], "true");
  assert.equal(f.button.disabled, true);
  f.requests[0].resolve(f.reply);
  await pending;
  assert.match(f.status.textContent, /识别完成/);
  assert.equal(f.button.attributes["aria-busy"], "false");
  assert.equal(f.button.disabled, false);
  assert.equal(f.submitStatus.textContent, "申请内容已生成");
});

test("a transport error does not mark a valid address invalid and clears on editing", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test/";
  const pending = f.identify();
  f.requests[0].reject(new Error("offline"));
  await pending;
  assert.match(f.status.textContent, /重试或手动填写/);
  assert.equal(f.form.elements.url.attributes["aria-invalid"], undefined);
  assert.equal(f.button.attributes["aria-busy"], "false");
  f.editUrl("https://b.test/");
  assert.equal(f.status.hidden, true);
});

test("editing an address cancels its identification and discards late feedback", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test/";
  const pending = f.identify();
  f.editUrl("https://b.test/");
  assert.equal(f.requests[0].signal.aborted, true);
  assert.equal(f.status.hidden, true);
  assert.equal(f.button.disabled, false);
  assert.equal(f.button.attributes["aria-busy"], "false");
  f.requests[0].resolve(f.reply);
  await pending;
  assert.equal(f.form.elements.displayName.value, "");
  assert.equal(f.status.hidden, true);
  assert.equal(f.submitStatus.textContent, "申请内容已生成");
});

test("site metadata does not fill a form whose URL changed during identification", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test/";
  const pending = f.identify();
  f.form.elements.url.value = "https://b.test/";
  f.requests[0].resolve(f.reply);
  await pending;
  assert.equal(f.form.elements.displayName.value, "");
  assert.equal(f.form.elements.description.value, "");
  assert.equal(f.status.hidden, true);
});

test("an identification response cannot refill a reset form", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test/";
  const pending = f.identify();
  f.form.elements.url.value = "";
  f.requests[0].resolve(f.reply);
  await pending;
  assert.equal(f.form.elements.displayName.value, "");
});

test("metadata preserves user edits and accepts an equivalent normalized URL", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test";
  const pending = f.identify();
  f.form.elements.url.value = "https://a.test/";
  f.form.elements.displayName.value = "My edited title";
  f.requests[0].resolve(f.reply);
  await pending;
  assert.equal(f.form.elements.displayName.value, "My edited title");
  assert.equal(f.form.elements.description.value, "Description A");
});

test("a stale identification completion cannot unlock a newer pending request", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test/";
  const first = f.identify();
  f.form.elements.url.value = "https://b.test/";
  const second = f.identify();
  f.requests[0].resolve(f.reply);
  await first;
  assert.equal(f.button.disabled, true);
  assert.equal(f.button.attributes["aria-busy"], "true");
  assert.match(f.status.textContent, /正在识别/);
  f.requests[1].resolve({ ...f.reply, title: "Site B" });
  await second;
  assert.equal(f.form.elements.displayName.value, "Site B");
  assert.equal(f.button.disabled, false);
});

test("leaving the page discards a metadata response even if transport completes late", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test/";
  const pending = f.identify();
  f.lifecycle.abort();
  f.requests[0].resolve(f.reply);
  await pending;
  assert.equal(f.form.elements.displayName.value, "");
});

test("a timed out identification reports recovery without mutating a DOMException", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test/";
  const pending = f.identify();
  f.state.identifyController.abort(new DOMException("Timed out", "TimeoutError"));
  f.requests[0].reject(new DOMException("Aborted", "AbortError"));
  await pending;
  assert.equal(f.status.hidden, false);
  assert.match(f.status.textContent, /手动填写/);
  assert.equal(f.button.disabled, false);
});

test("changing URL while capabilities load never sends the stale metadata request", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test/";
  let ready;
  f.state.capabilityPromise = new Promise((resolve) => {
    ready = resolve;
  });
  const pending = f.identify();
  f.form.elements.url.value = "https://b.test/";
  ready();
  await pending;
  assert.equal(f.requests.length, 0);
  assert.equal(f.button.disabled, false);
});

test("a failed capability lookup still permits public identification", async () => {
  const f = fixture();
  f.form.elements.url.value = "https://a.test/";
  f.state.capabilityPromise = Promise.reject(new Error("offline"));
  const pending = f.identify();
  await new Promise(setImmediate);
  assert.equal(f.requests.length, 1);
  f.requests[0].resolve(f.reply);
  await pending;
  assert.equal(f.form.elements.displayName.value, "Site A");
});

function submitFixture() {
  const lifecycle = new AbortController();
  const state = { capabilityPromise: Promise.reject(new Error("lookup unavailable")) };
  const drafts = [];
  const submit = vm.runInNewContext(`(function () { ${section("  async function submitApplyForm(", "  function plainClick(")} return submitApplyForm; })()`, {
    state, signal: lifecycle.signal, capabilities: { canManage: false },
    applyFormValues: () => ({ type: "add", url: "https://example.test" }),
    validateApplyForm: () => null, canSubmitGuestApplication: () => false,
    revealApplyDraft: values => drafts.push(values),
  });
  return { submit, drafts, lifecycle };
}

test("首次申请在权限查询失败时仍完成已有 Markdown 降级", async () => {
  const f = submitFixture();
  await f.submit({});
  assert.equal(f.drafts.length, 1);
  assert.equal(f.drafts[0].url, "https://example.test");
});

test("权限失败期间离页不会在旧表单生成申请", async () => {
  const f = submitFixture(); const pending = f.submit({}); f.lifecycle.abort();
  await pending; assert.equal(f.drafts.length, 0);
});

function applyPresentation({ canManage = false, applicationEnabled = false, commentsEnabled = true, type = "add" } = {}) {
  const label = { textContent: "" };
  const hint = { textContent: "" };
  const output = { value: "" };
  const panel = { hidden: true };
  const statuses = [];
  const form = {
    querySelector(query) {
      return query === "[data-apply-submit-label]" ? label : query === "[data-apply-action-hint]" ? hint : null;
    },
    querySelectorAll() { return []; },
  };
  const root = {
    dataset: { linkApplicationEnabled: String(applicationEnabled), linksCommentsEnabled: String(commentsEnabled) },
    querySelector(query) {
      return query === "[data-link-apply-form]" ? form
        : query === "[data-apply-markdown]" ? output : query === "[data-apply-output]" ? panel : null;
    },
  };
  const api = vm.runInNewContext(`(function () {
    ${section("  function renderApplyCapability()", "  async function refreshApplyCaptcha()")}
    ${section("  function revealApplyDraft(", "  async function submitApplyForm(")}
    return { renderApplyCapability, revealApplyDraft };
  })()`, {
    root, state: { route: {}, captchaAttempted: true }, capabilities: { status: "ready", canManage },
    FormData: class { get() { return type; } },
    buildApplyMarkdown: () => "- 网站名称：Example",
    applyStatus: message => statuses.push(message),
  });
  api.renderApplyCapability();
  return { ...api, label, hint, output, panel, statuses };
}

test("application presentation distinguishes immediate creation, review, and a draft without changing capabilities", () => {
  const admin = applyPresentation({ canManage: true });
  assert.match(admin.label.textContent, /添加/);
  assert.match(admin.hint.textContent, /无需审核/);
  const guest = applyPresentation({ applicationEnabled: true });
  assert.match(guest.label.textContent, /提交/);
  assert.match(guest.hint.textContent, /审核/);
  const draft = applyPresentation({ type: "update", applicationEnabled: true });
  assert.match(draft.label.textContent, /生成/);
  assert.match(draft.hint.textContent, /留言板/);
  draft.revealApplyDraft({});
  assert.equal(draft.panel.hidden, false);
  assert.ok(draft.output.value);
  assert.doesNotMatch(draft.statuses.at(-1), /已提交|提交成功|Markdown/);
});

test("closed comments keep the draft copyable without promising a working comment submission", () => {
  const f = applyPresentation({ commentsEnabled: false });
  assert.match(f.label.textContent, /生成/);
  assert.match(f.hint.textContent, /留言已关闭/);
  assert.doesNotMatch(f.hint.textContent, /留言板提交/);
  f.revealApplyDraft({});
  assert.equal(f.panel.hidden, false);
  assert.ok(f.output.value);
  assert.match(f.statuses.at(-1), /复制保存/);
  assert.doesNotMatch(f.statuses.at(-1), /已提交|留言板提交/);
});
