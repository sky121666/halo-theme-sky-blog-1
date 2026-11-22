import { getNode } from "@formkit/core";
import { keepControlVisible, mountKeyboardOrder } from "./settings-order.js";

const listSelector = "[data-sky-settings-array]";
const cardSelector = ".drag-handle + div";
const editorSelector = '[role="dialog"]:has(form[id^="array-item-form-"])';
const editSelector = "[data-sky-settings-array-edit]";
const addSelector = "[data-sky-settings-array-add]";
const removeSelector = "[data-sky-settings-array-remove]";
const actions = `${editSelector}, ${addSelector}, ${removeSelector}`;
const postListHosts = new Map([
  ["index", "首页"],
  ["category", "分类"],
  ["tag", "标签"],
]);
const postListStyleModes = new Map([
  ["inherit", "样式跟随上级"],
  ["custom", "自定义样式"],
]);
const postListCoverModes = new Map([
  ["inherit", "封面跟随上级"],
  ["off", "关闭替代封面"],
  ["missing_only", "无封面时替代"],
  ["always", "始终使用替代封面"],
]);

function setCardLabels(card, labels) {
  const spans = [...card.querySelectorAll(":scope > span")];
  while (spans.length < labels.length) {
    const span = card.ownerDocument.createElement("span");
    card.append(span);
    spans.push(span);
  }
  spans.forEach((span, index) => {
    const label = labels[index];
    if (label == null) span.remove();
    else if (span.textContent !== label) span.textContent = label;
  });
}

function syncPostListSummary(card, rule, arrayId) {
  if (!rule || !["post_list_suites", "post_list_overrides"].includes(arrayId)) return;
  const hostLabels = (rule.hosts || [rule.host])
    .filter(Boolean)
    .map((host) => postListHosts.get(host) || host);
  const primary = arrayId === "post_list_suites" ? rule.title || "未命名组规则" : hostLabels[0] || "未设置页面";
  const hosts = arrayId === "post_list_suites" && hostLabels.length ? `适用 ${hostLabels.join("、")}` : null;
  setCardLabels(
    card,
    [
      primary,
      hosts,
      postListStyleModes.get(rule.list_style_mode || "inherit"),
      postListCoverModes.get(rule.cover_mode || "inherit"),
    ].filter((label) => label != null),
  );
}

function syncMenu(card, rule, menus) {
  const previous = card.querySelector("[data-sky-menu-summary]");
  if (rule?.override_menu !== true || rule.display === "off" || rule.display === false) {
    previous?.remove();
    return;
  }

  const name = menus.get(rule.dock_menu || "primary");
  const label = name ? `菜单 · ${name}` : "菜单已定制";
  if (previous) {
    if (previous.textContent !== label) previous.textContent = label;
    return;
  }

  const badge = card.ownerDocument.createElement("span");
  badge.setAttribute("data-sky-menu-summary", "");
  badge.textContent = label;
  card.append(badge);
}

