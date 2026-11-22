import { getNode, stopWatch, watchRegistry } from "@formkit/core";
import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { SkyBlogHomeContentStatus, SkyBlogHomeTabOptions } from "./home-content-settings.js";
import SkyBlogHomeModuleOrder from "./home-module-order.js";
import { mountSettingsArrays } from "./settings-arrays.js";
import { keepControlVisible } from "./settings-order.js";
import "./settings.css";

const revealSelector = "[data-sky-settings-reveal]";
const validationEvents = [
  "message-added.deep",
  "message-removed.deep",
  "message-updated.deep",
  "childRemoved.deep",
  "settled:blocking",
];

function invalidFields(form, root) {
  const fields = [];
  root.walk((node) => {
    if (node.context?.state.valid !== false) return;
    const input = form.ownerDocument.getElementById(node.props.id);
    if (!input || !form.contains(input)) return;

    const steps = [];
    let section;
    let fallback;
    for (
      let branch = input.closest(revealSelector);
      branch && form.contains(branch);
      branch = branch.parentElement?.closest(revealSelector)
    ) {
      steps.unshift(branch.dataset.skySettingsReveal);
      section ||= branch.dataset.skySettingsSection;
      if (branch.dataset.skySettingsFallback) {
        fallback = { step: branch.dataset.skySettingsFallback, focus: branch.dataset.skySettingsFallbackFocus };
      }
    }
    if (!steps.length) return;

    const messages = Object.values(node.store).filter((message) => message.type === "validation" && message.blocking);
    if (!messages.length) return;
    fields.push({
      id: input.id,
      steps: steps.join(" ").split(/\s+/),
      section,
      fallback,
      messages: messages.map((message) => message.value),
    });
  });
  return fields;
}

async function activate(step) {
  const [id, option] = step.split(":");
  const control = getNode(id);
  if (!control || (option && !control.props.options?.some((item) => item.value === option))) return false;
  const value = option || true;
  if (control.value !== value) {
    await control.input(value, false);
    await nextTick();
  }
  return true;
}

function focusInput(input) {
  if (!input) return;
  for (let details = input.closest("details"); details; details = details.parentElement?.closest("details")) {
    details.open = true;
  }
  input.focus({ preventScroll: true });
  keepControlVisible(input);
}

const SkyBlogSettingsDisclosure = defineComponent({
  props: { stateId: String, label: String, expanded: Boolean },
  emits: ["toggle"],
  setup(props, { emit }) {
    return () =>
      h(
        "button",
        {
          type: "button",
          class: "sky-settings-disclosure",
          "aria-expanded": String(props.expanded),
          onFocus: (event) => keepControlVisible(event.currentTarget),
          onClick: () => {
            if (props.stateId) {
              const state = getNode(props.stateId);
              if (state) void state.input(state.value !== true, false);
            }
            emit("toggle");
          },
        },
        props.label,
      );
  },
});

const SkyBlogSettingsRules = defineComponent({
  props: {
    sectionId: { type: String, required: true },
    title: { type: String, default: "场景规则定制" },
    description: String,
    listLabel: { type: String, default: "规则列表" },
    emptyText: { type: String, default: "暂无规则，使用全站默认。" },
    priority: String,
    count: Number,
  },
  setup(props, { slots }) {
    const expanded = ref(true);
    const descriptionId = `${props.sectionId}-description`;
    const listId = `${props.sectionId}-list`;

    return () => {
      const hasRules = props.count > 0;
      return h("fieldset", { class: "sky-settings-rules" }, [
        h("legend", { class: "sky-settings-group-title" }, props.title),
        h("p", { class: "sky-settings-note", id: descriptionId }, props.description),
        hasRules &&
          h(SkyBlogSettingsDisclosure, {
            label: `${props.listLabel} · ${props.count} 条`,
            expanded: expanded.value,
            "aria-controls": listId,
            "aria-describedby": descriptionId,
            onToggle: () => (expanded.value = !expanded.value),
          }),
        !hasRules && h("p", { class: "sky-settings-note sky-settings-rule-empty" }, props.emptyText),
        h("div", { class: "sky-settings-rule-list", id: listId, hidden: hasRules && !expanded.value }, [
          hasRules && props.priority && h("p", { class: "sky-settings-note" }, props.priority),
          slots.default?.(),
        ]),
      ]);
    };
  },
});

