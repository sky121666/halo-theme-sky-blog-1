import "./douban.css";
import { skyDebug } from "../../common/js/debug.js";
import { notifySwupPageReady, registerPageLifecycle } from "../../common/js/page-runtime.js";

const API_BASE = "/apis/api.douban.moony.la/v1alpha1/doubanmovies";
const QUERY_KEYS = ["dataType", "genre", "page", "size", "type", "status"];
const JAVA_INT_MAX = 2147483647;
const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 20;
const VALID_STATUSES = new Set(["done", "doing", "mark"]);
const TYPE_ICONS = {
  movie: "icon-[heroicons--film]",
  book: "icon-[heroicons--book-open]",
  music: "icon-[heroicons--musical-note]",
  game: "icon-[heroicons--puzzle-piece]",
  drama: "icon-[heroicons--sparkles]",
};

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function normalizeListResult(data) {
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    page: Number(data?.page || 1),
    totalPages: Number(data?.totalPages || 1),
    total: Number(data?.total || 0),
    hasPrevious: Boolean(data?.hasPrevious),
    hasNext: Boolean(data?.hasNext),
  };
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function appendMeta(meta, value) {
  if (!value) return;
  meta.appendChild(createEl("span", "", String(value)));
}

function createFilterButton({ label, value, filter, active, icon, count, extraClass = "" }) {
  const button = createEl("button", `douban-filter-item ${extraClass}${active ? " active" : ""}`.trim());
  button.type = "button";
  button.dataset.doubanFilter = filter;
  button.dataset.value = value || "";

  if (icon) {
    button.appendChild(createEl("span", `douban-type-icon ${icon}`));
  }

  button.appendChild(createEl("span", "", label));

  if (count != null) {
    button.appendChild(createEl("span", "douban-filter-count", String(count)));
  }

  return button;
}

function normalizeGenre(genre) {
  if (typeof genre === "string") {
    return {
      name: genre,
      doubanCount: null,
    };
  }

  return {
    name: genre?.name || "",
    doubanCount: genre?.doubanCount,
  };
}

function createCard(item, signal) {
  const spec = item?.spec || {};
  const faves = item?.faves || {};
  const article = createEl("article", "douban-card-wrap");
  const link = createEl("a", "douban-card");
  link.href = spec.link || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const cover = createEl("div", "douban-cover");
  if (spec.poster) {
    const img = document.createElement("img");
    img.src = spec.poster;
    img.alt = spec.name || "豆瓣条目";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    if (img.complete && img.naturalHeight !== 0) img.classList.add("loaded");
    img.addEventListener("load", () => img.classList.add("loaded"), { once: true, signal });
    img.addEventListener("error", () => img.classList.add("load-error"), { once: true, signal });
    cover.appendChild(img);
  }

  const placeholder = createEl("div", "douban-cover-placeholder");
  placeholder.appendChild(createEl("span", "icon-[heroicons--photo] h-8 w-8"));
  cover.appendChild(placeholder);

  if (spec.score != null && spec.score !== "") {
    cover.appendChild(createEl("span", "douban-score", String(spec.score)));
  }

  if (spec.type) {
    cover.appendChild(createEl("span", "douban-type-badge", spec.type));
  }

  const info = createEl("div", "douban-info");
  info.appendChild(createEl("h2", "douban-name", spec.name || "未命名条目"));

  const meta = createEl("div", "douban-meta");
  appendMeta(meta, spec.year);
  appendMeta(meta, spec.dataType);
  appendMeta(meta, formatDate(faves.createTime));
  if (meta.children.length > 0) info.appendChild(meta);

  if (spec.cardSubtitle) {
    info.appendChild(createEl("p", "douban-card-subtitle", spec.cardSubtitle));
  }

  if (faves.remark) {
    info.appendChild(createEl("p", "douban-remark", faves.remark));
  }

  link.append(cover, info);
  article.appendChild(link);
  return article;
}

function setHidden(el, hidden) {
  if (el) el.hidden = hidden;
}

function buildUrl(path, params) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, value);
  });
  return url;
}

function parseBoundedPositiveInteger(value, fallback, max) {
  if (value == null || value === "") return { value: fallback, normalized: false };

  const raw = String(value);
  if (!/^[1-9]\d*$/.test(raw)) return { value: fallback, normalized: true };

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed > max) return { value: fallback, normalized: true };
  return { value: parsed, normalized: false };
}

function maxPageForSize(size) {
  return Math.floor(JAVA_INT_MAX / size) + 1;
}

