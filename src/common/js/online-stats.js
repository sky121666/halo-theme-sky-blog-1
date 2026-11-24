const API = "/apis/online-user.zyx2012.cn/v1alpha1/stats";
const refreshInterval = 30_000;
const requests = new Map();
const routeTitles = new Map([
  ["/", "首页"],
  ["/archives", "归档"],
  ["/categories", "分类"],
  ["/tags", "标签"],
  ["/links", "友链"],
  ["/moments", "瞬间"],
  ["/photos", "相册"],
  ["/docs", "文档"],
  ["/about", "关于"],
  ["/douban", "豆瓣"],
  ["/bangumis", "追番"],
  ["/equipments", "装备"],
  ["/steam", "Steam"],
]);

function refreshAfter(response, failures) {
  const now = Date.now();
  const retryAfter = response?.headers.get("Retry-After")?.trim();
  const retryAt = !retryAfter ? 0 : /^\d+$/.test(retryAfter)
    ? now + Number(retryAfter) * 1000
    : Date.parse(retryAfter);
  const backoff = Math.min(refreshInterval * 2 ** (failures - 1), 5 * 60_000);
  return Math.max(now + backoff, retryAt || 0);
}

function readStats(path) {
  let entry = requests.get(path);
  if (!entry) {
    entry = { data: null, refreshAt: 0, pending: null, failures: 0 };
    requests.set(path, entry);
  }
  if (entry.pending) return entry.pending;
  const startedAt = Date.now();
  if (startedAt < entry.refreshAt) return Promise.resolve(entry.data);

  entry.pending = (async () => {
    try {
      const response = await fetch(path, { signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        entry.data = await response.json();
        entry.failures = 0;
        entry.refreshAt = startedAt + refreshInterval;
      } else {
        entry.refreshAt = refreshAfter(response, ++entry.failures);
      }
    } catch {
      entry.refreshAt = refreshAfter(null, ++entry.failures);
    }
    return entry.data;
  })().finally(() => { entry.pending = null; });
  return entry.pending;
}

function titleFor(page) {
  if (typeof page.title === "string" && page.title.trim()) return page.title.trim();
  const pathname = page.uri.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  const known = routeTitles.get(pathname);
  if (known) return known;
  if (pathname === location.pathname.replace(/\/$/, "") && document.title) return document.title;
  const slug = pathname.split("/").pop();
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function onlineStats() {
  return {
    loading: true,
    error: false,
    total: 0,
    peak24h: 0,
    activePages: 0,
    wsActive: false,
    updatedAt: "",
    hotPages: [],
    showHotPages: true,
    _timer: null,
    _refresh: null,
    _destroyed: false,

    init() {
      this.showHotPages = this.$el.dataset.showHotPages !== "false";
      this._refresh = () => {
        if (!document.hidden) void this.loadData();
      };
      document.addEventListener("visibilitychange", this._refresh);
      this._refresh();
      this._timer = setInterval(this._refresh, refreshInterval);
    },

    destroy() {
      this._destroyed = true;
      document.removeEventListener("visibilitychange", this._refresh);
      clearInterval(this._timer);
    },

    async loadData() {
      const [summary, stats] = await Promise.all([
        readStats(`${API}/summary`),
        this.showHotPages ? readStats(API) : null,
      ]);
      if (this._destroyed) return;
      this.loading = false;
      this.error = !summary;
      if (!summary) return;

      this.total = summary.total || 0;
      this.peak24h = summary.peak24h || 0;
      this.activePages = summary.activePages || 0;
      this.wsActive = summary.wsActive ?? false;
      if (summary.updatedAt) {
        const date = new Date(summary.updatedAt);
        this.updatedAt = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      }
      if (Array.isArray(stats)) {
        this.hotPages = stats
          .filter((page) => page?.count > 0 && typeof page.uri === "string")
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map((page) => ({ ...page, title: titleFor(page) }));
      }
    },
  };
}
