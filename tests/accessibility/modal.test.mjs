import assert from 'node:assert/strict';
import { test, afterEach, after } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React, { act, StrictMode } from 'react';
import { JSDOM } from 'jsdom';
import { getByRole, getByLabelText, queryByRole } from '@testing-library/dom';
import { build } from 'esbuild';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const output = path.join(rootPath, 'tests/accessibility/evidence/modal-dom.cjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  absWorkingDir: rootPath, entryPoints: ['src/components/ui/Modal.tsx'],
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
  alias: { '@': path.join(rootPath, 'src') },
  external: ['react', 'react-dom', 'lucide-react', 'clsx', 'tailwind-merge'],
  outfile: output, logLevel: 'silent',
});
const { default: Modal } = require(output);
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://mukti.test/', pretendToBeVisual: true });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'MouseEvent']) globalThis[name] = name === 'window' ? dom.window : dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');

// jsdom has no native dialog implementation. This double only opens/closes it
// and performs initial focus; native Tab confinement is tested in Chromium.
dom.window.HTMLDialogElement.prototype.showModal = function () {
  if (this.open) throw new dom.window.DOMException('Already open', 'InvalidStateError');
  this.open = true;
  this.querySelector('[autofocus], button, input')?.focus();
};
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
let mounted;
let host;
function render(props, { strict = false, form = false } = {}) {
  if (!host) { host = document.createElement('div'); document.body.append(host); mounted = createRoot(host); }
  const modal = React.createElement(Modal, props,
    React.createElement('label', { htmlFor: 'message' }, 'Message'),
    React.createElement('input', { id: 'message' }),
    React.createElement('button', { type: 'button' }, 'Autre action'));
  const content = form ? React.createElement('form', { onSubmit: event => { event.preventDefault(); props.onSubmit?.(); } }, modal) : modal;
  act(() => mounted.render(strict ? React.createElement(StrictMode, null, content) : content));
}
function trigger() { const button = document.createElement('button'); button.textContent = 'Ouvrir'; document.body.append(button); button.focus(); return button; }
afterEach(() => { if (mounted) act(() => mounted.unmount()); mounted = null; host = null; document.body.replaceChildren(); });
after(() => dom.window.close());

test('shared native dialog exposes its title and a named close action', () => {
  render({ open: true, title: 'Partager', onClose() {} });
  const dialog = getByRole(document.body, 'dialog', { name: 'Partager' });
  assert.equal(getByRole(dialog, 'button', { name: 'Fermer' }), document.activeElement);
  assert.equal(dialog.open, true);
});

test('dialog without a title remains named and has a visible close action', () => {
  render({ open: true, onClose() {} });
  const dialog = getByRole(document.body, 'dialog', { name: 'Fenêtre de dialogue' });
  assert.ok(getByRole(dialog, 'button', { name: 'Fermer' }));
});

test('dialog content has a named keyboard-focusable reading region', () => {
  render({ open: true, title: 'Partager', onClose() {} });
  const region = getByRole(document.body, 'region', { name: 'Contenu de la fenêtre' });
  assert.equal(region.tabIndex, 0);
  assert.ok(region.contains(getByLabelText(document.body, 'Message')));
  region.focus();
  assert.equal(document.activeElement, region);
  assert.equal(region.contains(getByRole(document.body, 'button', { name: 'Fermer' })), false);
});

test('native cancel requests one controlled close and prevents independent DOM closure', () => {
  let calls = 0;
  render({ open: true, title: 'Partager', onClose() { calls++; } });
  const event = new dom.window.Event('cancel', { bubbles: false, cancelable: true });
  act(() => document.querySelector('dialog').dispatchEvent(event));
  assert.equal(calls, 1);
  assert.equal(event.defaultPrevented, true);
});

test('closing does not submit an enclosing form', () => {
  let closes = 0, submits = 0;
  render({ open: true, title: 'Partager', onClose() { closes++; }, onSubmit() { submits++; } }, { form: true });
  act(() => getByRole(document.body, 'button', { name: 'Fermer' }).click());
  assert.equal(closes, 1);
  assert.equal(submits, 0);
});

test('controlled close restores focus and supports reopening under StrictMode', () => {
  const opener = trigger();
  const props = { open: true, title: 'Partager', onClose() {} };
  render(props, { strict: true });
  getByLabelText(document.body, 'Message').focus();
  render({ ...props, open: false }, { strict: true });
  assert.equal(queryByRole(document.body, 'dialog'), null);
  assert.equal(document.activeElement, opener);
  render(props, { strict: true });
  assert.ok(getByRole(document.body, 'dialog', { name: 'Partager' }));
  assert.equal(document.activeElement, getByRole(document.body, 'button', { name: 'Fermer' }));
});

test('unmount restores focus without stealing it on unrelated parent renders', () => {
  const opener = trigger();
  render({ open: true, title: 'Partager', onClose() {} });
  const input = getByLabelText(document.body, 'Message'); input.focus();
  render({ open: true, title: 'Partager', onClose() {} });
  assert.equal(document.activeElement, input);
  act(() => mounted.unmount()); mounted = null;
  assert.equal(document.activeElement, opener);
});
