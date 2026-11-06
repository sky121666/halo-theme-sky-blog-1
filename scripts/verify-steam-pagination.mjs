import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/pages/steam/steam.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;/gm, '');
const template = fs.readFileSync(new URL('../templates/modules/steam/content.html', import.meta.url), 'utf8');

function setup() {
  let component;
  const requests = [];
  vm.runInNewContext(source, {
    window: {}, AbortController,
    localStorage: { getItem() { return null; }, setItem() {} },
    Alpine: { data(name, factory) { if (name === 'steamPage') component = factory(); } },
    registerAlpinePageComponents(fn) { fn(); }, registerPageLifecycle() {}, notifySwupPageReady() {},
    skyDebug: { error() {} },
    // Deliberately allow a response after abort, including an already-started JSON parse.
    fetch(url, { signal }) {
      return new Promise((resolve, reject) => requests.push({
        url, signal, reject,
        resolve(page) { resolve({ ok: true, json: async () => ({ items: [{ name: `page ${page}` }], page, totalPages: 3 }) }); },
      }));
    },
  });
  component._abortController = new AbortController();
  component.games = { items: [], page: 2, totalPages: 3 };
  return { component, requests };
}

test('late previous request cannot overwrite the latest selected page', async () => {
  const { component: c, requests: r } = setup();
  const old = c.loadGames(3);
  const current = c.loadGames(1);
  r[1].resolve(1); await current;
  r[0].resolve(3); await old;
  assert.equal(c.games.page, 1);
  assert.equal(c.loading.games, false);
});

test('superseded completion cannot dismiss the current loading state', async () => {
  const { component: c, requests: r } = setup();
  const old = c.loadGames(3); const current = c.loadGames(1);
  r[0].resolve(3); await old;
  assert.equal(c.games.page, 2);
  assert.equal(c.loading.games, true);
  assert.equal(r[0].signal.aborted, true);
  r[1].resolve(1); await current;
  assert.equal(c.games.page, 1);
});

test('aborted request failure neither falls back to another API nor changes the current error', async () => {
  const { component: c, requests: r } = setup();
  const old = c.loadGames(3); const current = c.loadGames(1);
  r[0].reject(new Error('late failure'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(r.length, 2, 'cancellation must stop fallback requests');
  await old;
  assert.equal(c.errors.games, null);
  assert.equal(c.loading.games, true);
  r[1].resolve(1); await current;
});

test('page destruction cancels loading and ignores a late response', async () => {
  const { component: c, requests: r } = setup();
  const loading = c.loadGames(3);
  c.destroy(); r[0].resolve(3); await loading;
  assert.equal(r[0].signal.aborted, true);
  assert.equal(c.games.page, 2);
  await c.loadGames(1);
  assert.equal(r.length, 1, 'destroyed components must not start another request');
});

test('current request failure is visible and a retry can recover', async () => {
  const { component: c, requests: r } = setup();
  const first = c.loadGames(3);
  r[0].reject(new Error('unavailable'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(r.length, 2, 'retain the supported API fallback on ordinary failures');
  r[1].reject(new Error('unavailable')); await first;
  assert.ok(c.errors.games); assert.equal(c.loading.games, false);
  const retry = c.loadGames(3); r[2].resolve(3); await retry;
  assert.equal(c.games.page, 3); assert.equal(c.errors.games, null);
});

test('the rendered retry action requests the failed page instead of the last successful page', async () => {
  const { component: c, requests: r } = setup();
  const first = c.loadGames(3);
  r[0].reject(new Error('unavailable'));
  await new Promise(resolve => setImmediate(resolve));
  r[1].reject(new Error('unavailable')); await first;
  assert.equal(c.games.page, 2, 'keep the last successful page while reporting the failure');
  const expression = template.match(/@click="([^"]*loadGames\([^"]+)"[^>]*>重试<\/button>/)[1];
  const retry = vm.runInNewContext(expression, {
    loading: c.loading, games: c.games, gamesRequestedPage: c.gamesRequestedPage,
    loadGames: page => c.loadGames(page),
  });
  assert.equal(new URL(r[2].url, 'https://example.com').searchParams.get('page'), '3');
  r[2].resolve(3); await retry;
  assert.equal(c.games.page, 3);
  assert.equal(c.errors.games, null);
});

test('pagination controls disable and ignore repeated activation while the selected page is loading', async () => {
  const buttons = [...template.matchAll(/<button\b(?:"[^"]*"|'[^']*'|[^'">])*>/g)]
    .map(match => match[0]).filter(button => button.includes('aria-label="游戏库'));
  assert.equal(buttons.length, 2);
  for (const button of buttons) {
    const { component: c, requests: r } = setup();
    c.loading.games = false;
    const expression = button.match(/@click="([^"]+)"/)[1];
    const disabled = button.match(/:disabled="([^"]+)"/)[1];
    const context = { loading: c.loading, games: c.games, loadGames: page => c.loadGames(page) };
    assert.equal(vm.runInNewContext(disabled, context), false);
    const pending = vm.runInNewContext(expression, context);
    assert.equal(vm.runInNewContext(disabled, context), true);
    vm.runInNewContext(expression, context);
    assert.equal(r.length, 1, 'a second activation must not cancel and restart the request');
    assert.equal(r[0].signal.aborted, false);
    r[0].resolve(expression.includes('- 1') ? 1 : 3);
    await pending;
    assert.equal(c.loading.games, false);
  }
});
