import assert from "node:assert/strict";
import test from "node:test";
import { isNcmPlayerStylesheet, preparePluginPage } from "../src/common/js/plugin-page.js";
import { createPage } from "../src/common/js/page.js";

function documentFrom(scripts) {
  const close = () => {};
  const style = { remove: close };
  return { querySelectorAll: (selector) => selector === "script" ? scripts : [style] };
}

test("navigation prepares Shiki's declared options and ignores arbitrary scripts", (t) => {
  const previous = globalThis.location;
  globalThis.location = new URL("https://halo.test/docs");
  t.after(() => {
    if (previous) globalThis.location = previous;
    else delete globalThis.location;
  });
  const inline = (textContent) => ({ textContent, hasAttribute: () => false });
  const external = (src) => ({ hasAttribute: () => true, getAttribute: () => src, type: "module" });
  const scripts = [
    inline(`import { renderCodeBlock } from '/plugins/shiki/assets/static/shiki-code.js?version=1.5.2';
      renderCodeBlock({ lightTheme: 'andromeeda', darkTheme: 'aurora-x', variant: 'mac', fontSize: '0.875em', excludedLanguages: ['html'] });`),
    external("/plugins/shiki/assets/static/shiki-code.js?version=1.5.2"),
    external("/plugins/Unknown/assets/execute.js"),
    external("https://cdn.example/plugins/PluginCommentWidget/assets/static/widget.js"),
    inline("var autoContactFrom = [{\"formId\":\"test\"}];"),
  ];
  const result = preparePluginPage(documentFrom(scripts), false);
  assert.equal(result.assets.length, 1);
  assert.equal(new URL(result.assets[0].url).searchParams.get("version"), "1.5.2");
  assert.equal(result.shiki.options.darkTheme, "aurora-x");
  assert.deepEqual(result.shiki.excludedLanguages, ["html"]);
  assert.deepEqual(result.contacts, [{ formId: "test" }]);
});

test("navigation loads only the declared NCM head resources with their settings", (t) => {
  const previous = globalThis.location;
  globalThis.location = new URL("https://halo.test/moments");
  t.after(() => {
    if (previous) globalThis.location = previous;
    else delete globalThis.location;
  });

  const head = {};
  const removed = [];
  const asset = "/plugins/plugin-ncm/assets/static/";
  const script = (src, attributes, parentElement = head) => {
    const properties = new Map(Object.entries({ src, ...attributes }));
    return {
      type: "module",
      parentElement,
      hasAttribute: name => properties.has(name),
      getAttribute: name => properties.get(name),
      remove: () => removed.push(src),
    };
  };
  const player = asset + "mini-player/player.js?v=beta";
  const appearance = asset + "mini-player/appearance.js?v=beta";
  const cards = asset + "card.js?v=beta";
  const settings = preparePluginPage({
    ...documentFrom([
      script(appearance, { "data-ncm-appearance-source": "" }),
      script(player, {
        "data-ncm-mini-player": "2195404116",
        "data-ncm-resume": "true",
        "data-ncm-position-wide": "0.8,0.9",
        class: "extra",
      }),
      script(cards, { "data-ncm-card-js": "", "data-endpoint": "/music/card/" }),
      script(player, { "data-ncm-mini-player": "2195404116" }, {}),
      script(asset + "other.js", { "data-ncm-mini-player": "2195404116" }),
      script("https://cdn.example" + player, { "data-ncm-mini-player": "2195404116" }),
      script(player, {}),
    ]),
    head,
  }, false);

  assert.deepEqual(removed, [appearance, player, cards]);
  assert.deepEqual(settings.assets.map(({ attributes }) => attributes), [
    { "data-ncm-appearance-source": "" },
    {
      "data-ncm-mini-player": "2195404116",
      "data-ncm-resume": "true",
      "data-ncm-position-wide": "0.8,0.9",
    },
    { "data-ncm-card-js": "", "data-endpoint": "/music/card/" },
  ]);
  const stylesheet = href => ({ localName: "link", getAttribute: name => name === "href" ? href : "stylesheet" });
  assert.equal(isNcmPlayerStylesheet(stylesheet(asset + "mini-player/theme.css?v=beta")), true);
  assert.equal(isNcmPlayerStylesheet(stylesheet("https://cdn.example" + asset + "mini-player/theme.css")), false);
  assert.equal(isNcmPlayerStylesheet(stylesheet(asset + "card.css")), false);
});

test("a page owns its modules' mount order and runs cleanup once in reverse order", () => {
  const page = createPage();
  const calls = [];
  page.useAlpine(() => calls.push("register"));
  page.onMount((context) => {
    calls.push(context.initial ? "first:direct" : "first:link");
    return () => calls.push("first:dispose");
  });
  page.onMount(() => {
    calls.push("second:mount");
    return () => calls.push("second:dispose");
  });
  page.registerAlpine({});
  const leave = page.mount({ initial: false });
  leave();
  leave();
  assert.deepEqual(calls, ["register", "first:link", "second:mount", "second:dispose", "first:dispose"]);
});

test("a failed page feature releases features mounted before it", () => {
  const page = createPage();
  let disposed = 0;
  page.onMount(() => () => disposed++);
  page.onMount(() => { throw new Error("asset failed"); });
  assert.throws(() => page.mount({ initial: false }), /asset failed/);
  assert.equal(disposed, 1);
});
