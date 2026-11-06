import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/common/js/modal-focus.js', import.meta.url), 'utf8')
  .replace('export function', 'function');

function fixture({ empty = false } = {}) {
  const doc = new EventTarget();
  function element(parent, { inert = false, visibility = 'visible' } = {}) {
    const el = {
      parentElement: parent, children: [], style: {}, inert, visibility, tabIndex: 0, isConnected: true,
      setAttribute() {}, removeAttribute() {}, matches: () => false,
      getClientRects: () => [{}],
      contains(target) { return target === this || this.children.some(child => child.contains(target)); },
      closest(selector) { return selector === '[inert]' ? (this.inert ? this : this.parentElement?.closest(selector)) : this.fab || null; },
      focus() { if (!this.closest('[inert]') && this.visibility === 'visible') doc.activeElement = this; },
      blur() { doc.activeElement = doc.body; },
      querySelectorAll() { return this.children; },
      querySelector() { return this.children[0]; },
    };
    parent?.children.push(el); return el;
  }
  doc.body = element(null); doc.body.style.overflow = 'auto';
  const fab = element(doc.body); const launcher = element(fab); const trigger = element(fab); trigger.fab = fab;
  const protectedBackground = element(doc.body, { inert: true });
  const backdrop = element(doc.body);
  const panel = element(doc.body, { inert: true });
  const first = empty ? null : element(panel); const last = empty ? null : element(panel);
  doc.activeElement = trigger;
  const controller = new AbortController(); let api;
  const create = vm.runInNewContext(`${source}; createModalFocus`, {
    document: doc, AbortController, getComputedStyle: el => ({ visibility: el.visibility }),
  });
  api = create({ panel, backdrop, signal: controller.signal, onClose: options => api.close(options) });
  function key(key, shiftKey = false) {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key, shiftKey });
    doc.dispatchEvent(event); return event.defaultPrevented;
  }
  return { api, doc, panel, backdrop, fab, launcher, trigger, first, last, protectedBackground, controller, key };
}

test('open moves focus inside and close restores the trigger, prior scroll state and existing inert state', () => {
  const s = fixture(); s.api.open();
  assert.equal(s.doc.activeElement, s.first); assert.equal(s.fab.inert, true); assert.equal(s.backdrop.inert, false);
  assert.equal(s.doc.body.style.overflow, 'hidden');
  s.api.close();
  assert.equal(s.doc.activeElement, s.trigger); assert.equal(s.fab.inert, false);
  assert.equal(s.protectedBackground.inert, true); assert.equal(s.doc.body.style.overflow, 'auto');
  assert.equal(s.panel.inert, true);
});

test('Tab and Shift+Tab wrap inside the dialog and Escape releases it', () => {
  const s = fixture(); s.api.open(); s.last.focus();
  assert.equal(s.key('Tab'), true); assert.equal(s.doc.activeElement, s.first);
  assert.equal(s.key('Tab', true), true); assert.equal(s.doc.activeElement, s.last);
  s.key('Escape'); assert.equal(s.panel.inert, true); assert.equal(s.doc.activeElement, s.trigger);
  assert.equal(s.key('Tab'), false, 'closed dialogs must remove the keyboard listener');
});

test('a dialog without controls retains focus on its container', () => {
  const s = fixture({ empty: true }); s.api.open();
  assert.equal(s.doc.activeElement, s.panel); s.key('Tab', true);
  assert.equal(s.doc.activeElement, s.panel); s.api.close();
});

test('cleanup releases owned scroll/inert state without restoring focus to a departing page', () => {
  const s = fixture(); s.api.open(); s.controller.abort();
  assert.equal(s.panel.inert, true); assert.equal(s.doc.body.style.overflow, 'auto');
  assert.equal(s.fab.inert, false); assert.notEqual(s.doc.activeElement, s.trigger);
  s.api.open(); assert.equal(s.panel.inert, true);
});

test('closing a collapsed FAB item returns focus to its visible launcher', () => {
  const s = fixture(); s.api.open(); s.trigger.visibility = 'hidden'; s.api.close();
  assert.equal(s.doc.activeElement, s.launcher);
});

test('repeated open does not overwrite the original trigger or scroll value', () => {
  const s = fixture(); s.api.open(); s.api.open(); s.api.close();
  assert.equal(s.doc.activeElement, s.trigger); assert.equal(s.doc.body.style.overflow, 'auto');
  s.api.close(); assert.equal(s.doc.body.style.overflow, 'auto');
});
