// Shiki's extra-path module registers an anonymous, document-lifetime listener.
// Page-specific inline configuration from other plugins must still replay.
function shikiBootstrapSource(script) {
  if (script.src || script.type !== "module") return null;
  const source = script.textContent?.trim() || "";
  return /\bimport\s*\{\s*renderCodeBlock\s*\}\s*from\s*(['"])\/plugins\/shiki\/assets\/static\/shiki-code\.js(?:\?[^'"]*)?\1/.test(
    source,
  )
    ? source
    : null;
}

let nextBootstrapId = 0;

export function createPluginScriptLifecycle({
  initialScripts = [],
  isShikiReady = () => typeof customElements !== "undefined" && Boolean(customElements.get("shiki-code")),
  completionTarget = typeof window === "undefined" ? null : window,
  onLateReady = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let bootstrap = null;
  const pending = new Set();

  for (const script of initialScripts) {
    const source = shikiBootstrapSource(script);
    if (!source) continue;
    // The initial module may have failed before this footer module could attach
    // an error listener. Without its registered element, only a fresh document
    // can safely recover; do not permanently skip an unconfirmed bootstrap.
    const initial = { source, uncertain: !isShikiReady() };
    bootstrap = initial;
    script.addEventListener(
      "load",
      () => {
        initial.uncertain = false;
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        if (bootstrap === initial) bootstrap = null;
      },
      { once: true },
    );
  }

  return {
    requiresReload(incomingDocument) {
      const sources = Array.from(incomingDocument?.querySelectorAll('script[type="module"]:not([src])') || [])
        .map(shikiBootstrapSource)
        .filter(Boolean);
      // The anonymous official listener has no destroy API. Crossing out of its
      // configured paths must drop the document so it cannot process other pages.
      return Boolean(
        bootstrap &&
        (sources.length === 0 || sources.some((source) => bootstrap.uncertain || source !== bootstrap.source)),
      );
    },

    prepare(script) {
      const source = shikiBootstrapSource(script);
      if (!source) return { skip: false };
      if (bootstrap) return { skip: true };

      const registration = { source, uncertain: false };
      bootstrap = registration;
      return {
        skip: false,
        track(replacement) {
          let settle;
          const ready = new Promise((resolve) => {
            settle = resolve;
          });
          pending.add(ready);
          let waitFinished = false;
          let settled = false;
          let timedOut = false;
          let timer;
          const completionEvent = `sky:shiki-bootstrap-ready:${++nextBootstrapId}`;
          const finishWait = () => {
            if (waitFinished) return;
            waitFinished = true;
            pending.delete(ready);
            settle();
          };
          const complete = (failed) => {
            if (settled) return;
            settled = true;
            clearTimer(timer);
            completionTarget?.removeEventListener(completionEvent, onComplete);
            replacement.removeEventListener("error", onError);
            registration.uncertain = false;
            if (failed && bootstrap === registration) bootstrap = null;
            finishWait();
            if (!failed && timedOut && bootstrap === registration) onLateReady();
          };
          const onComplete = () => complete(false);
          const onError = () => complete(true);
          completionTarget?.addEventListener(completionEvent, onComplete, { once: true });
          replacement.addEventListener("error", onError, { once: true });
          // Inline modules do not emit script.load. Signal after the original
          // module body (including top-level await) registers its listener.
          // Keep the original source in registration for configuration matching.
          replacement.textContent += `\n;window.dispatchEvent(new Event(${JSON.stringify(completionEvent)}));`;
          timer = setTimer(() => {
            if (settled) return;
            timedOut = true;
            registration.uncertain = true;
            // Do not hold other plugins indefinitely, but keep listening for
            // the actual outcome instead of freezing the timeout state forever.
            finishWait();
          }, 6000);
        },
      };
    },

    ready() {
      return Promise.all([...pending]);
    },
  };
}