function readQueryState(defaultSize) {
  const params = new URL(window.location.href).searchParams;
  const sizeResult = parseBoundedPositiveInteger(params.get("size"), defaultSize, MAX_PAGE_SIZE);
  const pageResult = parseBoundedPositiveInteger(params.get("page"), 1, maxPageForSize(sizeResult.value));
  const requestedStatus = params.get("status") || "done";
  const status = VALID_STATUSES.has(requestedStatus) ? requestedStatus : "done";

  return {
    state: {
      dataType: params.get("dataType") || "",
      genre: params.get("genre") || "",
      page: pageResult.value,
      size: sizeResult.value,
      type: params.get("type") || "",
      status,
    },
    normalized: sizeResult.normalized || pageResult.normalized || status !== requestedStatus,
  };
}

function isSameQueryState(current, next) {
  return QUERY_KEYS.every((key) => current[key] === next[key]);
}

function syncQueryState(state, method = "push") {
  const url = new URL(window.location.href);
  QUERY_KEYS.forEach((key) => {
    const value = state[key];
    if (value == null || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(value));
    }
  });

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return;

  const nextHistoryState = {
    ...(window.history.state || {}),
    url: nextUrl,
    skyDouban: { ...state },
  };
  window.history[method === "replace" ? "replaceState" : "pushState"](nextHistoryState, "", nextUrl);
}

