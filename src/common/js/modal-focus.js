// Shared by the theme's native drawers and moment editor. Visibility and business
// state stay with each caller; this owns only focus, background inert and scroll.
export function createModalFocus({ panel, backdrop, signal, onClose, initialFocus }) {
  let session = null;

  function controls() {
    return [...panel.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]'
    )].filter(element => element.tabIndex >= 0 && !element.matches(':disabled') &&
      !element.closest('[inert]') && element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden');
  }

  function focusFirst() {
    (controls()[0] || panel).focus({ preventScroll: true });
  }

  function close({ restoreFocus = true } = {}) {
    if (!session) return;
    const previous = session;
    session = null;
    previous.events.abort();
    previous.background.forEach(([element, inert]) => { element.inert = inert; });
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = previous.overflow;
    }
    if (restoreFocus && previous.trigger?.isConnected && !previous.trigger.closest('[inert]')) {
      // A FAB menu collapses when focus enters the dialog. Its hidden item cannot
      // receive focus until the persistent launcher has regained it.
      const trigger = previous.trigger;
      const target = getComputedStyle(trigger).visibility === 'hidden' || !trigger.getClientRects().length
        ? trigger.closest('.fab')?.querySelector('[role="button"][tabindex="0"]')
        : trigger;
      target?.focus({ preventScroll: true });
    }
    if (panel.contains(document.activeElement)) document.activeElement.blur();
    panel.inert = true;
    panel.setAttribute('aria-hidden', 'true');
  }

  function open() {
    if (session || signal?.aborted) return;
    session = {
      trigger: document.activeElement,
      events: new AbortController(),
      background: [],
      overflow: document.body.style.overflow,
    };
    panel.inert = false;
    panel.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    // Focus before making the old focused element's ancestors inert.
    (initialFocus?.() || controls()[0] || panel).focus({ preventScroll: true });
    for (let branch = panel; branch.parentElement && branch !== document.body; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || sibling === backdrop || sibling.contains(backdrop)) continue;
        session.background.push([sibling, sibling.inert]);
        sibling.inert = true;
      }
    }
    const options = { signal: session.events.signal };
    document.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        const items = controls();
        const index = items.indexOf(document.activeElement);
        if (!items.length || index === -1 || (event.shiftKey ? index === 0 : index === items.length - 1)) {
          event.preventDefault();
          (event.shiftKey ? items.at(-1) || panel : items[0] || panel).focus({ preventScroll: true });
        }
      }
    }, options);
    document.addEventListener('focusin', event => {
      if (!panel.contains(event.target)) focusFirst();
    }, options);
  }

  signal?.addEventListener('abort', () => onClose({ restoreFocus: false }), { once: true });
  return { open, close };
}
