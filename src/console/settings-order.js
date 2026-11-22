import { getNode } from "@formkit/core";

const choicesSelector = "[data-sky-settings-choices]";
const listSelector = `[data-sky-settings-array], ${choicesSelector}`;
const itemSelector = "[data-sky-settings-order-item]";
const chipSelector = ".select-container .overflow-item:has(.select-item)";
const cardSelector = "[data-sky-settings-array-edit]";

export function keepControlVisible(control) {
  if (!control.getClientRects().length) return;
  const { left, width, top, bottom } = control.getBoundingClientRect();
  const hit = (y) => control.contains(control.ownerDocument.elementFromPoint(left + width / 2, y));
  if (!hit(top + 1) || !hit(bottom - 1)) {
    control.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  }
}

function readOrder(list) {
  const choicesId = list.dataset.skySettingsChoices;
  const id = choicesId || list.dataset.skySettingsArray;
  const node = getNode(id);
  const items = [...list.querySelectorAll(choicesId ? chipSelector : cardSelector)];
  // A select can omit a saved value absent from its options.
  const sortable =
    Array.isArray(node?.value) && node.value.length === items.length && items.length > 1 && !node.props.disabled;
  return { id, node, items, choices: !!choicesId, sortable };
}

function syncOrder(list) {
  const { id, items, choices, sortable } = readOrder(list);
  const helpId = `${id}-keyboard-order`;
  const previousHelp = list.querySelector(":scope > .sky-settings-order-help");
  if (sortable && !previousHelp) {
    const help = list.ownerDocument.createElement("p");
    help.id = helpId;
    help.className = "sky-settings-order-help";
    help.textContent = choices ? "← / → 切换已选项，Alt + ↑ / ↓ 排序。" : "聚焦条目后按 Alt + ↑ / ↓ 排序。";
    list.append(help);
  } else if (!sortable) {
    previousHelp?.remove();
  }

  const tabStop = items.find((item) => item.tabIndex === 0) || items[0];
  if (choices && items.length) items[0].parentElement.setAttribute("role", "list");

  items.forEach((item, index) => {
    item.toggleAttribute("data-sky-settings-order-item", sortable);
    if (sortable) {
      item.setAttribute("aria-describedby", helpId);
      item.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
    } else if (item.getAttribute("aria-describedby") === helpId) {
      item.removeAttribute("aria-describedby");
      item.removeAttribute("aria-keyshortcuts");
    }
    if (choices) {
      item.setAttribute("role", "listitem");
      item.tabIndex = sortable && item === tabStop ? 0 : -1;
      const label = item.querySelector(".select-item").textContent.trim();
      item.setAttribute("aria-label", `${label}，第 ${index + 1} 项，共 ${items.length} 项`);
    }
  });
}

export function mountKeyboardOrder(root) {
  if (!root) return;
  const controller = new AbortController();
  const { signal } = controller;
  let frame;

  function moveFocus(list, index) {
    const { choices, items } = readOrder(list);
    const item = items[index];
    if (!item || !list.isConnected) return;
    if (choices)
      items.forEach((choice) => {
        choice.tabIndex = choice === item ? 0 : -1;
      });
    item.focus({ preventScroll: true });
    keepControlVisible(item);
  }

  root.addEventListener(
    "focusout",
    (event) => {
      const next = event.relatedTarget;
      if (!(next instanceof HTMLElement) || !next.matches(itemSelector)) return;
      // Halo redirects internal select focus to its search input. Keep chip navigation on the selected option.
      if (next.closest(choicesSelector)?.contains(event.target)) event.stopPropagation();
    },
    { capture: true, signal },
  );

  root.addEventListener(
    "keydown",
    (event) => {
      const item = event.target;
      if (
        !(item instanceof HTMLElement) ||
        !item.matches(itemSelector) ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const list = item.closest(listSelector);
      const { items, node, choices, sortable } = readOrder(list);
      if (!sortable) return;
      const sort = event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key);
      const navigate = choices && !event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key);
      if (!sort && !navigate) return;

      event.preventDefault();
      event.stopPropagation();
      const index = items.indexOf(item);
      const previous = event.key === "ArrowUp" || event.key === "ArrowLeft";
      const next = index + (previous ? -1 : 1);
      if (index < 0 || next < 0 || next >= items.length || (sort && event.repeat)) return;
      cancelAnimationFrame(frame);
      if (navigate) {
        moveFocus(list, next);
        return;
      }
      const value = node.value.slice();
      const [moved] = value.splice(index, 1);
      value.splice(next, 0, moved);
      void node.input(value, false);
      frame = requestAnimationFrame(() => {
        if (!list.isConnected) return;
        syncOrder(list);
        moveFocus(list, next);
      });
    },
    { capture: true, signal },
  );

  const sync = () => root.querySelectorAll(listSelector).forEach(syncOrder);
  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  sync();
  return () => {
    controller.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
