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
  return { api: context.exports, saved, window, storage,
    setReadBlocked: value => { readBlocked = value; }, setWriteBlocked: value => { writeBlocked = value; } };
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

test('storage recovery merges only local changes with another tab without needing an event', () => {
  const { api, saved, setWriteBlocked } = fixture({ raw: '{"captionsForced":true}', writeBlocked: true });
  assert.equal(api.saveA11yPrefsWithStatus({ fontSize: 'xl' }).persisted, false);
  saved.set(api.A11Y_STORAGE_KEY, '{"captionsForced":true,"highContrast":true,"fontSize":"md"}');
  setWriteBlocked(false);
  const result = api.saveA11yPrefsWithStatus({ reducedMotionForced: true });
  assert.equal(result.persisted, true);
  assert.equal(result.prefs.fontSize, 'xl');
  assert.equal(result.prefs.highContrast, true);
  assert.equal(result.prefs.captionsForced, true);
  assert.equal(result.prefs.reducedMotionForced, true);
  assert.deepEqual(JSON.parse(saved.get(api.A11Y_STORAGE_KEY)), plain(result.prefs));
});

test('storage events preserve pending local choices and merge actual remote values before retry', () => {
  const { api, saved, window, storage, setWriteBlocked } = fixture({ writeBlocked: true });
  api.saveA11yPrefsWithStatus({ fontSize: 'xl' });
  let notified;
  api.subscribeA11yPrefs(() => { notified = api.loadA11yPrefs(); });
  saved.set(api.A11Y_STORAGE_KEY, '{"highContrast":true,"captionsForced":true,"fontSize":"sm"}');
  const event = new Event('storage'); event.key = api.A11Y_STORAGE_KEY; event.storageArea = storage;
  event.newValue = '{"fontSize":"md","highContrast":false}'; window.dispatchEvent(event);
  assert.equal(notified.fontSize, 'xl');
  assert.equal(notified.highContrast, true);
  assert.equal(notified.captionsForced, true);
  setWriteBlocked(false);
  assert.equal(api.saveA11yPrefsWithStatus({}).persisted, true);
  // Successful persistence clears local precedence: future remote changes win normally.
  saved.set(api.A11Y_STORAGE_KEY, '{"fontSize":"lg","highContrast":false}');
  window.dispatchEvent(event);
  assert.equal(api.loadA11yPrefs().fontSize, 'lg');
  assert.equal(api.loadA11yPrefs().highContrast, false);
});

test('temporary read failure retains the last observed settings without overwriting unknown changes', () => {
  const { api, saved, setReadBlocked, setWriteBlocked } = fixture({ raw: '{"highContrast":true,"captionsForced":true,"fontSize":"lg"}' });
  assert.equal(api.loadA11yPrefs().highContrast, true);
  setReadBlocked(true); setWriteBlocked(true);
  const temporary = api.saveA11yPrefsWithStatus({ fontSize: 'xl' });
  assert.equal(temporary.persisted, false);
  assert.equal(temporary.prefs.highContrast, true);
  assert.equal(temporary.prefs.captionsForced, true);
  saved.set(api.A11Y_STORAGE_KEY, '{"captionsForced":true,"highContrast":false,"reducedMotionForced":true}');
  setReadBlocked(false); setWriteBlocked(false);
  const recovered = api.saveA11yPrefsWithStatus({});
  assert.equal(recovered.persisted, true);
  assert.equal(recovered.prefs.fontSize, 'xl');
  assert.equal(recovered.prefs.highContrast, false);
  assert.equal(recovered.prefs.captionsForced, true);
  assert.equal(recovered.prefs.reducedMotionForced, true);
});

test('a blocked read prevents a writable store from losing unseen preferences', () => {
  const original = '{"captionsForced":true,"highContrast":true}';
  const { api, saved, setReadBlocked } = fixture({ raw: original, readBlocked: true });
  const temporary = api.saveA11yPrefsWithStatus({ fontSize: 'xl' });
  assert.equal(temporary.persisted, false);
  assert.equal(temporary.prefs.fontSize, 'xl');
  assert.equal(saved.get(api.A11Y_STORAGE_KEY), original);
  setReadBlocked(false);
  const recovered = api.saveA11yPrefsWithStatus({});
  assert.equal(recovered.persisted, true);
  assert.equal(recovered.prefs.captionsForced, true);
  assert.equal(recovered.prefs.highContrast, true);
  assert.equal(recovered.prefs.fontSize, 'xl');
});

test('invalid patches during blocked writes do not pin default values over another tab', () => {
  const { api, saved, setWriteBlocked } = fixture({ writeBlocked: true });
  api.saveA11yPrefsWithStatus({ fontSize: 'unknown', highContrast: 'true' });
  saved.set(api.A11Y_STORAGE_KEY, '{"fontSize":"lg","highContrast":true}');
  setWriteBlocked(false);
  const result = api.saveA11yPrefsWithStatus({});
  assert.equal(result.persisted, true);
  assert.equal(result.prefs.fontSize, 'lg');
  assert.equal(result.prefs.highContrast, true);
});

test('remote storage clearing resets persisted fields while keeping unsaved local choices', () => {
  const { api, saved, window, storage } = fixture({ raw: '{"highContrast":true,"captionsForced":true}', writeBlocked: true });
  api.saveA11yPrefsWithStatus({ fontSize: 'xl' });
  api.subscribeA11yPrefs(() => {});
  saved.clear();
  const event = new Event('storage'); event.key = null; event.storageArea = storage; window.dispatchEvent(event);
  assert.equal(api.loadA11yPrefs().fontSize, 'xl');
  assert.equal(api.loadA11yPrefs().highContrast, false);
  assert.equal(api.loadA11yPrefs().captionsForced, false);
});

test('an explicit local reset replaces pending changes and can be retried after recovery', () => {
  const { api, saved, setWriteBlocked } = fixture({ raw: '{"captionsForced":true}', writeBlocked: true });
  api.saveA11yPrefsWithStatus({ fontSize: 'xl', highContrast: true });
  assert.equal(api.saveA11yPrefsWithStatus(api.DEFAULT_A11Y_PREFS).persisted, false);
  assert.deepEqual(plain(api.loadA11yPrefs()), plain(api.DEFAULT_A11Y_PREFS));
  saved.set(api.A11Y_STORAGE_KEY, '{"captionsForced":true,"fontSize":"lg"}');
  setWriteBlocked(false);
  const reset = api.saveA11yPrefsWithStatus({});
  assert.equal(reset.persisted, true);
  assert.deepEqual(plain(reset.prefs), plain(api.DEFAULT_A11Y_PREFS));
  assert.deepEqual(JSON.parse(saved.get(api.A11Y_STORAGE_KEY)), plain(api.DEFAULT_A11Y_PREFS));
});