const SkyBlogHomeLayoutNotice = defineComponent({
  props: { selected: Array, options: Array, enabled: Object },
  setup(props) {
    return () => {
      const options = props.options || [];
      const selected = new Set((props.selected || []).map((module) => module?.id || module));
      const missing = options
        .filter(({ value }) => props.enabled?.[value] && !selected.has(value))
        .map(({ label }) => label);
      const text = options.some(({ value }) => selected.has(value))
        ? missing.length && `${missing.join("、")}已开启，尚未加入布局。`
        : "请添加要显示的模块，或关闭自定义排序。";
      return text ? h("p", { role: "status", class: "sky-settings-note" }, text) : null;
    };
  },
});

function mountCategoryNavigationPreview() {
  const id = "sky_category_navigation_style";
  let unsubscribe;

  function bind(node) {
    unsubscribe?.();
    unsubscribe = undefined;
    const options = node?.props.options;
    if (!Array.isArray(options)) return;
    let displayedFallback = "pills";

    function sync() {
      const value = node.value;
      // The public template renders pills for unknown values. Show that choice without editing the saved value.
      const fallback = typeof value === "string" && !options.some((option) => option.value === value) ? value : "pills";
      if (fallback === displayedFallback) return;
      displayedFallback = fallback;
      node.props.options = options.map((option) => (option.value === "pills" ? { ...option, value: fallback } : option));
    }

    const receipt = node.on("commit", sync);
    unsubscribe = () => node.off(receipt);
    sync();
  }

  const registry = watchRegistry(id, (event) => bind(event.payload));
  bind(getNode(id));
  return () => {
    stopWatch(registry);
    unsubscribe?.();
  };
}

const SkyBlogSettingsFeedback = defineComponent({
  setup() {
    const anchor = ref(null);
    const fields = ref([]);
    const notice = ref("");
    let form;
    let dispose;
    let mounted = false;

    onMounted(() => {
      form = anchor.value.closest("form");
      // A field named "id" can shadow HTMLFormElement.id.
      const id = form?.getAttribute("id");
      if (!id) return;

      mounted = true;
      let root;
      let receipts = [];
      let queued = false;
      const refresh = () => {
        if (queued) return;
        queued = true;
        void nextTick(() => {
          queued = false;
          if (!mounted) return;
          fields.value = root ? invalidFields(form, root) : [];
          if (!fields.value.length) notice.value = "";
        });
      };

      function bindRoot(node) {
        receipts.forEach((receipt) => root.off(receipt));
        root = node;
        receipts = root ? validationEvents.map((event) => root.on(event, refresh)) : [];
        refresh();
      }

      const registry = watchRegistry(id, (event) => bindRoot(event.payload));
      bindRoot(getNode(id));
      let disposeCards;
      let disposeCategoryPreview;
      void nextTick(() => {
        if (!mounted) return;
        disposeCards = mountSettingsArrays(form);
        if (id === "pages") disposeCategoryPreview = mountCategoryNavigationPreview();
      });
      dispose = () => {
        stopWatch(registry);
        bindRoot(undefined);
        disposeCards?.();
        disposeCategoryPreview?.();
      };
    });

    onBeforeUnmount(() => {
      mounted = false;
      dispose?.();
    });

    async function locate(field) {
      notice.value = "";
      for (const step of field.steps) {
        if (!mounted) return;
        if (await activate(step)) continue;

        if (field.fallback && (await activate(field.fallback.step)) && mounted) {
          notice.value = "请先开启对应的设置入口，再定位出错字段。";
          focusInput(form.querySelector(field.fallback.focus));
        }
        return;
      }
      if (mounted) focusInput(form.ownerDocument.getElementById(field.id));
    }

    return () =>
      h(
        "div",
        {
          ref: anchor,
          role: "status",
          "data-sky-settings-feedback": "",
          class: { "sky-settings-errors": fields.value.length },
        },
        fields.value.length
          ? [
              h("p", { class: "sky-settings-errors-heading" }, "修正以下设置后可保存"),
              h(
                "ul",
                fields.value.map((field) =>
                  h("li", { key: field.id }, [
                    h(
                      "button",
                      { type: "button", onClick: () => locate(field) },
                      [field.section, field.messages.join(" ")].filter(Boolean).join(" · "),
                    ),
                  ]),
                ),
              ),
              notice.value && h("p", { class: "sky-settings-errors-notice" }, notice.value),
            ]
          : [],
      );
  },
});

export default {
  components: {
    SkyBlogHomeContentStatus,
    SkyBlogHomeLayoutNotice,
    SkyBlogHomeModuleOrder,
    SkyBlogHomeTabOptions,
    SkyBlogSettingsDisclosure,
    SkyBlogSettingsFeedback,
    SkyBlogSettingsRules,
  },
};