export function mountSettingsArrays(form) {
  if (!form.querySelector(listSelector)) return;
  const { ownerDocument } = form;
  const listeners = new AbortController();
  const { signal } = listeners;
  let modalObserver;
  let modalFrame;
  let disposeModalOrder;
  let removeFrame;

  function syncCards() {
    const menus = new Map(
      (getNode("sky_dock_global_menu")?.props.options || []).map((option) => [option.value, option.label]),
    );
    for (const list of form.querySelectorAll(listSelector)) {
      const node = getNode(list.dataset.skySettingsArray);
      const rules = node?.value || [];
      const add = [...list.querySelectorAll('button[type="button"]')].find(
        (button) => button.textContent.trim() === node?.props.addLabel,
      );
      add?.setAttribute("data-sky-settings-array-add", "");
      add?.setAttribute("aria-haspopup", "dialog");
      list.querySelectorAll(cardSelector).forEach((card, index) => {
        if (!card.matches(editSelector)) {
          card.setAttribute("data-sky-settings-array-edit", "");
          card.setAttribute("role", "button");
          card.setAttribute("aria-haspopup", "dialog");
          card.tabIndex = 0;
        }
        if (list.hasAttribute("data-sky-dock-rules")) syncMenu(card, rules[index], menus);
        syncPostListSummary(card, rules[index], list.dataset.skySettingsArray);

        // Halo 2.27 mounts the remove glyph beside the editable item.
        const remove = card.nextElementSibling;
        if (!remove?.matches("svg[disabled]")) return;
        const title = [...card.querySelectorAll("span")].map((label) => label.textContent.trim()).find(Boolean);
        const disabled = remove.getAttribute("disabled") === "true";
        remove.setAttribute("data-sky-settings-array-remove", "");
        remove.setAttribute("role", "button");
        remove.setAttribute("aria-label", `删除 ${title || `第 ${index + 1} 项`}`);
        remove.setAttribute("aria-disabled", String(disabled));
        remove.setAttribute("tabindex", disabled ? "-1" : "0");
      });
    }
  }

  function stopWatchingDialog() {
    modalObserver?.disconnect();
    cancelAnimationFrame(modalFrame);
    modalObserver = undefined;
    disposeModalOrder?.();
    disposeModalOrder = undefined;
  }

  function watchDialog(trigger, list) {
    const index = [...list.querySelectorAll(cardSelector)].indexOf(trigger);
    let dialog;
    modalObserver = new MutationObserver(() => {
      if (!dialog) {
        dialog = ownerDocument.querySelector(editorSelector);
        if (dialog) disposeModalOrder = mountKeyboardOrder(dialog.querySelector("form"));
      }
      if (!dialog || dialog.isConnected) return;

      stopWatchingDialog();
      modalFrame = requestAnimationFrame(() => {
        if (!list.isConnected) return;
        syncCards();
        // Halo recreates the row when the edited rule changes.
        const cards = [...list.querySelectorAll(cardSelector)];
        const target = trigger.isConnected && !trigger.matches(":disabled") ? trigger : cards[index] || cards.at(-1);
        (target || list.querySelector(addSelector))?.focus();
      });
    });
    modalObserver.observe(ownerDocument.body, { subtree: true, childList: true });
    modalFrame = requestAnimationFrame(() => {
      if (!dialog) stopWatchingDialog();
    });
  }

  function focusAfterRemoval(trigger, list) {
    const cards = [...list.querySelectorAll(cardSelector)];
    const index = cards.indexOf(trigger.previousElementSibling);
    cancelAnimationFrame(removeFrame);
    removeFrame = requestAnimationFrame(() => {
      if (!list.isConnected) return;
      const remaining = [...list.querySelectorAll(cardSelector)];
      if (remaining.length >= cards.length) return;
      syncCards();
      const target = remaining[index] || remaining.at(-1) || list.querySelector(addSelector);
      target?.focus();
    });
  }

  form.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest(actions);
      const list = trigger?.closest(listSelector);
      if (!list) return;
      if (trigger.matches(removeSelector)) {
        if (trigger.getAttribute("aria-disabled") !== "true") focusAfterRemoval(trigger, list);
      } else if (!modalObserver) {
        watchDialog(trigger, list);
      }
    },
    { capture: true, signal },
  );

  form.addEventListener(
    "keydown",
    (event) => {
      if (!(event.target instanceof Element) || !["Enter", " "].includes(event.key)) return;
      if (!event.target.matches(`${editSelector}, ${removeSelector}[aria-disabled="false"]`)) return;
      event.preventDefault();
      if (!event.repeat) event.target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    },
    { signal },
  );
  form.addEventListener(
    "focusin",
    (event) => {
      if (!modalObserver && event.target instanceof Element && event.target.matches(actions)) {
        keepControlVisible(event.target);
      }
    },
    { signal },
  );

  const cardsObserver = new MutationObserver(syncCards);
  cardsObserver.observe(form, { childList: true, characterData: true, subtree: true });
  syncCards();
  const disposeOrder = mountKeyboardOrder(form);

  return () => {
    listeners.abort();
    cardsObserver.disconnect();
    disposeOrder?.();
    stopWatchingDialog();
    cancelAnimationFrame(removeFrame);
  };
}