function initDoubanPage() {
  const root = document.querySelector(".douban-page");
  if (!root) return;

  const controller = new AbortController();
  const { signal } = controller;
  const pagePathname = window.location.pathname;
  const pageSize = parseBoundedPositiveInteger(root.dataset.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE).value;
  const initialQuery = readQueryState(pageSize);
  const state = initialQuery.state;
  let itemsRequest = null;
  let genresRequest = null;

  const els = {
    total: root.querySelector("[data-douban-total]"),
    types: root.querySelector("[data-douban-types]"),
    genres: root.querySelector("[data-douban-genres]"),
    grid: root.querySelector("[data-douban-grid]"),
    loading: root.querySelector("[data-douban-loading]"),
    empty: root.querySelector("[data-douban-empty]"),
    error: root.querySelector("[data-douban-error]"),
    errorTitle: root.querySelector("[data-douban-error-title]"),
    errorDescription: root.querySelector("[data-douban-error-description]"),
    reset: root.querySelector("[data-douban-reset]"),
    pagination: root.querySelector("[data-douban-pagination]"),
    pageInfo: root.querySelector("[data-douban-page-info]"),
    prev: root.querySelector("[data-douban-prev]"),
    next: root.querySelector("[data-douban-next]"),
  };

  const updateButtons = () => {
    root.querySelectorAll("[data-douban-filter]").forEach((button) => {
      const filter = button.dataset.doubanFilter;
      const value = button.dataset.value || "";
      button.classList.toggle("active", (state[filter] || "") === value);
    });
  };

  const renderItems = (result) => {
    els.grid.replaceChildren(...result.items.map((item) => createCard(item, signal)));
    if (els.total) els.total.textContent = String(result.total);
    if (els.pageInfo) els.pageInfo.textContent = `${result.page} / ${Math.max(result.totalPages, 1)}`;
    if (els.prev) els.prev.disabled = !result.hasPrevious;
    if (els.next) els.next.disabled = !result.hasNext;
    setHidden(els.grid, result.items.length === 0);
    setHidden(els.empty, result.items.length > 0);
    setHidden(els.pagination, result.totalPages <= 1);
  };

  const renderError = (error) => {
    const status = Number(error?.status || 0);
    let title = "豆瓣数据加载失败";
    let description = "暂时无法连接豆瓣服务，请稍后重试。";
    let canReset = false;

    if (status === 400 || status === 404) {
      title = "筛选条件不可用";
      description = "当前筛选条件无法被插件处理，可恢复默认筛选后重试。";
      canReset = true;
    } else if (status >= 500) {
      title = "豆瓣插件服务异常";
      description = "插件接口返回服务错误；主题已拦截非法分页参数，请检查插件日志或稍后重试。";
    }

    if (els.errorTitle) els.errorTitle.textContent = title;
    if (els.errorDescription) els.errorDescription.textContent = description;
    setHidden(els.reset, !canReset);
    setHidden(els.grid, true);
    setHidden(els.empty, true);
    setHidden(els.pagination, true);
    setHidden(els.error, false);
    skyDebug.warn("douban", "列表加载失败", { status, error });
  };

  const loadItems = async () => {
    itemsRequest?.abort();
    const request = new AbortController();
    itemsRequest = request;
    const query = { ...state };

    setHidden(els.loading, false);
    setHidden(els.error, true);

    try {
      const response = await fetch(buildUrl(API_BASE, query), { signal: request.signal });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      const result = normalizeListResult(await response.json());
      if (signal.aborted || request.signal.aborted || itemsRequest !== request) return;
      renderItems(result);
      state.page = result.page;
      if (result.page !== query.page) syncQueryState(state, "replace");
    } catch (error) {
      if (signal.aborted || request.signal.aborted || itemsRequest !== request) return;
      renderError(error);
    } finally {
      if (itemsRequest === request) {
        itemsRequest = null;
        if (!signal.aborted) setHidden(els.loading, true);
      }
    }
  };

  const loadGenres = async () => {
    genresRequest?.abort();
    const request = new AbortController();
    genresRequest = request;
    const type = state.type;

    try {
      const response = await fetch(buildUrl(`${API_BASE}/-/genres`, { type }), { signal: request.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const genres = await response.json();
      if (signal.aborted || request.signal.aborted || genresRequest !== request) return;
      const buttons = [
        createFilterButton({
          label: "全部题材",
          value: "",
          filter: "genre",
          active: state.genre === "",
          extraClass: "douban-genre-item",
        }),
        ...(Array.isArray(genres) ? genres : [])
          .map(normalizeGenre)
          .filter((genre) => genre.name)
          .map((genre) =>
            createFilterButton({
              label: genre.name,
              value: genre.name,
              filter: "genre",
              active: state.genre === genre.name,
              count: genre.doubanCount,
              extraClass: "douban-genre-item",
            }),
          ),
      ];
      els.genres.replaceChildren(...buttons);
      setHidden(els.genres, buttons.length <= 1);
    } catch {
      if (!signal.aborted && !request.signal.aborted && genresRequest === request) {
        setHidden(els.genres, true);
      }
    } finally {
      if (genresRequest === request) genresRequest = null;
    }
  };

  const loadTypes = async () => {
    try {
      const response = await fetch(`${API_BASE}/-/types`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const types = await response.json();
      if (signal.aborted) return;
      const buttons = [
        createFilterButton({
          label: "全部",
          value: "",
          filter: "type",
          active: state.type === "",
          icon: "icon-[heroicons--squares-2x2]",
        }),
        ...(Array.isArray(types) ? types : []).map((type) =>
          createFilterButton({
            label: type.name,
            value: type.key,
            filter: "type",
            active: state.type === type.key,
            icon: TYPE_ICONS[type.key] || "icon-[heroicons--sparkles]",
            count: type.doubanCount,
          }),
        ),
      ];
      els.types.replaceChildren(...buttons);
    } catch {
      // 保留静态“全部”按钮。
    }
  };

  const restoreQueryState = () => {
    if (signal.aborted || window.location.pathname !== pagePathname) return;
    const nextQuery = readQueryState(pageSize);
    const nextState = nextQuery.state;
    if (nextQuery.normalized) syncQueryState(nextState, "replace");
    if (isSameQueryState(state, nextState)) return;
    Object.assign(state, nextState);
    updateButtons();
    loadGenres();
    loadItems();
  };

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-douban-retry]")) {
      loadItems();
      return;
    }

    if (target.closest("[data-douban-reset]")) {
      Object.assign(state, {
        dataType: "",
        genre: "",
        page: 1,
        size: pageSize,
        type: "",
        status: "done",
      });
      syncQueryState(state, "replace");
      updateButtons();
      loadGenres();
      loadItems();
      return;
    }

    const filterButton = target.closest("[data-douban-filter]");
    if (filterButton) {
      const filter = filterButton.dataset.doubanFilter;
      state[filter] = filterButton.dataset.value || "";
      state.page = 1;
      if (filter === "type") state.genre = "";
      updateButtons();
      syncQueryState(state);
      if (filter === "type") loadGenres();
      loadItems();
      return;
    }

    if (target.closest("[data-douban-prev]") && state.page > 1) {
      state.page -= 1;
      syncQueryState(state);
      loadItems();
      return;
    }

    if (target.closest("[data-douban-next]")) {
      if (state.page >= maxPageForSize(state.size)) return;
      state.page += 1;
      syncQueryState(state);
      loadItems();
    }
  }, { signal });

  window.addEventListener("popstate", restoreQueryState, { signal });

  if (initialQuery.normalized) {
    syncQueryState(state, "replace");
    skyDebug.event("douban", "query:normalized", { page: state.page, size: state.size, status: state.status });
  }
  updateButtons();
  loadTypes();
  loadGenres();
  loadItems();

  return () => {
    controller.abort();
    itemsRequest?.abort();
    genresRequest?.abort();
    itemsRequest = null;
    genresRequest = null;
  };
}

registerPageLifecycle(initDoubanPage, { entry: "douban" });
notifySwupPageReady();
