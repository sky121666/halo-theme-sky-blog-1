#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const modalSource = fs.readFileSync(new URL('src/common/js/modal-focus.js', root), 'utf8').replace('export function', 'function');
const momentSource = fs.readFileSync(new URL('src/pages/moments/moment-publish.js', root), 'utf8')
  .replace(/^import .*;\n/gm, '');
const momentsPageSource = fs.readFileSync(new URL('src/pages/moments/moments.js', root), 'utf8')
  .replace(/^import .*;\n/gm, '');
const postSource = fs.readFileSync(new URL('src/pages/post/post.js', root), 'utf8');
const momentTemplate = fs.readFileSync(new URL('templates/modules/moments/content.html', root), 'utf8');

function headingCopyFixture() {
  const elements = [], requests = [], timers = new Map(); let nextTimer = 0;
  class Node extends EventTarget {
    constructor() { super(); this.style = {}; this.attributes = {}; this.isConnected = true; this.hidden = false; this.textContent = ''; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    appendChild(node) { this.anchor = node; }
    after(node) { this.feedback = node; }
    remove() { this.isConnected = false; }
  }
  const heading = new Node(); heading.setAttribute('id', 'chapter');
  const article = { querySelectorAll: () => [heading] };
  const start = postSource.indexOf('        initHeadingAnchors() {');
  const end = postSource.indexOf('        initTOC() {', start);
  assert.ok(start > 0 && end > start);
  const manager = vm.runInNewContext(`({${postSource.slice(start, end)}})`, {
    document: { getElementById: () => article, createElement() { const node = new Node(); elements.push(node); return node; } },
    window: { location: new URL('https://halo.test/archives/demo') },
    navigator: { clipboard: { writeText: () => { const request = deferred(); requests.push(request); return request.promise; } } },
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const controller = new AbortController(); manager._signal = controller.signal; manager.initHeadingAnchors();
  return { heading, requests, elements, timers, controller, click: () => heading.anchor.dispatchEvent(new Event('click', { cancelable: true })), settle: () => new Promise(setImmediate) };
}

test('heading clipboard refusal gives visible recovery feedback and a successful retry clears it', async () => {
  const f = headingCopyFixture();
  assert.equal(f.heading.feedback, undefined, 'normal headings must retain their adjacent-sibling layout');
  f.click(); f.requests[0].reject(new Error('denied')); await f.settle();
  const feedback = f.elements.find(node => node.getAttribute('role') === 'status');
  assert.ok(feedback && !feedback.hidden && feedback.textContent, 'clipboard failure must be visible and announced');
  assert.match(f.heading.anchor.getAttribute('aria-label'), /重试/);
  f.click(); f.requests[1].resolve(); await f.settle();
  assert.equal(feedback.hidden, true);
  assert.match(f.heading.anchor.getAttribute('aria-label'), /已复制/);
});

test('heading copy ignores stale refusal after a newer success', async () => {
  const f = headingCopyFixture(); f.click(); f.click();
  f.requests[1].resolve(); await f.settle();
  const label = f.heading.anchor.getAttribute('aria-label');
  f.requests[0].reject(new Error('late refusal')); await f.settle();
  assert.match(label, /已复制/);
  assert.equal(f.heading.anchor.getAttribute('aria-label'), label);
});

test('leaving an article cancels heading-copy feedback and timers', async () => {
  const f = headingCopyFixture(); f.click(); const anchor = f.heading.anchor;
  f.controller.abort(); f.requests[0].resolve(); await f.settle();
  assert.equal(f.timers.size, 0, 'late results cannot schedule detached feedback');
  assert.equal(anchor.isConnected, false);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function classes() {
  const state = new Set();
  return {
    add: (...names) => names.forEach((name) => state.add(name)),
    remove: (...names) => names.forEach((name) => state.delete(name)),
    contains: (name) => state.has(name),
    toggle(name, force = !state.has(name)) {
      if (force) state.add(name);
      else state.delete(name);
    },
  };
}

class Element extends EventTarget {
  constructor() {
    super();
    this.dataset = {};
    this.style = {};
    this.classList = classes();
    this.disabled = false;
    this.value = '';
    this.innerHTML = '';
    this.textContent = '';
  }

  focus() {}
  contains() { return false; }
  querySelectorAll() { return []; }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  appendChild(child) { return child; }
  insertAdjacentElement(_position, element) { this.actionStatus = element; }
  remove() {}
}

function publishedMoment({ approved = true, visible = 'PUBLIC' } = {}) {
  return {
    apiVersion: 'moment.halo.run/v1alpha1', kind: 'Moment',
    metadata: { name: 'server-moment', creationTimestamp: '2026-10-28T08:00:00Z' },
    spec: {
      owner: 'alice', approved, visible, tags: [],
      releaseTime: '2026-10-28T08:00:00Z',
      content: { raw: 'first draft', html: 'first draft' },
      ...(approved ? { approvedTime: '2026-10-28T08:00:00Z' } : {}),
    },
  };
}

async function momentFixture({
  upvotedNames = [], uiPermissions = ['uc:plugin:moments:publish'], permissionStatus = 200,
  permissionResponses = [],
  timeoutFactory = (delay) => AbortSignal.timeout(delay),
} = {}) {
  const ids = [
    'moment-publish-modal', 'moment-publish-form', 'moment-content', 'moment-publish-btn',
    'moment-char-count', 'moment-tags', 'moment-tags-input-row', 'moment-tags-display',
    'moment-tags-list', 'moment-media-preview', 'moment-media-list', 'moments-list',
    'moments-refresh-status', 'moments-refresh-retry', 'moments-publish-status', 'moment-open-btn',
    'moment-permission-status', 'moment-permission-message', 'moment-permission-retry',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  elements['moment-publish-modal'].dataset.ownerName = 'alice';
  elements['moment-content'].value = 'first draft';
  elements['moment-publish-form'].requestSubmit = () => {
    elements['moment-publish-form'].dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const requests = [];
  const permissionRequests = [];
  const timers = new Map();
  const alerts = [];
  let reloadCount = 0;
  elements['moments-refresh-status'].classList.add('hidden');
  elements['moments-publish-status'].classList.add('hidden');
  elements['moment-permission-status'].classList.add('hidden');
  elements['moment-permission-retry'].classList.add('hidden');
  elements['moment-open-btn'].classList.add('hidden');
  elements['moment-open-btn'].disabled = true;
  let timerId = 0;
  const lifecycles = [];
  let refreshedMarkup = '';
  let refreshedButtons = [];
  let momentButtons = [];
  let listMarkup = '';
  let savedUpvotes = JSON.stringify(upvotedNames);
  Object.defineProperty(elements['moments-list'], 'innerHTML', {
    get: () => listMarkup,
    set(value) {
      listMarkup = value;
      momentButtons = refreshedButtons;
    },
  });
  elements['moments-list'].querySelectorAll = () => momentButtons;
  const window = {
    location: { href: 'https://example.invalid/moments', reload() { reloadCount++; } },
    setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  };
  const document = Object.assign(new EventTarget(), {
    body: { style: { overflow: "" } },
    getElementById: (id) => elements[id] || null,
    querySelector: () => null,
    querySelectorAll: (selector) => selector === '[data-moment-name]' ? momentButtons
      : selector === '[data-moment-publish-trigger]' ? [elements['moment-open-btn']] : [],
    createElement: () => {
      const element = new Element();
      Object.defineProperty(element, 'innerHTML', {
        get: () => element.textContent.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
        set() {},
      });
      return element;
    },
  });
  const context = vm.createContext({
    window, document, Event, AbortController,
    AbortSignal: { any: (signals) => AbortSignal.any(signals), timeout: timeoutFactory },
    DOMException, File, FormData,
    alert: (message) => alerts.push(message),
    skyDebug: { error() {}, warn() {}, event() {} },
    localStorage: {
      getItem: () => savedUpvotes,
      setItem: (_key, value) => { savedUpvotes = value; },
    },
    registerPageLifecycle: (init) => { lifecycles.push(init); },
    notifySwupPageReady() {},
    fetch: (url, options) => {
      if (url === '/apis/api.console.halo.run/v1alpha1/users/-/permissions') {
        permissionRequests.push({ url, options });
        if (permissionResponses.length) {
          return Promise.resolve(permissionResponses.shift()).then((response) => {
            if (response instanceof Error) throw response;
            return response;
          });
        }
        return Promise.resolve({
          ok: permissionStatus === 200, status: permissionStatus,
          json: async () => ({ roles: [], permissions: [], uiPermissions }),
        });
      }
      const result = deferred();
      requests.push({ url, options, ...result });
      return result.promise.then((response) => {
        if (options?.method === 'POST' && url.endsWith('/moments') && response.ok && !response.json) {
          return { ...response, json: async () => publishedMoment() };
        }
        return response;
      });
    },
    DOMParser: class {
      parseFromString() {
        return { getElementById: (id) => id === 'moments-list' ? { innerHTML: refreshedMarkup } : null };
      }
    },
  });
  vm.runInContext(modalSource, context);
  vm.runInContext(momentSource, context, { filename: 'moment-publish.js' });
  vm.runInContext(momentsPageSource, context, { filename: 'moments.js' });
  const cleanups = lifecycles.map((init) => init()).filter(Boolean);
  await settle();
  const cleanup = () => cleanups.toReversed().forEach((dispose) => dispose());
  function submit() {
    elements['moment-publish-form'].dispatchEvent(new Event('submit', { cancelable: true }));
  }
  function shortcut() {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { ctrlKey: true, key: 'Enter' });
    elements['moment-content'].dispatchEvent(event);
  }
  return {
    elements, requests, permissionRequests, timers, alerts, cleanup, submit, shortcut, window,
    reloadCount: () => reloadCount,
    savedUpvotes: () => JSON.parse(savedUpvotes),
    setMomentButtons: (buttons) => { momentButtons = buttons; },
    setRefreshedMarkup: (value, buttons = []) => {
      refreshedMarkup = value;
      refreshedButtons = buttons;
    },
  };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

function mediaInput(count, offset = 0) {
  return { files: Array.from({ length: count }, (_,index) =>
    new File(['image'], `image-${index + offset}.png`, { type: 'image/png' })), value: 'selected' };
}

async function uploadMedia(fixture, count) {
  const start = fixture.requests.length;
  const upload = fixture.window.handleFileSelect({ target: mediaInput(count, start) });
  for (let index = 0; index < count; index++) {
    await settle();
    fixture.requests[start + index].resolve({ ok: true,
      json: async () => ({ status: { permalink: `/media-${start + index}.png` } }) });
  }
  await upload;
}

test('more than nine selected attachments are rejected before uploading', async () => {
  const f = await momentFixture();
  const input = mediaInput(10);
  const pending = f.window.handleFileSelect({ target: input });
  try {
    assert.equal(f.requests.length, 0);
    await pending;
    assert.match(f.alerts[0], /9/);
    assert.equal(input.value, '');
    assert.equal(f.elements['moment-publish-btn'].disabled, false);
  } finally { f.cleanup(); }
});

test('the nine attachment limit includes earlier batches without dropping them', async () => {
  const f = await momentFixture();
  await uploadMedia(f, 8);
  const pending = f.window.handleFileSelect({ target: mediaInput(2, 8) });
  try {
    assert.equal(f.requests.length, 8, 'over-limit batch must not start uploads');
    await pending;
    await uploadMedia(f, 1);
    f.submit();
    assert.equal(JSON.parse(f.requests[9].options.body).spec.content.medium.length, 9);
    f.requests[9].resolve({ ok: true });
    await settle();
  } finally { f.cleanup(); }
});

test('canceling upload immediately releases the next draft and isolates late results', async () => {
  const f = await momentFixture();
  f.window.openMomentModal();
  const oldUpload = f.window.handleFileSelect({ target: mediaInput(1) });
  f.window.closeMomentModal();
  f.window.openMomentModal();
  try {
    assert.equal(f.requests[0].options.signal.aborted, true);
    assert.equal(f.elements['moment-publish-btn'].disabled, false);
    const nextUpload = f.window.handleFileSelect({ target: mediaInput(1, 1) });
    // A mock that ignores abort exercises the stale-success guard as well.
    f.requests[0].resolve({ ok: true, json: async () => ({ status: { permalink: '/old.png' } }) });
    await oldUpload;
    assert.equal(f.elements['moment-publish-btn'].disabled, true, 'old finally cannot unlock new upload');
    f.requests[1].resolve({ ok: true, json: async () => ({ status: { permalink: '/new.png' } }) });
    await nextUpload;
    f.submit();
    assert.deepEqual(JSON.parse(f.requests[2].options.body).spec.content.medium.map(m => m.url), ['/new.png']);
    f.requests[2].resolve({ ok: true });
    await settle();
    assert.equal(f.alerts.length, 0);
  } finally { f.cleanup(); }
});

test('a missing official upload permalink fails without polling an obsolete API', async () => {
  const f = await momentFixture();
  const upload = f.window.handleFileSelect({ target: mediaInput(1) });
  f.requests[0].resolve({ ok: true, json: async () => ({ metadata: { name: 'missing-url' } }) });
  await settle();
  try {
    assert.equal(f.timers.size, 0, 'no legacy attachment polling');
    await upload;
    assert.equal(f.requests.length, 1);
    assert.match(f.alerts[0], /文件地址/);
    assert.equal(f.elements['moment-publish-btn'].disabled, false);
  } finally { f.cleanup(); }
});

test('upload timeout restores the draft and permits a retry', async () => {
  const timeouts = [];
  const f = await momentFixture({ timeoutFactory(delay) {
    const controller = new AbortController();
    timeouts.push({ delay, controller });
    return controller.signal;
  } });
  const upload = f.window.handleFileSelect({ target: mediaInput(1) });
  const timeout = timeouts.at(-1);
  assert.ok(timeout.delay > 0 && timeout.delay <= 300000);
  timeout.controller.abort(new DOMException('Timed out', 'TimeoutError'));
  assert.equal(f.requests[0].options.signal.aborted, true);
  f.requests[0].reject(f.requests[0].options.signal.reason);
  await upload;
  assert.match(f.alerts[0], /上传超时/);
  assert.equal(f.elements['moment-publish-btn'].disabled, false);
  assert.equal(f.elements['moment-content'].value, 'first draft');
  await uploadMedia(f, 1);
  f.cleanup();
});

test('canceling an upload allows text publication before the old request finishes', async () => {
  const f = await momentFixture();
  f.window.openMomentModal();
  const upload = f.window.handleFileSelect({ target: mediaInput(1) });
  f.window.closeMomentModal();
  f.window.openMomentModal();
  f.submit();
  assert.equal(f.requests.length, 2);
  assert.equal(JSON.parse(f.requests[1].options.body).spec.content.medium, undefined);
  f.requests[0].reject(new Error('late failure'));
  await upload;
  assert.equal(f.elements['moment-publish-btn'].disabled, true);
  assert.equal(f.alerts.length, 0);
  f.requests[1].resolve({ ok: true });
  await settle();
  f.cleanup();
});

test('leaving the moments page aborts upload without showing a stale alert', async () => {
  const f = await momentFixture();
  const upload = f.window.handleFileSelect({ target: mediaInput(1) });
  f.cleanup();
  assert.equal(f.requests[0].options.signal.aborted, true);
  f.requests[0].reject(f.requests[0].options.signal.reason);
  await upload;
  assert.equal(f.alerts.length, 0);
});

function momentButton(name, value) {
  const button = new Element();
  const icon = new Element();
  const count = new Element();
  icon.className = 'icon-[heroicons--heart] w-5 h-5';
  count.textContent = String(value);
  button.dataset.momentName = name;
  button.dataset.upvoteCount = String(value);
  button.querySelector = (selector) => selector === '.upvote-count' ? count : icon;
  return { button, icon, count };
}

test('one-way moment like keeps its icon without advertising a toggle action', async () => {
  const f = await momentFixture();
  const { button, icon, count } = momentButton('accessible', 7);
  f.setMomentButtons([button]);
  const pending = f.window.handleMomentUpvote(button);
  try {
    assert.equal(button['aria-pressed'], undefined);
    assert.equal(button['aria-disabled'], 'true');
    assert.match(button['aria-label'], /点赞瞬间.*7/);
    assert.match(icon.className, /heart/);
    f.requests[0].resolve({ ok: true });
    await pending;
    assert.equal(button['aria-pressed'], undefined);
    assert.equal(button['aria-disabled'], 'true');
    assert.match(button['aria-label'], /已点赞.*8/);
    assert.equal(count.textContent, '8');
    assert.match(icon.className, /heart-solid/);
    await f.window.handleMomentUpvote(button);
    assert.equal(f.requests.length, 1, 'a completed like cannot send another request');
  } finally { f.cleanup(); }
});

async function refreshDuringMomentUpvote(serverCount = 7) {
  const fixture = await momentFixture();
  const origin = momentButton('pending-moment', 7);
  const current = momentButton('pending-moment', serverCount);
  fixture.setMomentButtons([origin.button]);
  const pending = fixture.window.handleMomentUpvote(origin.button);
  fixture.submit();
  fixture.requests[1].resolve({ ok: true });
  await settle();
  fixture.setRefreshedMarkup('<article>refreshed moment</article>', [current.button]);
  const running = [...fixture.timers.values()][0]();
  fixture.requests[2].resolve({ ok: true, text: async () => 'refreshed HTML' });
  await running;
  return { fixture, origin, current, pending };
}

function postFixture({ stored = '[]', readThrows = false, writeThrows = false } = {}) {
  const start = postSource.indexOf('function _registerAlpineComponents() {');
  const end = postSource.indexOf('  registerAlpinePageComponents(_registerAlpineComponents);', start);
  assert.ok(start >= 0 && end > start, 'production Alpine registration must exist');
  const factories = new Map();
  const requests = [];
  let saved = stored;
  const context = vm.createContext({
    Alpine: { data: (name, factory) => factories.set(name, factory) },
    AbortController,
    localStorage: {
      getItem() { if (readThrows) throw new Error('storage denied'); return saved; },
      setItem(_key, value) { if (writeThrows) throw new Error('storage denied'); saved = value; },
    },
    fetch: (url, options) => {
      const result = deferred();
      requests.push({ url, options, ...result });
      return result.promise;
    },
  });
  vm.runInContext(`${postSource.slice(start, end)}\n_registerAlpineComponents();`, context);
  const like = factories.get('postLike')();
  like.$el = { closest: () => ({ dataset: { postName: 'article-a', upvoteCount: '3' } }) };
  return { like, requests, saved: () => saved };
}

test('moment publication uses the UC boundary without claiming owner or approval', async () => {
  const fixture = await momentFixture();
  fixture.submit();
  const request = fixture.requests[0];
  assert.equal(request.url, '/apis/uc.api.moment.halo.run/v1alpha1/moments');
  assert.equal(request.options.method, 'POST');
  const sent = JSON.parse(request.options.body);
  assert.equal(sent.spec.content.raw, 'first draft');
  assert.equal(sent.spec.visible, 'PUBLIC');
  assert.equal(Object.hasOwn(sent.spec, 'owner'), false, 'the server owns user identity');
  assert.equal(Object.hasOwn(sent.spec, 'approved'), false, 'the server owns approval');
  assert.equal(Object.hasOwn(sent.spec, 'approvedTime'), false, 'the server owns approval time');
  request.resolve({ ok: true });
  await settle();
  fixture.cleanup();
});

for (const uiPermissions of [[], ['plugin:moments:manage']]) {
  test(`a logged-in user without UC publication permission cannot open or submit: ${uiPermissions.join(',') || 'none'}`, async () => {
    const fixture = await momentFixture({ uiPermissions });
    fixture.window.openMomentModal();
    fixture.submit();
    assert.equal(fixture.permissionRequests.length, 1);
    assert.equal(fixture.elements['moment-open-btn'].classList.contains('hidden'), true);
    assert.notEqual(fixture.elements['moment-publish-modal'].style.display, 'flex');
    assert.equal(fixture.requests.length, 0);
    fixture.cleanup();
  });
}

for (const uiPermissions of [['uc:plugin:moments:publish'], ['*']]) {
  test(`the official UI permission allows opening the publisher: ${uiPermissions[0]}`, async () => {
    const fixture = await momentFixture({ uiPermissions });
    assert.equal(fixture.elements['moment-open-btn'].classList.contains('hidden'), false);
    assert.equal(fixture.elements['moment-open-btn'].disabled, false);
    fixture.window.openMomentModal();
    assert.equal(fixture.elements['moment-publish-modal'].style.display, 'flex');
    fixture.cleanup();
  });
}

test('an unavailable permission response keeps the publication control unavailable', async () => {
  const fixture = await momentFixture({ permissionStatus: 503 });
  fixture.window.openMomentModal();
  fixture.submit();
  assert.equal(fixture.elements['moment-open-btn'].classList.contains('hidden'), true);
  assert.equal(fixture.requests.length, 0);
  fixture.cleanup();
});

test('routine permission checking does not insert a reading-status row', async () => {
  const pending = deferred();
  const f = await momentFixture({ permissionResponses: [pending.promise] });
  assert.equal(f.elements['moment-permission-status'].classList.contains('hidden'), true);
  assert.equal(f.elements['moment-open-btn'].disabled, true);
  pending.resolve(new Response(JSON.stringify({ uiPermissions: ['uc:plugin:moments:publish'] })));
  await settle();
  assert.equal(f.elements['moment-permission-status'].classList.contains('hidden'), true);
  assert.equal(f.elements['moment-open-btn'].disabled, false);
  f.cleanup();
});

for (const failure of [new Response('', { status: 503 }), new Error('network offline'),
  new DOMException('request timed out', 'TimeoutError'),
  new Response('{}', { headers: { 'Content-Type': 'application/json' } })]) {
  test(`permission failure offers a single retry and never allows submission: ${failure.status || failure.name}`, async () => {
    const retry = deferred();
    const f = await momentFixture({ permissionResponses: [failure, retry.promise] });
    try {
      const status = f.elements['moment-permission-status'];
      const button = f.elements['moment-permission-retry'];
      assert.equal(status.classList.contains('hidden'), false);
      assert.match(f.elements['moment-permission-message'].textContent, /无法确认/);
      assert.equal(button.classList.contains('hidden'), false);
      button.dispatchEvent(new Event('click'));
      button.dispatchEvent(new Event('click'));
      f.submit();
      assert.equal(f.permissionRequests.length, 2);
      assert.equal(f.requests.length, 0);
      assert.equal(button.disabled, true);
      assert.equal(status.classList.contains('hidden'), false, 'an explicit retry keeps its progress visible');
      assert.equal(button.classList.contains('hidden'), false);
      assert.match(f.elements['moment-permission-message'].textContent, /重试/);
      retry.resolve(new Response(JSON.stringify({ uiPermissions: ['uc:plugin:moments:publish'] })));
      await settle();
      assert.equal(status.classList.contains('hidden'), true);
      assert.equal(f.elements['moment-open-btn'].classList.contains('hidden'), false);
      f.window.openMomentModal();
      assert.equal(f.elements['moment-publish-modal'].style.display, 'flex');
    } finally { f.cleanup(); }
  });
}

test('leaving while retrying permission prevents a late publisher from reappearing', async () => {
  const late = deferred();
  const f = await momentFixture({ permissionResponses: [new Response('', { status: 503 }), late.promise] });
  f.elements['moment-permission-retry'].dispatchEvent(new Event('click'));
  assert.equal(f.permissionRequests.length, 2);
  f.cleanup();
  assert.equal(f.permissionRequests[1].options.signal.aborted, true);
  late.resolve(new Response(JSON.stringify({ uiPermissions: ['*'] })));
  await settle();
  assert.equal(f.elements['moment-open-btn'].classList.contains('hidden'), true);
});

for (const permissionStatus of [401, 403]) {
  test(`denied permission response ${permissionStatus} does not offer a network retry`, async () => {
    const f = await momentFixture({ permissionStatus });
    assert.equal(f.elements['moment-permission-status'].classList.contains('hidden'), true);
    assert.equal(f.elements['moment-open-btn'].classList.contains('hidden'), true);
    f.submit();
    assert.equal(f.requests.length, 0);
    f.cleanup();
  });
}

test('a pending-approval response confirms submission without refreshing the public list', async () => {
  const fixture = await momentFixture();
  fixture.window.openMomentModal();
  fixture.submit();
  fixture.requests[0].resolve({ ok: true, json: async () => publishedMoment({ approved: false }) });
  await settle();
  const status = fixture.elements['moments-publish-status'];
  assert.match(status.textContent, /已提交.*待审核/);
  assert.equal(status.classList.contains('hidden'), false);
  assert.equal(fixture.elements['moment-content'].value, '');
  assert.equal(fixture.elements['moment-publish-modal'].style.display, 'none');
  assert.equal(fixture.timers.size, 0, 'unapproved content must not enter the public refresh flow');
  assert.equal(fixture.requests.length, 1);
  fixture.cleanup();
});

test('a pending-approval response preserves edits made after submission', async () => {
  const fixture = await momentFixture();
  fixture.window.openMomentModal();
  fixture.submit();
  fixture.elements['moment-content'].value = 'next draft';
  fixture.requests[0].resolve({ ok: true, json: async () => publishedMoment({ approved: false }) });
  await settle();
  assert.equal(fixture.elements['moment-content'].value, 'next draft');
  assert.equal(fixture.elements['moment-publish-modal'].style.display, 'flex');
  assert.match(fixture.alerts[0], /待审核.*保留/);
  assert.equal(fixture.timers.size, 0);
  fixture.cleanup();
});

test('only a server-approved public moment schedules a public refresh', async () => {
  const fixture = await momentFixture();
  fixture.submit();
  fixture.requests[0].resolve({ ok: true, json: async () => publishedMoment() });
  await settle();
  assert.match(fixture.elements['moments-publish-status'].textContent, /已公开发布/);
  assert.equal(fixture.timers.size, 1);
  fixture.cleanup();
});

test('an accepted response with unreadable result avoids claiming approval or inviting a duplicate', async () => {
  const fixture = await momentFixture();
  fixture.submit();
  fixture.requests[0].resolve({ ok: true, json: async () => { throw new Error('invalid JSON'); } });
  await settle();
  assert.match(fixture.elements['moments-publish-status'].textContent, /已提交.*未确认/);
  assert.equal(fixture.alerts.length, 0, 'an accepted submission must not be reported as a failed POST');
  assert.equal(fixture.timers.size, 0);
  fixture.cleanup();
});

test('moment submit and shortcut share one pending request and allow retry after failure', async () => {
  const fixture = await momentFixture();
  fixture.submit();
  fixture.shortcut();
  assert.equal(fixture.requests.length, 1, 'a pending publication must not send another request');
  assert.equal(fixture.elements['moment-publish-btn'].disabled, true);
  assert.equal(JSON.parse(fixture.requests[0].options.body).spec.content.raw, 'first draft');
  fixture.requests[0].resolve({ ok: false, status: 403 });
  await settle();
  assert.equal(fixture.elements['moment-publish-btn'].disabled, false);
  assert.equal(fixture.alerts.length, 1);
  fixture.submit();
  assert.equal(fixture.requests.length, 2, 'failed publication must be retryable');
  fixture.requests[1].resolve({ ok: true });
  await settle();
  assert.equal(fixture.elements['moment-publish-btn'].disabled, false);
  assert.equal(fixture.elements['moment-content'].value, '', 'an unchanged submitted draft is cleared');
  assert.equal(fixture.elements['moment-publish-modal'].style.display, 'none');
  fixture.cleanup();
});

test('a completed old publication does not erase or close a newly opened draft', async () => {
  const fixture = await momentFixture();
  fixture.window.openMomentModal();
  fixture.submit();
  fixture.window.closeMomentModal();
  fixture.window.openMomentModal();
  fixture.elements['moment-content'].value = 'new draft';
  fixture.requests[0].resolve({ ok: true });
  await settle();
  assert.equal(fixture.elements['moment-content'].value, 'new draft');
  assert.equal(fixture.elements['moment-publish-modal'].style.display, 'flex');
  fixture.cleanup();
});

test('an old publication failure remains visible without changing the newly opened draft', async () => {
  const fixture = await momentFixture();
  fixture.window.openMomentModal();
  fixture.submit();
  fixture.window.closeMomentModal();
  fixture.window.openMomentModal();
  fixture.elements['moment-content'].value = 'new draft';
  fixture.elements['moment-tags'].value = 'new-tag';
  fixture.window.addMomentTag();
  fixture.requests[0].resolve({ ok: false, status: 403 });
  await settle();
  assert.equal(fixture.alerts.length, 1, 'a failed earlier request still needs user feedback');
  assert.match(fixture.alerts[0], /发布失败/);
  assert.match(fixture.alerts[0], /之前|上一次/, 'feedback must identify the earlier submission');
  assert.equal(fixture.elements['moment-content'].value, 'new draft');
  assert.equal(fixture.elements['moment-publish-modal'].style.display, 'flex');
  fixture.submit();
  assert.deepEqual(JSON.parse(fixture.requests[1].options.body).spec.tags, ['new-tag']);
  fixture.requests[1].resolve({ ok: true });
  await settle();
  fixture.cleanup();
});

for (const change of [
  {
    name: 'content edits',
    edit: (fixture) => { fixture.elements['moment-content'].value = 'new content'; },
    content: 'new content', tags: ['published-tag'], tagInput: '',
  },
  {
    name: 'an added tag',
    edit: (fixture) => {
      fixture.elements['moment-tags'].value = 'new-tag';
      fixture.window.addMomentTag();
    },
    content: 'first draft', tags: ['published-tag', 'new-tag'], tagInput: '',
  },
  {
    name: 'a removed tag',
    edit: (fixture) => fixture.window.removeMomentTag(0),
    content: 'first draft', tags: [], tagInput: '',
  },
  {
    name: 'unfinished tag input',
    edit: (fixture) => { fixture.elements['moment-tags'].value = 'unfinished'; },
    content: 'first draft', tags: ['published-tag', 'unfinished'], tagInput: 'unfinished',
  },
]) {
  test(`successful publication preserves ${change.name} made while the request is pending`, async () => {
    const fixture = await momentFixture();
    fixture.window.openMomentModal();
    fixture.elements['moment-tags'].value = 'published-tag';
    fixture.window.addMomentTag();
    fixture.submit();
    change.edit(fixture);
    fixture.requests[0].resolve({ ok: true });
    await settle();
    assert.equal(fixture.elements['moment-content'].value, change.content);
    assert.equal(fixture.elements['moment-tags'].value, change.tagInput);
    assert.equal(fixture.elements['moment-publish-modal'].style.display, 'flex');
    assert.equal(fixture.alerts.length, 1, 'the user needs confirmation that only submitted content was published');
    assert.match(fixture.alerts[0], /已(?:公开)?发布|发布成功/);
    assert.match(fixture.alerts[0], /保留/);
    fixture.submit();
    assert.deepEqual(JSON.parse(fixture.requests[1].options.body).spec.tags, change.tags);
    fixture.requests[1].resolve({ ok: true });
    await settle();
    fixture.cleanup();
  });
}

test('successful publication preserves media removed while the request is pending', async () => {
  const fixture = await momentFixture();
  fixture.window.openMomentModal();
  const input = { files: [new File(['image'], 'photo.png', { type: 'image/png' })], value: 'selected' };
  const upload = fixture.window.handleFileSelect({ target: input });
  fixture.requests[0].resolve({ ok: true, json: async () => ({ status: { permalink: '/photo.png' } }) });
  await upload;
  fixture.submit();
  assert.equal(JSON.parse(fixture.requests[1].options.body).spec.content.medium[0].url, '/photo.png');
  fixture.window.removeMedia(0);
  fixture.requests[1].resolve({ ok: true });
  await settle();
  assert.equal(fixture.elements['moment-content'].value, 'first draft');
  assert.equal(fixture.elements['moment-publish-modal'].style.display, 'flex');
  assert.equal(fixture.alerts.length, 1);
  assert.match(fixture.alerts[0], /保留/);
  fixture.submit();
  assert.equal(JSON.parse(fixture.requests[2].options.body).spec.content.medium, undefined);
  fixture.requests[2].resolve({ ok: true });
  await settle();
  fixture.cleanup();
});

test('publication submits a legal tag that has not been confirmed with Enter', async () => {
  const fixture = await momentFixture();
  fixture.elements['moment-tags'].value = 'existing-tag';
  fixture.window.addMomentTag();
  fixture.elements['moment-tags'].value = ' pending-tag ';
  fixture.submit();
  assert.deepEqual(JSON.parse(fixture.requests[0].options.body).spec.tags, ['existing-tag', 'pending-tag']);
  assert.equal(fixture.elements['moment-tags'].value, '');
  fixture.requests[0].resolve({ ok: true });
  await settle();
  fixture.cleanup();
});

for (const invalid of [
  { name: 'an empty sanitized tag', input: '<>&\'"', tags: [] },
  { name: 'an overlong tag', input: 'x'.repeat(51), tags: [] },
  {
    name: 'an eleventh tag',
    input: 'extra-tag',
    tags: ['tag-0', 'tag-1', 'tag-2', 'tag-3', 'tag-4', 'tag-5', 'tag-6', 'tag-7', 'tag-8', 'tag-9'],
  },
]) {
  test(`publication rejects ${invalid.name} without clearing the unfinished input`, async () => {
    const fixture = await momentFixture();
    fixture.window.openMomentModal();
    for (const tag of invalid.tags) {
      fixture.elements['moment-tags'].value = tag;
      fixture.window.addMomentTag();
    }
    fixture.elements['moment-tags'].value = invalid.input;
    fixture.submit();
    assert.equal(fixture.requests.length, 0, 'a tag validation error must block publication');
    assert.equal(fixture.elements['moment-tags'].value, invalid.input);
    assert.equal(fixture.elements['moment-content'].value, 'first draft');
    assert.equal(fixture.elements['moment-publish-modal'].style.display, 'flex');
    assert.equal(fixture.elements['moment-publish-btn'].disabled, false);
    assert.equal(fixture.alerts.length, 1, 'the validation error must be visible');
    fixture.cleanup();
  });
}

test('an unfinished duplicate tag does not exceed the existing ten-tag limit', async () => {
  const fixture = await momentFixture();
  for (let index = 0; index < 10; index++) {
    fixture.elements['moment-tags'].value = `tag-${index}`;
    fixture.window.addMomentTag();
  }
  fixture.elements['moment-tags'].value = 'tag-9';
  fixture.submit();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.elements['moment-tags'].value, '', 'the duplicate input is consumed before publishing');
  assert.equal(JSON.parse(fixture.requests[0].options.body).spec.tags.length, 10);
  assert.equal(fixture.alerts.length, 0);
  fixture.requests[0].resolve({ ok: true });
  await settle();
  fixture.cleanup();
});

test('an upload cannot re-enable the button while a publication is pending', async () => {
  const fixture = await momentFixture();
  fixture.submit();
  const input = { files: [new File(['image'], 'photo.png', { type: 'image/png' })], value: 'selected' };
  const upload = fixture.window.handleFileSelect({ target: input });
  assert.equal(fixture.requests.length, 1, 'no upload starts while a publication is pending');
  await upload;
  assert.equal(fixture.elements['moment-publish-btn'].disabled, true);
  fixture.requests[0].resolve({ ok: true });
  await settle();
  fixture.cleanup();
});

test('an upload from a closed modal cannot attach media to a new draft', async () => {
  const fixture = await momentFixture();
  fixture.window.openMomentModal();
  const input = { files: [new File(['image'], 'old.png', { type: 'image/png' })], value: 'selected' };
  const upload = fixture.window.handleFileSelect({ target: input });
  fixture.window.closeMomentModal();
  fixture.window.openMomentModal();
  fixture.requests[0].resolve({ ok: true, json: async () => ({ status: { permalink: '/old.png' } }) });
  await upload;
  fixture.submit();
  const sent = JSON.parse(fixture.requests[1].options.body);
  assert.equal(sent.spec.content.medium, undefined);
  fixture.requests[1].resolve({ ok: true });
  await settle();
  fixture.cleanup();
});

test('late publication and refresh responses cannot mutate a replacement page', async () => {
  const fixture = await momentFixture();
  fixture.submit();
  fixture.cleanup();
  fixture.elements['moment-content'].value = 'replacement page';
  fixture.requests[0].resolve({ ok: true });
  await settle();
  assert.equal(fixture.elements['moment-content'].value, 'replacement page');
  assert.equal(fixture.timers.size, 0);
});

test('late list refresh cannot replace content after page cleanup', async () => {
  const fixture = await momentFixture();
  fixture.setRefreshedMarkup('<article>outdated result</article>');
  fixture.submit();
  fixture.requests[0].resolve({ ok: true });
  await settle();
  const running = [...fixture.timers.values()][0]();
  fixture.cleanup();
  fixture.elements['moments-list'].innerHTML = '<article>replacement page</article>';
  fixture.requests[1].resolve({ ok: true, text: async () => 'old server HTML' });
  await running;
  assert.equal(fixture.elements['moments-list'].innerHTML, '<article>replacement page</article>');
});

test('a failed list refresh preserves a newly opened draft and offers one retry at a time', async () => {
  const fixture = await momentFixture();
  fixture.window.openMomentModal();
  fixture.submit();
  fixture.window.closeMomentModal();
  fixture.window.openMomentModal();
  fixture.elements['moment-content'].value = 'new draft';
  fixture.requests[0].resolve({ ok: true });
  await settle();
  const running = [...fixture.timers.values()][0]();
  fixture.requests[1].resolve({ ok: false, status: 503 });
  await running;
  assert.equal(fixture.reloadCount(), 0, 'refresh failure must never discard the page or draft');
  assert.equal(fixture.elements['moment-content'].value, 'new draft');
  assert.equal(fixture.elements['moment-publish-modal'].style.display, 'flex');
  assert.equal(fixture.elements['moments-refresh-status'].classList.contains('hidden'), false);
  assert.equal(fixture.elements['moments-publish-status'].classList.contains('hidden'), true,
    'a failed refresh replaces the success notice instead of stacking a second result');
  assert.equal(fixture.elements['moments-refresh-retry'].disabled, false);

  fixture.setRefreshedMarkup('<article>published moment</article>');
  const retry = fixture.elements['moments-refresh-retry'];
  retry.dispatchEvent(new Event('click'));
  retry.dispatchEvent(new Event('click'));
  assert.equal(fixture.requests.length, 3, 'pending retry must not start duplicate refresh requests');
  assert.equal(retry.disabled, true);
  fixture.requests[2].resolve({ ok: true, text: async () => 'refreshed HTML' });
  await settle();
  assert.equal(fixture.elements['moments-list'].innerHTML, '<article>published moment</article>');
  assert.equal(fixture.elements['moments-refresh-status'].classList.contains('hidden'), true);
  assert.equal(retry.disabled, false);
  assert.equal(fixture.elements['moment-content'].value, 'new draft');
  assert.equal(fixture.elements['moment-publish-modal'].style.display, 'flex');
  fixture.cleanup();
});

test('a refreshed public result clears itself and cancels its timer on page cleanup', async () => {
  const f = await momentFixture();
  f.submit(); f.requests[0].resolve({ ok: true }); await settle();
  const refresh = [...f.timers.values()].at(-1)();
  f.requests[1].resolve({ ok: true, text: async () => 'list' }); await refresh;
  const status = f.elements['moments-publish-status'];
  assert.equal(status.classList.contains('hidden'), false);
  [...f.timers.values()].at(-1)();
  assert.equal(status.classList.contains('hidden'), true);
  f.cleanup();
  assert.equal(f.timers.size, 0);
});

test('a newer pending-approval result cannot be hidden or replaced by an older list refresh', async () => {
  const f = await momentFixture();
  f.submit(); f.requests[0].resolve({ ok: true }); await settle();
  const oldRefresh = [...f.timers.values()].at(-1)();
  f.elements['moment-content'].value = 'second draft'; f.submit();
  assert.equal(f.elements['moments-publish-status'].classList.contains('hidden'), true);
  f.requests[2].resolve({ ok: true, json: async () => publishedMoment({ approved: false }) });
  await settle();
  f.requests[1].resolve({ ok: false, status: 503 }); await oldRefresh;
  assert.equal(f.elements['moments-publish-status'].classList.contains('hidden'), false);
  assert.match(f.elements['moments-publish-status'].textContent, /待审核/);
  assert.equal(f.elements['moments-refresh-status'].classList.contains('hidden'), true);
  assert.equal(f.timers.size, 0);
  f.cleanup();
});

test('a late refresh failure after page cleanup cannot show feedback on the replacement page', async () => {
  const fixture = await momentFixture();
  fixture.submit();
  fixture.requests[0].resolve({ ok: true });
  await settle();
  const running = [...fixture.timers.values()][0]();
  fixture.cleanup();
  fixture.requests[1].resolve({ ok: false, status: 503 });
  await running;
  assert.equal(fixture.reloadCount(), 0);
  assert.equal(fixture.elements['moments-refresh-status'].classList.contains('hidden'), true);
});

test('first publication with a new tag refreshes filters with the list while keeping the publisher outside', async () => {
  const host = momentTemplate.match(/<div\s+id="moments-list"(?:[^"'>]|"[^"]*"|'[^']*')*>/);
  assert.ok(host);
  assert.ok(host.index < momentTemplate.indexOf('th:each="tag : ${tags}"'), 'tag filters must belong to the refresh host');
  const fixture = await momentFixture();
  const publisher = fixture.elements['moment-publish-modal'];
  fixture.elements['moments-list'].innerHTML = '<p>暂无瞬间</p>';
  fixture.elements['moment-tags'].value = 'new-tag';
  fixture.window.addMomentTag();
  const refreshed = '<nav><a href="/moments?tag=new-tag">new-tag</a></nav><article>first moment</article><span>1 / 1</span>';
  fixture.setRefreshedMarkup(refreshed);
  fixture.submit();
  assert.deepEqual(JSON.parse(fixture.requests[0].options.body).spec.tags, ['new-tag']);
  fixture.requests[0].resolve({ ok: true });
  await settle();
  const running = [...fixture.timers.values()][0]();
  fixture.requests[1].resolve({ ok: true, text: async () => 'server HTML with new tag' });
  await running;
  assert.equal(fixture.elements['moments-list'].innerHTML, refreshed);
  assert.equal(fixture.elements['moment-publish-modal'], publisher);
  assert.equal(typeof fixture.window.openMomentModal, 'function');
  fixture.cleanup();
});

test('empty and populated lists have one stable refresh region including empty state and pagination', async () => {
  const host = momentTemplate.match(/<div\s+id="moments-list"(?:[^"'>]|"[^"]*"|'[^']*')*>/);
  assert.ok(host, 'the list host must exist');
  assert.doesNotMatch(host[0], /th:if|th:unless/, 'the host must exist for an empty result');
  const divTags = /<\/?div\b(?:[^"'>]|"[^"]*"|'[^']*')*>/g;
  divTags.lastIndex = host.index + host[0].length;
  let depth = 1;
  let hostEnd = -1;
  for (const tag of momentTemplate.matchAll(divTags)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      hostEnd = tag.index;
      break;
    }
  }
  assert.notEqual(hostEnd, -1, 'the host must close');
  const insideHost = momentTemplate.slice(host.index, hostEnd);
  assert.ok(insideHost.includes('暂无瞬间'), 'empty state must be refreshed with the list');
  assert.ok(insideHost.includes('moments.hasPrevious()'), 'pagination must be refreshed with the list');
  assert.ok(insideHost.includes('th:each="tag : ${tags}"'), 'tag filters must be refreshed with the list');
  assert.ok(!insideHost.includes('id="moment-publish-modal"'), 'the publisher must survive refresh');

  const fixture = await momentFixture();
  fixture.elements['moments-list'].innerHTML = '<p>暂无瞬间</p>';
  fixture.setRefreshedMarkup('<article>first moment</article><nav>1 / 2</nav>');
  fixture.submit();
  fixture.requests[0].resolve({ ok: true });
  await settle();
  const refresh = [...fixture.timers.values()][0];
  assert.ok(refresh, 'successful publication schedules a refresh');
  const running = refresh();
  fixture.requests[1].resolve({ ok: true, text: async () => 'server HTML' });
  await running;
  assert.equal(fixture.elements['moments-list'].innerHTML, '<article>first moment</article><nav>1 / 2</nav>');
  fixture.cleanup();
});

test('publishing into a populated list replaces cards and pagination together', async () => {
  const fixture = await momentFixture();
  fixture.elements['moments-list'].innerHTML = '<article>old moment</article><nav>1 / 1</nav>';
  fixture.setRefreshedMarkup('<article>new moment</article><article>old moment</article><nav>1 / 2</nav>');
  fixture.submit();
  fixture.requests[0].resolve({ ok: true });
  await settle();
  const running = [...fixture.timers.values()][0]();
  fixture.requests[1].resolve({ ok: true, text: async () => 'server HTML' });
  await running;
  assert.equal(fixture.elements['moments-list'].innerHTML,
    '<article>new moment</article><article>old moment</article><nav>1 / 2</nav>');
  fixture.cleanup();
});

test('a local list refresh restores liked appearance while preserving the open publisher', async () => {
  const fixture = await momentFixture({ upvotedNames: ['liked-moment'] });
  const likedButton = new Element();
  const icon = new Element();
  const count = new Element();
  icon.className = 'icon-[heroicons--heart] w-5 h-5';
  count.textContent = '7';
  likedButton.dataset.momentName = 'liked-moment';
  likedButton.querySelector = (selector) => selector === '.upvote-count' ? count : icon;
  fixture.setRefreshedMarkup('<article>liked moment</article>', [likedButton]);
  fixture.submit();
  fixture.requests[0].resolve({ ok: true });
  await settle();
  fixture.window.openMomentModal();
  fixture.elements['moment-content'].value = 'next draft';
  fixture.elements['moment-tags'].value = 'next-tag';
  fixture.window.addMomentTag();
  const running = [...fixture.timers.values()][0]();
  fixture.requests[1].resolve({ ok: true, text: async () => 'refreshed HTML' });
  await running;
  assert.match(icon.className, /heart-solid/, 'new list nodes must retain the locally remembered like');
  assert.equal(likedButton.classList.contains('text-error'), true);
  assert.equal(count.textContent, '7', 'restoring appearance must not increment the server count');
  assert.equal(fixture.elements['moment-content'].value, 'next draft');
  assert.equal(fixture.elements['moment-publish-modal'].style.display, 'flex');
  fixture.submit();
  assert.deepEqual(JSON.parse(fixture.requests[2].options.body).spec.tags, ['next-tag']);
  fixture.requests[2].resolve({ ok: true });
  await settle();
  fixture.cleanup();
});

test('a replacement moment button cannot resubmit the same pending upvote', async () => {
  const { fixture, current, pending } = await refreshDuringMomentUpvote();
  const duplicate = fixture.window.handleMomentUpvote(current.button);
  assert.equal(fixture.requests.filter(({ url }) => url.endsWith('/trackers/upvote')).length, 1);
  fixture.requests[0].resolve({ ok: true });
  await Promise.all([pending, duplicate]);
  fixture.cleanup();
});

test('a replacement moment button restores the pending appearance during a local refresh', async () => {
  const { fixture, current, pending } = await refreshDuringMomentUpvote();
  assert.equal(current.button.disabled, true);
  assert.equal(current.button['aria-busy'], 'true');
  fixture.requests[0].resolve({ ok: true });
  await pending;
  fixture.cleanup();
});

for (const [serverCount, expectedCount] of [[7, 8], [8, 8], [11, 11]]) {
  test(`a completed upvote reconciles the replacement server count ${serverCount} without a duplicate increment`, async () => {
    const { fixture, current, pending } = await refreshDuringMomentUpvote(serverCount);
    fixture.requests[0].resolve({ ok: true });
    await pending;
    assert.equal(Number(current.count.textContent), expectedCount);
    assert.match(current.icon.className, /heart-solid/);
    assert.equal(current.button.classList.contains('text-error'), true);
    assert.equal(current.button.disabled, false);
    assert.equal(current.button['aria-busy'], undefined);
    assert.deepEqual(fixture.savedUpvotes(), ['pending-moment']);
    await fixture.window.handleMomentUpvote(current.button);
    assert.equal(fixture.requests.filter(({ url }) => url.endsWith('/trackers/upvote')).length, 1);
    fixture.cleanup();
  });
}

test('a failed upvote releases the replacement button and gives feedback next to the current card', async () => {
  const { fixture, current, pending } = await refreshDuringMomentUpvote();
  fixture.requests[0].resolve({ ok: false, status: 503 });
  await pending;
  assert.equal(current.button.disabled, false);
  assert.equal(current.button['aria-busy'], undefined);
  assert.equal(Number(current.count.textContent), 7);
  assert.doesNotMatch(current.icon.className, /heart-solid/);
  assert.ok(current.button.actionStatus, 'failure feedback must belong to the current card');
  assert.match(current.button.actionStatus.textContent, /点赞失败/);
  assert.deepEqual(fixture.savedUpvotes(), []);
  const retry = fixture.window.handleMomentUpvote(current.button);
  assert.equal(fixture.requests.filter(({ url }) => url.endsWith('/trackers/upvote')).length, 2);
  fixture.requests[3].resolve({ ok: true });
  await retry;
  assert.equal(Number(current.count.textContent), 8);
  fixture.cleanup();
});

test('an older delayed list refresh cannot overwrite a newer publication', async () => {
  const fixture = await momentFixture();
  fixture.submit();
  fixture.requests[0].resolve({ ok: true });
  await settle();
  const olderRefresh = [...fixture.timers.values()].at(-1)();
  fixture.elements['moment-content'].value = 'second draft';
  fixture.submit();
  fixture.requests[2].resolve({ ok: true });
  await settle();
  const newerRefresh = [...fixture.timers.values()].at(-1)();
  fixture.setRefreshedMarkup('<article>newest list</article>');
  fixture.requests[3].resolve({ ok: true, text: async () => 'newest response' });
  await newerRefresh;
  fixture.setRefreshedMarkup('<article>outdated list</article>');
  fixture.requests[1].resolve({ ok: true, text: async () => 'older response' });
  await olderRefresh;
  assert.equal(fixture.elements['moments-list'].innerHTML, '<article>newest list</article>');
  fixture.cleanup();
});

test('corrupt, non-array, and unavailable storage cannot break post initialization', () => {
  for (const value of ['{', 'null', '{}', '[]', '["article-a"]']) {
    const { like } = postFixture({ stored: value });
    assert.doesNotThrow(() => like.init(), `storage value ${value}`);
    assert.equal(like.isLiked, value === '["article-a"]');
  }
  assert.doesNotThrow(() => postFixture({ readThrows: true }).like.init());
});

test('a successful post like repairs malformed and non-array local records', async () => {
  for (const stored of ['{', 'null', '{}']) {
    const fixture = postFixture({ stored });
    fixture.like.init();
    const pending = fixture.like.toggleLike();
    fixture.requests[0].resolve({ ok: true });
    await pending;
    assert.equal(fixture.saved(), '["article-a"]');
    assert.equal(fixture.like.likeCount, 4);
  }
});

test('post pending clicks send one request and successful response updates once even if storage is denied', async () => {
  const fixture = postFixture({ writeThrows: true });
  fixture.like.init();
  const first = fixture.like.toggleLike();
  const second = fixture.like.toggleLike();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.like.isPending, true);
  assert.deepEqual(JSON.parse(fixture.requests[0].options.body), {
    group: 'content.halo.run', plural: 'posts', name: 'article-a',
  });
  fixture.requests[0].resolve({ ok: true });
  await Promise.all([first, second]);
  assert.equal(fixture.like.likeCount, 4);
  assert.equal(fixture.like.isLiked, true);
  assert.equal(fixture.like.isPending, false);
  await fixture.like.toggleLike();
  assert.equal(fixture.requests.length, 1, 'successful likes cannot be sent again');
});

test('post failures release pending state and a later successful retry is recorded', async () => {
  const fixture = postFixture();
  fixture.like.init();
  const first = fixture.like.toggleLike();
  fixture.requests[0].reject(new Error('network unavailable'));
  await first;
  assert.equal(fixture.like.likeCount, 3);
  assert.equal(fixture.like.isPending, false);
  const retry = fixture.like.toggleLike();
  fixture.requests[1].resolve({ ok: true });
  await retry;
  assert.equal(fixture.like.likeCount, 4);
  assert.equal(fixture.saved(), '["article-a"]');
});

test('a rejected post response preserves state and allows another attempt', async () => {
  const fixture = postFixture({ stored: '["another-article"]' });
  fixture.like.init();
  const first = fixture.like.toggleLike();
  fixture.requests[0].resolve({ ok: false, status: 500, text: async () => 'server error' });
  await first;
  assert.equal(fixture.like.likeCount, 3);
  assert.equal(fixture.like.isLiked, false);
  assert.equal(fixture.like.isPending, false);
  const retry = fixture.like.toggleLike();
  fixture.requests[1].resolve({ ok: true });
  await retry;
  assert.equal(fixture.saved(), '["another-article","article-a"]');
});

test('destroyed post component ignores a late successful response', async () => {
  const fixture = postFixture();
  fixture.like.init();
  const pending = fixture.like.toggleLike();
  fixture.like.destroy();
  assert.equal(fixture.requests[0].options.signal.aborted, true);
  fixture.requests[0].resolve({ ok: true });
  await pending;
  assert.equal(fixture.like.likeCount, 3);
  assert.equal(fixture.saved(), '[]');
  assert.equal(fixture.like.isPending, false);
});


test('post failures announce recovery and a successful retry clears that feedback', async () => {
  for (const networkFailure of [false, true]) {
    const f = postFixture(); f.like.init();
    const operation = f.like.toggleLike();
    if (networkFailure) f.requests[0].reject(new TypeError('offline'));
    else f.requests[0].resolve({ ok: false, status: 503, text: async () => 'unavailable' });
    await operation;
    assert.ok(f.like.errorMessage, 'failed likes need visible recoverable feedback');
    assert.equal(f.like.likeCount, 3); assert.equal(f.like.isLiked, false);
    const retry = f.like.toggleLike();
    assert.equal(f.like.errorMessage, '', 'a new attempt clears the stale error');
    f.requests[1].resolve({ ok: true }); await retry;
    assert.equal(f.like.errorMessage, ''); assert.equal(f.like.likeCount, 4);
  }
});

test('leaving an article suppresses a late failed like notification', async () => {
  const f = postFixture(); f.like.init(); const operation = f.like.toggleLike();
  f.like.destroy(); f.requests[0].reject(new DOMException('aborted', 'AbortError'));
  await operation;
  assert.equal(f.like.errorMessage, ''); assert.equal(f.like.likeCount, 3);
});
