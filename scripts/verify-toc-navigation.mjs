import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/common/js/toc-utils.js", import.meta.url), "utf8");
const docSource = fs.readFileSync(new URL("../src/pages/doc/doc.js", import.meta.url), "utf8");
const postSource = fs.readFileSync(new URL("../src/pages/post/post.js", import.meta.url), "utf8");
function fixture() {
  const calls = [];
  const history = { state: { source: "swup", index: 7 }, replaceState: (state, _, url) => calls.push({ state, url }) };
  const window = { scrollY: 400, history, location: new URL("https://example.test/post?preview-theme=theme-sky-blog-1"), scrollTo: (value) => calls.push(value) };
  const createElement = () => Object.assign(new EventTarget(), {
    style: { setProperty() {} }, children: [], attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    appendChild(child) { this.children.push(child); },
  });
  const api = vm.runInNewContext(`${source.replace(/^export /gm, "")};({smoothScrollToHeading,createDynamicTocHTML,restoreHeadingFragment: typeof restoreHeadingFragment === "function" ? restoreHeadingFragment : async () => {}})`, { window, document: { createElement }, URL, requestAnimationFrame: fn => fn() });
  return { ...api, calls, window };
}

test("目录使用文档坐标而非定位父级坐标，并保留历史状态", () => {
  const f = fixture();
  f.smoothScrollToHeading({ id: "title", isConnected: true, offsetTop: 200, getBoundingClientRect: () => ({ top: 600 }) });
  assert.equal(f.calls.find(x => x.top !== undefined).top, 920);
  assert.equal(f.calls.find(x => x.state)?.state.index, 7);
  assert.match(f.calls.find(x => x.url)?.url, /preview-theme=theme-sky-blog-1#title$/);
});

test("离页后抽屉延迟回调不能滚动新页面", () => {
  const f = fixture();
  f.smoothScrollToHeading({ isConnected: false, offsetTop: 100, getBoundingClientRect: () => ({ top: 100 }) });
  assert.equal(f.calls.length, 0);
});

test("主题处理的目录链接排除 Swup 重复滚动，并保留组合键行为", () => {
  const f = fixture(); let count = 0;
  const list = f.createDynamicTocHTML([{ id: "标题%", text: "Title", relativeLevel: 0, absoluteLevel: 1, children: [], element: {} }], { onClick: () => count++ });
  const link = list.children[0].children[0];
  assert.ok(Object.hasOwn(link.attributes, "data-no-swup"));
  const modified = Object.assign(new Event("click", { cancelable: true }), { button: 0, ctrlKey: true });
  link.dispatchEvent(modified);
  assert.equal(count, 0); assert.equal(modified.defaultPrevented, false);
  const normal = Object.assign(new Event("click", { cancelable: true }), { button: 0 });
  link.dispatchEvent(normal); assert.equal(count, 1); assert.equal(normal.defaultPrevented, true);
});


test("历史锚点等待祖先入场动画完成后定位，且不改写历史", async () => {
  const f = fixture(); f.window.location.hash = "#title";
  let finish; const finished = new Promise(resolve => { finish = resolve; });
  const heading = { id: "title", isConnected: true, parentElement: null, getBoundingClientRect: () => ({ top: 600 }), getAnimations: () => [{ finished, effect: { getTiming: () => ({ iterations: 1 }) } }] };
  const pending = f.restoreHeadingFragment({ querySelectorAll: () => [heading] });
  await Promise.resolve(); assert.equal(f.calls.length, 0);
  finish(); await pending;
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].top, 920);
});

test("离页或锚点改变后放弃延迟定位", async () => {
  const f = fixture(); f.window.location.hash = "#title";
  let finish; const finished = new Promise(resolve => { finish = resolve; });
  const heading = { id: "title", isConnected: true, parentElement: null, getAnimations: () => [{ finished, effect: { getTiming: () => ({ iterations: 1 }) } }] };
  const pending = f.restoreHeadingFragment({ querySelectorAll: () => [heading] });
  await Promise.resolve(); f.window.location.hash = "#elsewhere"; finish(); await pending;
  assert.equal(f.calls.length, 0);
});

