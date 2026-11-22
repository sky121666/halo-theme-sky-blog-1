import { getNode } from "@formkit/core";
import { computed, defineComponent, h, nextTick, ref } from "vue";
import { keepControlVisible } from "./settings-order.js";

export default defineComponent({
  props: { fieldId: String, label: String, help: String, selected: Array, options: Array },
  setup(props) {
    const list = ref(null);
    const picker = ref(null);
    const preview = ref(null);
    const announcement = ref("");
    const options = computed(() => props.options || []);
    const disabled = computed(() => getNode(props.fieldId)?.context?.disabled === true);
    const labels = computed(() => new Map(options.value.map(({ value, label }) => [value, label])));
    const selected = computed(() => {
      if (!Array.isArray(props.selected)) return [];
      const ids = props.selected.map((item) => (typeof item === "string" ? item : item?.id));
      return [...new Set(ids.filter((id) => labels.value.has(id)))];
    });
    const available = computed(() => options.value.filter(({ value }) => !selected.value.includes(value)));
    let drag;

    function update(order, index, control) {
      const field = getNode(props.fieldId);
      if (!field || disabled.value) return;
      void field.input(order, false);
      void nextTick(() => {
        const rows = list.value?.children;
        const row = rows?.[Math.min(index, rows.length - 1)];
        const target =
          control && row?.contains(control) && !control.disabled
            ? control
            : row?.querySelector(".sky-home-order-handle:enabled") || picker.value;
        if (!target) return;
        target.focus({ preventScroll: true });
        keepControlVisible(target);
      });
    }

    function move(from, to, control) {
      const order = selected.value.slice();
      if (disabled.value || from === to || from < 0 || to < 0 || to >= order.length) return;
      const [id] = order.splice(from, 1);
      order.splice(to, 0, id);
      announcement.value = `${labels.value.get(id)}移至第 ${to + 1} 项`;
      update(order, to, control);
    }

    function startDrag(event, id) {
      if (!event.isPrimary || event.button !== 0 || disabled.value || selected.value.length < 2) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag = { id, pointerId: event.pointerId, startY: event.clientY };
    }

    function dropPosition(event) {
      if (drag?.pointerId !== event.pointerId || Math.abs(event.clientY - drag.startY) < 4 || !list.value) return null;
      const { left, right } = list.value.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right) return null;
      const rows = Array.from(list.value.children);
      const rowIndex = rows.findIndex((row) => event.clientY <= row.getBoundingClientRect().bottom);
      return { from: selected.value.indexOf(drag.id), to: rowIndex < 0 ? rows.length - 1 : rowIndex };
    }

    function clearDrag(event) {
      if (drag?.pointerId !== event.pointerId) return;
      drag = undefined;
      preview.value = null;
    }

    function finishDrag(event) {
      const drop = dropPosition(event);
      clearDrag(event);
      if (drop) move(drop.from, drop.to, event.currentTarget);
    }

    function renderRow(id, index) {
      const label = labels.value.get(id);
      const drop = preview.value;
      const makeButton = (text, title, unavailable, onClick) =>
        h(
          "button",
          {
            type: "button",
            title,
            "aria-label": title,
            disabled: disabled.value || unavailable,
            onClick,
          },
          text,
        );

      return h(
        "li",
        {
          key: id,
          class: "sky-home-order-row",
          "data-module": id,
          "data-dragging": drop?.from === index ? "" : undefined,
          "data-drop": drop?.to === index && drop.from !== index ? (drop.from < index ? "after" : "before") : undefined,
        },
        [
          h("button", {
            type: "button",
            class: "sky-home-order-handle",
            disabled: disabled.value || selected.value.length < 2,
            title: `拖动 ${label}`,
            "aria-label": `排序 ${label}`,
            "aria-keyshortcuts": "Alt+ArrowUp Alt+ArrowDown",
            onPointerdown: (event) => startDrag(event, id),
            onPointermove: (event) => {
              if (drag?.pointerId === event.pointerId) preview.value = dropPosition(event);
            },
            onPointerup: finishDrag,
            onPointercancel: clearDrag,
            onLostpointercapture: clearDrag,
            onKeydown: (event) => {
              if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
              if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
              event.preventDefault();
              if (!event.repeat) move(index, index + (event.key === "ArrowUp" ? -1 : 1), event.currentTarget);
            },
          }),
          h("span", label),
          h("div", { class: "sky-home-order-actions" }, [
            makeButton("↑", `上移 ${label}`, index === 0, (event) => move(index, index - 1, event.currentTarget)),
            makeButton("↓", `下移 ${label}`, index === selected.value.length - 1, (event) =>
              move(index, index + 1, event.currentTarget),
            ),
            makeButton("×", `移除 ${label}`, false, () => {
              const order = selected.value.filter((item) => item !== id);
              update(order, index);
            }),
          ]),
        ],
      );
    }

    return () =>
      h(
        "div",
        {
          class: "sky-home-module-order",
          role: "group",
          "aria-labelledby": `${props.fieldId}-label`,
          "aria-describedby": `${props.fieldId}-help`,
        },
        [
          h("p", { id: `${props.fieldId}-label`, class: "sky-home-order-label" }, props.label),
          h("ol", { class: "sky-home-order-list", ref: list }, selected.value.map(renderRow)),
          available.value.length
            ? h(
                "select",
                {
                  ref: picker,
                  value: "",
                  disabled: disabled.value,
                  class: "sky-home-order-add",
                  "aria-label": "添加首页模块",
                  onChange: (event) => {
                    const id = event.target.value;
                    event.target.value = "";
                    if (!id || selected.value.includes(id)) return;
                    update([...selected.value, id], selected.value.length);
                  },
                },
                [
                  h("option", { value: "", disabled: true }, "添加模块"),
                  ...available.value.map(({ value, label }) => h("option", { value, key: value }, label)),
                ],
              )
            : null,
          h("p", { id: `${props.fieldId}-help`, class: "sky-settings-order-help" }, props.help),
          h("span", { class: "sr-only", role: "status" }, announcement.value),
        ],
      );
  },
});
