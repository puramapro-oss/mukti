/** Real source execution with explicit timers/Web Audio doubles; not acoustic validation. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const ts = createRequire(import.meta.url)(process.env.MUKTI_TYPESCRIPT_PATH || 'typescript')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/lib')
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

function fixture(options = {}) {
  let clock = 0, nextTimer = 0
  const timers = new Map(), contexts = [], states = [], modules = new Map()
  class Param {
    constructor() { this.value = 0; this.events = [] }
    cancelScheduledValues(at) { this.events.push(['cancel', at]); if (this.failCancel) throw new Error('cancel') }
    setValueAtTime(value, at) { if (this.failSet || !Number.isFinite(value)) throw new Error('set'); this.value = value; this.events.push(['set', value, at]) }
    linearRampToValueAtTime(value, at) { if (this.failRamp || !Number.isFinite(value)) throw new Error('ramp'); this.value = value; this.events.push(['ramp', value, at]) }
  }
  class Node {
    constructor() { this.playbackRate = new Param(); this.detune = new Param(); this.gain = new Param(); this.stops = []; this.disconnects = 0; this.starts = 0; this.targets = [] }
    connect(target) { this.targets.push(target) }
    disconnect() { this.disconnects++; if (this.failDisconnect) throw new Error('disconnect') }
    start() { this.starts++ }
    stop(time) { this.stops.push(time); if (this.failStop) throw new Error('stop') }
  }
  class Context {
    constructor() {
      contexts.push(this); this.state = 'suspended'; this.sampleRate = options.sampleRate ?? 48000
      this.currentTime = 0; this.destination = {}; this.sources = []; this.gains = []; this.handlers = new Set(); this.closes = 0
    }
    createBufferSource() { const o = new Node(); this.sources.push(o); return o }
    createBuffer(_channels, length, sampleRate) { const samples = new Float32Array(length); return { length, sampleRate, getChannelData: () => samples } }
    createGain() { if (options.failGain) throw new Error('gain'); const g = new Node(); this.gains.push(g); return g }
    addEventListener(_name, fn) { if (options.failEvent) throw new Error('event'); this.handlers.add(fn) }
    removeEventListener(_name, fn) { this.handlers.delete(fn) }
    resume() {
      if (options.throwResume) throw new Error('resume')
      if (options.rejectResume) return Promise.reject(new Error('resume'))
      if (options.pendingResume) return new Promise(resolve => { this.resolveResume = () => { this.state = 'running'; resolve() } })
      this.state = options.staySuspended ? 'suspended' : 'running'; return Promise.resolve()
    }
    close() { this.closes++; this.state = 'closed'; return options.rejectClose ? Promise.reject(new Error('close')) : Promise.resolve() }
  }
  const globals = {
    URLSearchParams, Object, Number, Promise, Error, Math,
    window: options.noAudio ? {} : { AudioContext: Context },
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: clock + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
  }
  const load = name => {
    if (modules.has(name)) return modules.get(name)
    const exports = {}
    const code = ts.transpileModule(fs.readFileSync(path.join(root, `${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    vm.runInNewContext(code, { ...globals, exports, require: specifier => {
      assert.equal(specifier, './tone-program'); return load('tone-program')
    } })
    modules.set(name, exports); return exports
  }
  const schema = load('tone-program'), api = load('pure-tone-player')
  const player = api.createPureTonePlayer((state, error) => states.push({ state, error }))
  return { schema, api, player, contexts, timers, states, advance(ms) {
    clock += ms
    for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn() }
  } }
}
const program = { version: 1, hz: 432, seconds: 60 }

for (const hz of [396, 417, 432, 528, 639, 741, 852]) {
  test(`tone program round-trips ${hz} Hz without volume or identity`, () => {
    const f = fixture(), p = { ...program, hz }
    assert.equal(f.schema.encodeToneHash(p), `#v=1&hz=${hz}&seconds=60`)
    assert.deepEqual({ ...f.schema.decodeToneHash(f.schema.encodeToneHash(p)) }, p)
  })
}
for (const value of [null, [], {}, { ...program, version: 2 }, { ...program, hz: 40000 }, { ...program, hz: '432' }, { ...program, hz: NaN }, { ...program, seconds: Infinity }, { ...program, seconds: 0 }, { ...program, volume: 1 }, { ...program, canPublish: true }]) {
  test(`rejects invalid or actuator-shaped program ${JSON.stringify(value)}`, () => assert.throws(() => fixture().schema.validateToneProgram(value)))
}
for (const hash of ['#v=1&hz=432&seconds=60&volume=1', '#v=1&hz=432&seconds=60&hz=741', '#v=1&hz=040&seconds=60', '#v=1&hz=432&seconds=00', '#v=1&hz=432&seconds=060', '#v=1&hz=432&seconds=6000', '#v=1&hz=432&seconds=60%00', '#v=1&hz=432&seconds=60\n', '#v=1&hz=432&seconds=60&url=https://bad.test', '#'.repeat(100)]) {
  test(`rejects malformed signal link ${JSON.stringify(hash)}`, () => assert.throws(() => fixture().schema.decodeToneHash(hash)))
}

test('empty link selects 432 Hz without allocating any output', () => {
  const f = fixture(); assert.deepEqual({ ...f.schema.decodeToneHash('') }, program); assert.equal(f.contexts.length, 0)
})
test('source contains no network, microphone, media capture, Bluetooth or speech call', () => {
  const source = fs.readFileSync(path.join(root, 'pure-tone-player.ts'), 'utf8')
  assert.doesNotMatch(source, /\bfetch\s*\(|getUserMedia|mediaDevices|speechSynthesis|navigator\.bluetooth|new WebSocket/)
})
test('one 432 Hz sine, zero detune, exact scheduled duration, no extra layer', async () => {
  const f = fixture(); assert.equal(await f.player.start(program), true)
  const ctx = f.contexts[0], osc = ctx.sources[0]
  assert.equal(ctx.sources.length, 1); assert.equal(ctx.gains.length, 1)
  assert.equal(osc.loop, true); assert.equal(osc.playbackRate.value, 1); assert.equal(osc.detune.value, 0)
  assert.equal(osc.buffer.length, 48000); assert.equal(osc.buffer.sampleRate, 48000)
  assert.ok(osc.buffer.getChannelData(0).every((v,i) => Math.abs(v-Math.sin(2*Math.PI*432*i/48000)) < 3e-8))
  assert.deepEqual(osc.stops, [60]); assert.equal(f.states.at(-1).state, 'playing')
  f.player.dispose(); await flush(); assert.equal(f.timers.size, 0)
})
test('double click cannot allocate another context during or after startup', async () => {
  const f = fixture({ pendingResume: true }); const pending = f.player.start(program)
  assert.equal(await f.player.start(program), false); assert.equal(f.contexts.length, 1)
  f.contexts[0].resolveResume(); assert.equal(await pending, true)
  assert.equal(await f.player.start(program), false); f.player.dispose()
})
test('stop while resuming discards late success with no graph or restart', async () => {
  const f = fixture({ pendingResume: true }); const pending = f.player.start(program)
  f.player.stop(); assert.equal(await pending, false)
  f.contexts[0].resolveResume(); await flush()
  assert.equal(f.contexts[0].sources.length, 0); assert.equal(f.states.at(-1).state, 'idle'); assert.equal(f.timers.size, 0)
})
test('old startup cannot silence or change a newer player run', async () => {
  const f = fixture({ pendingResume: true }); const first = f.player.start(program); const old = f.contexts[0]
  f.player.stop(); const second = f.player.start(program); const current = f.contexts[1]
  current.resolveResume(); assert.equal(await second, true)
  old.resolveResume(); assert.equal(await first, false); assert.equal(f.states.at(-1).state, 'playing'); assert.equal(current.closes, 0)
  f.player.dispose()
})
for (const options of [{ noAudio: true }, { rejectResume: true }, { throwResume: true }, { staySuspended: true }, { failEvent: true }, { failGain: true }, { sampleRate: 800 }]) {
  test(`startup failure closes all allocated resources ${JSON.stringify(options)}`, async () => {
    const f = fixture(options); assert.equal(await f.player.start(program), false); await flush()
    assert.equal(f.states.at(-1).state, 'error'); assert.equal(f.timers.size, 0)
    for (const ctx of f.contexts) { assert.equal(ctx.closes, 1); assert.ok(ctx.sources.every(o => o.disconnects > 0)) }
  })
}
test('unresolved resume expires after five seconds and never starts on a late result', async () => {
  const f = fixture({ pendingResume: true }); const pending = f.player.start(program)
  f.advance(5000); assert.equal(await pending, false)
  f.contexts[0].resolveResume(); await flush(); assert.equal(f.contexts[0].sources.length, 0); assert.equal(f.timers.size, 0)
})
test('stop zeros gain, disconnects graph, closes context and cancels timers', async () => {
  const f = fixture(); await f.player.start(program); const ctx = f.contexts[0]
  f.player.stop(); assert.equal(ctx.gains[0].gain.value, 0); assert.equal(ctx.closes, 1)
  assert.equal(ctx.gains[0].disconnects, 1); assert.equal(ctx.sources[0].disconnects, 1); assert.equal(f.timers.size, 0)
})
test('stop survives failed automation, source stop, disconnection and context-close rejection', async () => {
  const f = fixture({ rejectClose: true }); await f.player.start(program); const ctx = f.contexts[0]
  ctx.gains[0].gain.failCancel = true; ctx.sources[0].failStop = true; ctx.sources[0].failDisconnect = true
  assert.doesNotThrow(() => f.player.stop()); await flush()
  assert.equal(ctx.gains[0].gain.value, 0); assert.equal(ctx.gains[0].disconnects, 1); assert.equal(ctx.closes, 1)
})
test('audio clock completion cleans up once without waiting for watchdog', async () => {
  const f = fixture(); await f.player.start(program); const ctx = f.contexts[0]
  ctx.sources[0].onended(); f.advance(60250)
  assert.equal(f.states.at(-1).state, 'idle'); assert.equal(ctx.closes, 1); assert.equal(f.timers.size, 0)
})
test('watchdog also cleans up when onended never arrives', async () => {
  const f = fixture(); await f.player.start(program); f.advance(60250)
  assert.equal(f.contexts[0].closes, 1); assert.equal(f.states.at(-1).state, 'idle')
})
test('audio interruption closes the player and never resumes on a later state event', async () => {
  const f = fixture(); await f.player.start(program); const ctx = f.contexts[0], callbacks = [...ctx.handlers]
  ctx.state = 'interrupted'; callbacks.forEach(fn => fn()); ctx.state = 'running'; callbacks.forEach(fn => fn())
  assert.equal(f.states.at(-1).state, 'idle'); assert.equal(ctx.closes, 1); assert.equal(ctx.sources.length, 1)
})
for (const volume of [NaN, Infinity, -1, 0, 0.04, 0.12, 1]) {
  test(`local gain is bounded and keeps the scheduled stop: ${volume}`, async () => {
    const f = fixture(); await f.player.start(program); const ctx = f.contexts[0]
    f.player.setVolume(volume)
    assert.ok(ctx.gains[0].gain.events.filter(e => e[0] !== 'cancel').every(e => e[1] >= 0 && e[1] <= 0.12))
    assert.deepEqual(ctx.sources[0].stops, [60]); f.player.dispose()
  })
}
test('a broken volume adjustment stops rather than leaving output uncontrolled', async () => {
  const f = fixture(); await f.player.start(program); const ctx = f.contexts[0]; ctx.gains[0].gain.failRamp = true
  f.player.setVolume(0.08); assert.equal(ctx.closes, 1); assert.equal(f.states.at(-1).state, 'error')
})
test('dispose is idempotent and forbids any later restart or notification', async () => {
  const f = fixture(); await f.player.start(program); const count = f.states.length
  f.player.dispose(); f.player.dispose(); f.player.setVolume(0.1); f.player.stop()
  assert.equal(await f.player.start(program), false); assert.equal(f.contexts.length, 1); assert.equal(f.contexts[0].closes, 1); assert.equal(f.states.length, count)
})
test('100 lifecycle repetitions release every graph without accumulating timers', async () => {
  const f = fixture()
  for (let i = 0; i < 100; i++) { assert.equal(await f.player.start(program), true); f.player.stop() }
  assert.equal(f.timers.size, 0); assert.equal(f.contexts.length, 100)
  assert.ok(f.contexts.every(ctx => ctx.closes === 1 && ctx.handlers.size === 0 && ctx.sources[0].disconnects === 1))
})
