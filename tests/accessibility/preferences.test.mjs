import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const filename = new URL('../../src/lib/accessibility.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function fixture({ raw = null, readBlocked = false, writeBlocked = false, server = false, vibrate = () => true } = {}) {
  const saved = new Map(raw === null ? [] : [['mukti.a11y.prefs', raw]]);
  const storage = { getItem: key => { if (readBlocked) throw Error('Blocked'); return saved.get(key) ?? null; }, setItem: (key, value) => { if (writeBlocked) throw Error('Blocked'); saved.set(key, value); } };
  const window = new EventTarget(); window.localStorage = storage;
  const context = vm.createContext({ exports: {}, Event, CustomEvent, ...(server ? {} : { window }), navigator: { vibrate } });
  vm.runInContext(compiled, context);
  return { api: context.exports, saved, window, storage };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('SSR returns independent defaults and never touches storage', () => {
  const { api } = fixture({ server: true });
  const first = api.loadA11yPrefs(); first.fontSize = 'xl';
  assert.equal(api.loadA11yPrefs().fontSize, 'md');
  assert.equal(api.saveA11yPrefsWithStatus({ fontSize: 'xl' }).persisted, false);
  assert.equal(Object.isFrozen(api.DEFAULT_A11Y_PREFS), true);
});
test('stored values are restricted to the existing six preference fields', () => {
  const { api } = fixture({ raw: '{"silentMode":true,"captionsForced":true,"highContrast":"yes","fontSize":"huge","__proto__":{"polluted":true},"diagnosis":"private"}' });
  const prefs = api.loadA11yPrefs();
  assert.equal(prefs.silentMode, true); assert.equal(prefs.captionsForced, true);
  assert.equal(prefs.highContrast, false); assert.equal(prefs.fontSize, 'md');
  assert.deepEqual(Object.keys(prefs).sort(), ['captionsForced','fontSize','hapticEnabled','highContrast','reducedMotionForced','silentMode']);
  assert.equal(prefs.polluted, undefined);
});
test('null arrays strings malformed and oversized storage use safe defaults', () => {
  for (const raw of ['null', '[]', '"large"', 'false', '{', ' '.repeat(5000)]) {
    const { api } = fixture({ raw });
    assert.deepEqual(plain(api.loadA11yPrefs()), plain(api.DEFAULT_A11Y_PREFS));
  }
});
test('inherited preference properties are ignored', () => {
  const { api } = fixture();
  const value = Object.create({ silentMode: true, fontSize: 'xl' });
  assert.equal(api.normalizeA11yPrefs(value).silentMode, false);
  assert.equal(api.normalizeA11yPrefs(value).fontSize, 'md');
});
test('patch preserves legacy silent and captions choices and ignores invalid values', () => {
  const { api, saved } = fixture({ raw: '{"silentMode":true,"captionsForced":true,"fontSize":"lg"}' });
  const result = api.saveA11yPrefsWithStatus({ highContrast: true, fontSize: 22, silentMode: 'false' });
  assert.equal(result.persisted, true); assert.equal(result.prefs.fontSize, 'lg');
  assert.equal(result.prefs.silentMode, true); assert.equal(result.prefs.captionsForced, true);
  assert.equal(JSON.parse(saved.get(api.A11Y_STORAGE_KEY)).highContrast, true);
});
test('blocked writes apply only in this tab and report persistence failure', () => {
  const { api } = fixture({ raw: '{"fontSize":"md"}', writeBlocked: true });
  const result = api.saveA11yPrefsWithStatus({ fontSize: 'xl' });
  assert.equal(result.persisted, false); assert.equal(api.loadA11yPrefs().fontSize, 'xl');
  result.prefs.fontSize = 'sm'; assert.equal(api.loadA11yPrefs().fontSize, 'xl');
});
test('read and write failures do not prevent a session preference', () => {
  const { api } = fixture({ readBlocked: true, writeBlocked: true });
  assert.equal(api.saveA11yPrefsWithStatus({ highContrast: true }).persisted, false);
  assert.equal(api.loadA11yPrefs().highContrast, true);
});
test('local listeners re-read storage and do not trust event payloads', () => {
  const { api, window } = fixture(); let calls = 0;
  const unsubscribe = api.subscribeA11yPrefs(() => { calls++; assert.equal(api.loadA11yPrefs().fontSize, 'md'); });
  const event = new Event(api.A11Y_PREFS_EVENT); event.detail = { fontSize: 'xl' }; window.dispatchEvent(event);
  assert.equal(calls, 1); unsubscribe(); window.dispatchEvent(new Event(api.A11Y_PREFS_EVENT)); assert.equal(calls, 1);
});
test('only relevant localStorage cross-tab events refresh preferences', () => {
  const { api, window, storage, saved } = fixture(); let calls = 0;
  api.subscribeA11yPrefs(() => calls++);
  const dispatch = (key, area = storage) => { const event = new Event('storage'); event.key = key; event.storageArea = area; window.dispatchEvent(event); };
  dispatch('other'); dispatch(api.A11Y_STORAGE_KEY, {}); assert.equal(calls, 0);
  saved.set(api.A11Y_STORAGE_KEY, '{"fontSize":"xl"}'); dispatch(api.A11Y_STORAGE_KEY);
  assert.equal(calls, 1); assert.equal(api.loadA11yPrefs().fontSize, 'xl');
  saved.clear(); dispatch(null); assert.equal(calls, 2); assert.equal(api.loadA11yPrefs().fontSize, 'md');
});
test('legacy silence and disabled haptics prevent new vibration', () => {
  for (const raw of ['{"silentMode":true}', '{"hapticEnabled":false}']) {
    let calls = 0; const { api } = fixture({ raw, vibrate: () => { calls++; return true; } });
    assert.equal(api.safeVibrate(50), false); assert.equal(calls, 0);
  }
});
test('disabling haptics also cancels a running vibration', () => {
  const calls = []; const { api } = fixture({ vibrate: value => { calls.push(value); return true; } });
  assert.equal(api.safeVibrate(400), true); api.saveA11yPrefs({ hapticEnabled: false });
  assert.deepEqual(calls, [400, 0]); assert.equal(api.safeVibrate(50), false);
});
test('hardware errors and invalid vibration patterns return false', () => {
  const { api } = fixture({ vibrate: () => { throw Error('Hardware refused'); } });
  assert.equal(api.safeVibrate(50), false);
  let calls = 0; const second = fixture({ vibrate: () => { calls++; return true; } }).api;
  for (const pattern of [-1, Infinity, NaN, 10001, [50, -1], Array(65).fill(1)]) assert.equal(second.safeVibrate(pattern), false);
  assert.equal(calls, 0); assert.equal(second.safeVibrate([100,50,100]), true);
});
