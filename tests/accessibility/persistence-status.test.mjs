import assert from 'node:assert/strict';
import { test, beforeEach, afterEach, after } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { getByRole } from '@testing-library/dom';
import { build } from 'esbuild';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const output = path.join(rootPath, 'tests/accessibility/evidence/persistence-status-dom.cjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  absWorkingDir: rootPath,
  stdin: {
    contents: "export { default as AccessibilityClient } from './src/app/(dashboard)/dashboard/profile/accessibility/AccessibilityClient'; export * from './src/lib/accessibility';",
    resolveDir: rootPath, sourcefile: 'persistence-status-entry.ts', loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
  alias: { '@': path.join(rootPath, 'src') },
  external: ['react', 'react-dom'], outfile: output, logLevel: 'silent',
});
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://mukti.test/', pretendToBeVisual: true });
for (const name of ['window', 'document', 'HTMLElement', 'Event', 'CustomEvent']) globalThis[name] = name === 'window' ? dom.window : dom.window[name];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.defineProperty(dom.window.navigator, 'vibrate', { value: () => true, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const storagePrototype = dom.window.Storage.prototype;
const originalGet = storagePrototype.getItem;
const originalSet = storagePrototype.setItem;
let readBlocked = false, writeBlocked = false;
storagePrototype.getItem = function (key) { if (readBlocked) throw new Error('Read refused'); return originalGet.call(this, key); };
storagePrototype.setItem = function (key, value) { if (writeBlocked) throw new Error('Write refused'); return originalSet.call(this, key, value); };
let api, mounted, host;
async function render() {
  host = document.createElement('div'); document.body.append(host);
  mounted = createRoot(host);
  await act(async () => { mounted.render(React.createElement(api.AccessibilityClient)); });
}
async function unmount() {
  if (mounted) await act(async () => mounted.unmount());
  mounted = null; host?.remove(); host = null;
}
async function click(role, name) { await act(async () => getByRole(document.body, role, { name }).click()); }
const status = () => getByRole(document.body, 'status').textContent;
beforeEach(() => {
  readBlocked = false; writeBlocked = false; dom.window.localStorage.clear();
  delete require.cache[require.resolve(output)]; api = require(output);
});
afterEach(async () => { await unmount(); document.body.replaceChildren(); });
after(() => dom.window.close());

test('temporary preference notice remains visible alongside vibration feedback', async () => {
  writeBlocked = true; await render();
  await click('radio', 'Très grand');
  assert.match(status(), /dans cet onglet/);
  await click('button', 'Tester une vibration');
  assert.match(status(), /vibration/);
  assert.match(status(), /dans cet onglet/);
  assert.doesNotMatch(status(), /enregistrée/);
});

test('reopening the real panel retains the warning for its pending local choices', async () => {
  writeBlocked = true; await render();
  await click('radio', 'Très grand');
  await unmount(); await render();
  assert.equal(getByRole(document.body, 'radio', { name: 'Très grand' }).checked, true);
  assert.match(status(), /dans cet onglet/);
  assert.doesNotMatch(status(), /enregistrée/);
});

test('a second local writer replaces stale saved feedback and reports later recovery', async () => {
  await render(); await click('switch', 'Réduire les animations');
  const liveRegion = getByRole(document.body, 'status');
  assert.equal(liveRegion.getAttribute('aria-live'), 'polite');
  assert.match(status(), /enregistrée/);
  writeBlocked = true;
  await act(async () => { api.saveA11yPrefsWithStatus({ fontSize: 'xl' }); });
  assert.equal(getByRole(document.body, 'radio', { name: 'Très grand' }).checked, true);
  assert.match(status(), /dans cet onglet/);
  assert.doesNotMatch(status(), /enregistrée/);
  writeBlocked = false;
  await act(async () => { api.saveA11yPrefsWithStatus({}); });
  assert.equal(getByRole(document.body, 'status'), liveRegion);
  assert.match(status(), /Réglages actuels appliqués/);
  assert.doesNotMatch(status(), /enregistrée/);
  assert.doesNotMatch(status(), /dans cet onglet/);
  assert.equal(JSON.parse(dom.window.localStorage.getItem(api.A11Y_STORAGE_KEY)).fontSize, 'xl');
});

test('clearing storage in another tab removes the claim that current choices are saved', async () => {
  await render(); await click('radio', 'Très grand');
  assert.match(status(), /enregistrée/);
  await act(async () => {
    dom.window.localStorage.clear();
    dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: null, storageArea: dom.window.localStorage }));
  });
  assert.equal(getByRole(document.body, 'radio', { name: 'Standard' }).checked, true);
  assert.match(status(), /Réglages actuels appliqués/);
  assert.doesNotMatch(status(), /enregistrée/);
});

test('an unreadable initial store explains its limitation and announces read-only recovery', async () => {
  readBlocked = true; await render();
  const liveRegion = getByRole(document.body, 'status');
  assert.match(status(), /stockage.*indisponible/);
  assert.match(status(), /ne peut pas être vérifié/);
  assert.doesNotMatch(status(), /enregistrée/);
  readBlocked = false;
  await act(async () => {
    dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: api.A11Y_STORAGE_KEY, storageArea: dom.window.localStorage }));
  });
  assert.equal(getByRole(document.body, 'status'), liveRegion);
  assert.match(status(), /Réglages actuels appliqués/);
  assert.doesNotMatch(status(), /indisponible|enregistrée/);
  assert.equal(dom.window.localStorage.getItem(api.A11Y_STORAGE_KEY), null, 'Reading recovery must not write preferences.');
});
