#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { spawnSync } from "node:child_process";

// Execute the production loader and renderer; replace only the remote API and DOM
// boundary. A one-page-only loader must lose the second game's minutes here.
const source = fs.readFileSync(new URL("../src/pages/steam/steam.js", import.meta.url), "utf8");
const heatmapSource = source.slice(source.indexOf("async function initHeatmap("));

function record(name, appId, date, minutes) {
  return {
    apiVersion: "steam.timxs.com/v1alpha1",
    kind: "DailyPlaytimeRecord",
    metadata: { name },
    spec: {
      steamId: "fixture-account",
      appId,
      gameName: `Game ${appId}`,
      date,
      playtimeMinutes: minutes,
      startTime: `${date}T10:00:00Z`,
      endTime: `${date}T12:00:00Z`,
    },
  };
}

function setup(respond, { base = "/apis/api.steam.timxs.com/v1alpha1/heatmap/records", signal } = {}) {
  const requests = [];
  const errors = [];
  const grid = {
    dataset: { days: "2", apiUrl: base },
    cells: [],
    innerHTML: "",
    appendChild(cell) { this.cells.push(cell); },
  };
  const nodes = new Map([
    ["steam-heatmap-grid", grid],
    ...["loading", "empty", "error", "tooltip"].map((name) => [
      `steam-heatmap-${name}`, { style: {} },
    ]),
  ]);
  const context = vm.createContext({
    URL,
    Map,
    Set,
    DOMException,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [2026, 9, 28, 12])); }
    },
    window: { location: { origin: "https://example.test" } },
    skyDebug: { error(...args) { errors.push(args); } },
    document: {
      getElementById: (id) => nodes.get(id),
      createElement: () => ({ style: {}, dataset: {}, addEventListener() {} }),
    },
    async fetch(input, options) {
      const url = new URL(input);
      requests.push({ url, signal: options.signal });
      const data = await respond(url, requests.length);
      return { ok: true, json: async () => data };
    },
  });
  vm.runInContext(heatmapSource, context);
  return {
    grid, requests, errors, nodes,
    run: () => context.initHeatmap(signal),
    fetch: () => context.fetchHeatmapData(base, 2, signal),
  };
}

const first = record("day-game-a", 10, "2026-10-28", 40);
const second = record("day-game-b", 20, "2026-10-28", 70);
const older = record("older-game", 10, "2026-10-27", 25);

test("all pages contribute each game's minutes to the rendered day", async () => {
  const state = setup((url) => Number(url.searchParams.get("page")) === 1
    ? { page: 1, size: 2, total: 3, totalPages: 2, hasNext: true, items: [first, older] }
    : { page: 2, size: 2, total: 3, totalPages: 2, hasNext: false, items: [second] });
  await state.run();
  assert.equal(state.grid.cells.find((cell) => cell.dataset.date === "2026-10-28").dataset.minutes, 110);
  assert.deepEqual(state.requests.map(({ url }) => url.searchParams.get("page")), ["1", "2"]);
  assert.ok(state.requests.every(({ url }) => url.searchParams.get("startDate") === "2026-10-26"
    && url.searchParams.get("endDate") === "2026-10-28"));
});

test("totalPages completes pagination when hasNext is absent", async () => {
  const state = setup((url) => Number(url.searchParams.get("page")) === 1
    ? { page: 1, size: 2, total: 3, totalPages: 2, items: [first, older] }
    : { page: 2, size: 2, total: 3, totalPages: 2, items: [second] });
  const result = await state.fetch();
  assert.equal(result.items.length, 3);
});

test("overlapping records across pages do not double the daily time", async () => {
  const state = setup((url) => Number(url.searchParams.get("page")) === 1
    ? { page: 1, size: 2, total: 3, totalPages: 2, hasNext: true, items: [first, older] }
    : { page: 2, size: 2, total: 3, totalPages: 2, hasNext: false, items: [first, second] });
  await state.run();
  assert.equal(state.grid.cells.find((cell) => cell.dataset.date === "2026-10-28").dataset.minutes, 110);
});