function headingFixture(ids, otherIds = []) {
  function element(tagName, id = "") {
    const classes = new Set();
    const node = Object.assign(new EventTarget(), {
      tagName: tagName.toUpperCase(), id, textContent: id || "Generated heading", children: [], dataset: {}, style: { setProperty() {} },
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      appendChild(child) { this.children.push(child); child.parentElement = this; },
      setAttribute(name, value) {
        this[name] = String(value);
        if (name === "data-heading-id") this.dataset.headingId = String(value);
      },
      getAttribute(name) { return this[name] ?? null; },
      closest() { return null; },
      querySelectorAll(selector) {
        const nodes = this.children.flatMap(child => [child, ...child.querySelectorAll("*")]);
        if (selector === "*") return nodes;
        if (selector === ".toc-link") return nodes.filter(child => child.className?.split(" ").includes("toc-link"));
        if (selector === "h1, h2, h3, h4, h5, h6") return nodes.filter(child => /^H[1-6]$/.test(child.tagName));
        throw new Error(`Unsupported fixture selector: ${selector}`);
      },
      querySelector(selector) {
        // The old production callback emits an invalid quoted CSS selector for
        // these IDs. Keep literal attribute matching separate from CSS syntax.
        const match = selector.match(/^\.toc-link\[data-heading-id="((?:[^"\\]|\\.)*)"\]$/);
        if (!match) throw new SyntaxError("Invalid fixture attribute selector");
        const value = match[1].replace(/\\(.)/g, "$1");
        return this.querySelectorAll(".toc-link").find(child => child.dataset.headingId === value) || null;
      },
    });
    return node;
  }
  const headings = ids.map(id => element("h2", id));
  const content = element("article", "article-content");
  headings.forEach(heading => content.appendChild(heading));
  const nav = element("nav", "toc-nav");
  const drawer = element("nav", "post-toc-drawer-nav");
  const roots = [content, nav, drawer, ...otherIds.map(id => element("div", id))];
  const document = {
    createElement: element,
    getElementById: id => roots.flatMap(node => [node, ...node.querySelectorAll("*")]).find(node => node.id === id) || null,
    querySelectorAll: () => [],
  };
  let observer;
  const destinations = [];
  const context = {
    document, window: { closePostTocDrawer() {} },
    smoothScrollToHeading: heading => destinations.push(heading),
    setTimeout: fn => fn(), _tocObserver: null,
    IntersectionObserver: class { constructor(callback) { observer = callback; } observe() {} disconnect() {} },
  };
  const functions = vm.runInNewContext(`${source.replace(/^export /gm, "")};({buildDynamicTocTree,createDynamicTocHTML,isPlainTocClick,ensureHeadingIds:typeof ensureHeadingIds === "function" ? ensureHeadingIds : undefined})`, { document });
  Object.assign(context, functions);
  return { headings, nav, drawer, document, context, destinations, ...functions, intersect: heading => observer([{ isIntersecting: true, target: heading }]) };
}

for (const sample of [
  { name: "先前标题", ids: ["heading-1", ""], otherIds: [] },
  { name: "后置标题", ids: ["", "heading-0"], otherIds: [] },
  { name: "非标题节点与已占用后缀", ids: [""], otherIds: ["heading-0", "heading-0-1"] },
]) {
  test(`自动目录 ID 避开${sample.name}，并保留作者 ID`, () => {
    const f = headingFixture(sample.ids, sample.otherIds);
    const tree = f.buildDynamicTocTree(f.headings, 2);
    tree.forEach((item, index) => {
      if (sample.ids[index]) assert.equal(item.id, sample.ids[index]);
      assert.equal(f.document.getElementById(item.id), f.headings[index], "每个目录锚点必须唯一定位原标题");
      assert.ok(!sample.otherIds.includes(item.id), "不能占用非标题节点的 ID");
    });
    assert.equal(new Set(tree.map(item => item.id)).size, tree.length);
    const assigned = f.headings.map(heading => heading.id);
    f.buildDynamicTocTree(f.headings, 2);
    assert.deepEqual(f.headings.map(heading => heading.id), assigned, "重复初始化不改写 ID");
  });
}

test("文章备用抽屉的每个链接都定位原标题，作者后置 ID 不被自动 ID 遮蔽", () => {
  const f = headingFixture(["", "heading-0"], ["heading-0-1"]);
  // Exercise the fallback path used when the desktop TOC is absent.
  const getElementById = f.document.getElementById;
  f.document.getElementById = id => id === "toc-nav" ? null : getElementById(id);
  const start = postSource.indexOf("        initTocDrawerContent(drawerNav) {");
  const end = postSource.indexOf("        initHeadingAnchors() {", start);
  const manager = vm.runInNewContext(`({${postSource.slice(start, end)}})`, f.context);
  manager.initTocDrawerContent(f.drawer);
  const links = f.drawer.querySelectorAll(".toc-link");
  links.forEach(link => link.dispatchEvent(Object.assign(new Event("click", { cancelable: true }), { button: 0 })));
  assert.equal(f.destinations[0], f.headings[0]);
  assert.equal(f.destinations[1], f.headings[1]);
  assert.equal(f.headings[1].id, "heading-0");
});

for (const id of ['section"quoted', "section\\path"]) {
  test(`文档目录按原始标题 ID 高亮：${id}`, () => {
    const f = headingFixture(["plain", id]);
    const start = docSource.indexOf("function initTOC()");
    const end = docSource.indexOf("function initDropdowns()", start);
    const initTOC = vm.runInNewContext(`${docSource.slice(start, end)};initTOC`, f.context);
    initTOC();
    f.intersect(f.headings[0]);
    assert.doesNotThrow(() => f.intersect(f.headings[1]));
    const links = f.nav.querySelectorAll(".toc-link");
    assert.equal(links[0].classList.contains("active"), false);
    assert.equal(links[1].classList.contains("active"), true);
    assert.equal(f.headings[1].id, id);
  });
}