for (const [name, lastItems] of [
  ["duplicate", [first, older]],
  ["empty", []],
  ["short", [second]],
]) {
  test(`a ${name} final page below total shows an error instead of partial minutes`, async () => {
    const state = setup((url) => Number(url.searchParams.get("page")) === 1
      ? { page: 1, size: 2, total: 4, totalPages: 2, hasNext: true, items: [first, older] }
      : { page: 2, size: 2, total: 4, totalPages: 2, hasNext: false, items: lastItems });
    await state.run();
    assert.equal(state.grid.cells.length, 0);
    assert.equal(state.nodes.get("steam-heatmap-error").style.display, "flex");
    assert.equal(state.errors.length, 1);
    assert.equal(state.requests.length, 2, "incomplete pages must not cause an unbounded retry");
  });
}

for (const [initialTotal, finalTotal] of [[4, 3], [3, 2]]) {
  test(`total changing from ${initialTotal} to ${finalTotal} fails without restarting or displaying a mixed snapshot`, async () => {
    const state = setup((url) => Number(url.searchParams.get("page")) === 1
      ? { page: 1, size: 2, total: initialTotal, totalPages: 2, hasNext: true, items: [first, older] }
      : { page: 2, size: 2, total: finalTotal, totalPages: 2, hasNext: false, items: [second] });
    await state.run();
    assert.equal(state.grid.cells.length, 0);
    assert.equal(state.nodes.get("steam-heatmap-error").style.display, "flex");
    assert.equal(state.errors.length, 1);
    assert.equal(state.requests.length, 2);
  });
}

test("a repeated page fails instead of rendering partial data or looping", async () => {
  const state = setup(() => ({ page: 1, size: 2, total: 6, totalPages: 3, hasNext: true, items: [first, older] }));
  await assert.rejects(state.fetch(), /page|pagination/i);
  assert.ok(state.requests.length <= 2);
});

test("a changing page number with no new records also stops pagination", async () => {
  const state = setup((url) => ({
    page: Number(url.searchParams.get("page")), size: 2, total: 6,
    totalPages: 3, hasNext: true, items: [first, older],
  }));
  await assert.rejects(state.fetch(), /pagination.*progress/i);
  assert.equal(state.requests.length, 2);
});

test("a later page failure shows the error state without a partial heatmap", async () => {
  const state = setup((url) => {
    if (url.searchParams.get("page") === "2") throw new Error("network unavailable");
    return { page: 1, size: 2, total: 3, totalPages: 2, hasNext: true, items: [first, older] };
  });
  await state.run();
  assert.equal(state.grid.cells.length, 0);
  assert.equal(state.nodes.get("steam-heatmap-error").style.display, "flex");
  assert.equal(state.errors.length, 1);
});

test("aborting stops pagination and does not attempt the legacy endpoint fallback", async () => {
  const controller = new AbortController();
  const state = setup(() => {
    controller.abort();
    throw new DOMException("Cancelled", "AbortError");
  }, { base: "/apis/api.steam.halo.run/v1alpha1/heatmap/records", signal: controller.signal });
  await state.run();
  assert.equal(state.requests.length, 1);
  assert.equal(state.errors.length, 0);
  assert.equal(state.grid.cells.length, 0);
});

for (const timezone of ["Asia/Shanghai", "America/Los_Angeles"]) {
  test(`heatmap tooltip preserves the record's calendar date in ${timezone}`, () => {
    const renderer = source.slice(source.indexOf("function renderCustomHeatmap("));
    const probe = `
      const cells = [], tooltip = { style: {} };
      const container = { innerHTML: '', appendChild: cell => cells.push(cell), closest: () => null };
      const document = { createElement: () => ({ style: {}, dataset: {}, listeners: {},
        addEventListener(name, callback) { this.listeners[name] = callback; } }) };
      const NativeDate = Date;
      Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [2026, 9, 31, 12])); }
      };
      ${renderer}
      renderCustomHeatmap(container, new Map([['2026-10-31', 90]]), 2, tooltip);
      const cell = cells.find(item => item.dataset.date === '2026-10-31');
      cell.listeners.mouseenter({ clientX: 20, clientY: 100 });
      process.stdout.write(JSON.stringify({ date: cell.dataset.date, tooltip: tooltip.innerHTML }));
    `;
    const result = spawnSync(process.execPath, ["--input-type=commonjs", "-e", probe], {
      env: { ...process.env, TZ: timezone }, encoding: "utf8", timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const rendered = JSON.parse(result.stdout);
    assert.equal(rendered.date, "2026-10-31");
    assert.match(rendered.tooltip, /10月31日/);
    assert.match(rendered.tooltip, /1\.5 小时/);
  });
}
