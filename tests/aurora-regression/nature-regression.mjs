/** Runs the real TypeScript with explicit Web Audio and timer doubles.
 * No physical output, acoustic measurement, hardware or clinical validation.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const sourcePath = process.env.MUKTI_NATURE_SOURCE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/lib/nature-sounds.ts')
const js = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

function fixture() {
  let next = 1
  const timeouts = new Map(), intervals = new Map()
  const all = [], sources = [], gains = []
  const pendingResumes = []
  let context
  class Param {
    constructor(value = 0) { this.value = value; this.events = [] }
    cancelScheduledValues() { if (this.failCancel) throw new Error('cancel failed') }
    setValueAtTime(value) { if (!Number.isFinite(value)) throw new Error('non-finite gain'); this.value = value; this.events.push(['set', value]) }
    linearRampToValueAtTime(value) { if (!Number.isFinite(value)) throw new Error('non-finite gain'); this.value = value; this.events.push(['ramp', value]) }
    exponentialRampToValueAtTime(value) { if (!Number.isFinite(value) || value <= 0) throw new Error('invalid gain'); this.value = value; this.events.push(['exp', value]) }
  }
  class Node {
    constructor(source = false) { this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); this.stops = []; this.disconnects = 0; all.push(this); if (source) sources.push(this) }
    connect() {}
    disconnect() { this.disconnects++; if (this.failDisconnect) throw new Error('disconnect failed') }
    start() {}
    stop(time) { this.stops.push(time); if (this.failStop) throw new Error('stop failed') }
  }
  class Context {
    constructor() { context = this; this.sampleRate = 48000; this.currentTime = 0; this.state = 'suspended'; this.destination = {}; this.closes = 0; this.deferResume = false }
    createGain() { const node = new Node(); gains.push(node); return node }
    createOscillator() { return new Node(true) }
    createBufferSource() { return new Node(true) }
    createBiquadFilter() { return new Node() }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) } }
    resume() { if (this.deferResume) return new Promise((resolve, reject) => pendingResumes.push({ resolve, reject })); this.state = 'running'; return Promise.resolve() }
    close() { this.closes++; this.state = 'closed'; return Promise.resolve() }
  }
  const exports = {}, fixedMath = Object.create(Math)
  fixedMath.random = () => 0.25
  vm.runInNewContext(js, {
    exports, Math: fixedMath, Number, Set, Promise,
    window: { AudioContext: Context },
    setTimeout: (callback) => { const id = next++; timeouts.set(id, callback); return id },
    clearTimeout: (id) => timeouts.delete(id),
    setInterval: (callback) => { const id = next++; intervals.set(id, callback); return id },
    clearInterval: (id) => intervals.delete(id),
  })
  const engine = exports.createNatureSoundEngine()
  return {
    engine, all, sources, gains, context, timeouts, intervals, pendingResumes,
    time: () => { for (const [id, callback] of [...timeouts]) { timeouts.delete(id); callback() } },
    tick: () => { for (const callback of [...intervals.values()]) callback() },
  }
}

for (const sound of ['foret', 'riviere', 'vent', 'pluie', 'ocean']) {
  test(`nature: existing ${sound} ambience starts and releases its sources`, () => {
    const f = fixture(); f.engine.setSound(sound); f.engine.start()
    assert.ok(f.sources.length > 0); assert.ok(f.gains[0].gain.value > 0)
    f.engine.dispose()
    assert.equal(f.intervals.size, 0)
    assert.ok(f.sources.every(n => n.stops.length > 0 && n.disconnects > 0))
  })
}

test('nature: silent selection allocates no sound source', () => {
  const f = fixture(); f.engine.start(); assert.equal(f.sources.length, 0); f.engine.dispose()
})
test('nature: repeated start is idempotent', () => {
  const f = fixture(); f.engine.setSound('ocean'); f.engine.start(); const count = f.sources.length
  f.engine.start(); assert.equal(f.sources.length, count); f.engine.dispose()
})
test('nature: explicit stop immediately zeros master and releases all timers', () => {
  const f = fixture(); f.engine.setSound('pluie'); f.engine.start(); f.engine.stop()
  assert.deepEqual(f.gains[0].gain.events.at(-1), ['set', 0])
  assert.equal(f.timeouts.size, 0); assert.equal(f.intervals.size, 0); f.engine.dispose()
})
test('nature: queued ambience change cannot restart output after stop', () => {
  const f = fixture(); f.engine.setSound('ocean'); f.engine.start(); f.engine.setSound('pluie')
  const captured = [...f.timeouts.values()]; f.engine.stop(); const count = f.sources.length
  captured.forEach(fn => fn()); f.time()
  assert.equal(f.sources.length, count); assert.equal(f.gains[0].gain.value, 0)
  assert.equal(f.intervals.size, 0); f.engine.dispose()
})
test('nature: rapid changes create only the most recent requested ambience', () => {
  const f = fixture(); f.engine.start(); f.engine.setSound('pluie'); f.engine.setSound('vent')
  assert.equal(f.timeouts.size, 1); f.time()
  assert.equal(f.sources.length, 2); assert.equal(f.intervals.size, 0); f.engine.dispose()
})
test('nature: stop then immediate restart has no stale stop timer', () => {
  const f = fixture(); f.engine.setSound('ocean'); f.engine.start(); f.engine.stop(); f.engine.start(); f.time()
  assert.ok(f.gains[0].gain.value > 0)
  assert.ok(f.sources.some(n => n.stops.length === 0)); f.engine.dispose()
})
test('nature: callback from an earlier ambience cannot interrupt a newer session', () => {
  const f = fixture(); f.engine.start(); f.engine.setSound('pluie'); const captured = [...f.timeouts.values()]
  f.engine.stop(); f.engine.setSound('vent'); f.engine.start(); const count = f.sources.length
  captured.forEach(fn => fn()); assert.equal(f.sources.length, count); assert.equal(f.intervals.size, 0); f.engine.dispose()
})
for (const volume of [NaN, Infinity, -Infinity]) {
  test(`nature: invalid volume ${String(volume)} fails closed without non-finite automation`, () => {
    const f = fixture(); f.engine.setSound('ocean'); f.engine.start()
    assert.doesNotThrow(() => f.engine.setVolume(volume)); assert.equal(f.gains[0].gain.value, 0); f.engine.dispose()
  })
}
test('nature: finite volume inputs are bounded without raising output while stopped', () => {
  const f = fixture(); f.engine.setVolume(-1); f.engine.start(); assert.equal(f.gains[0].gain.value, 0)
  f.engine.setVolume(2); assert.equal(f.gains[0].gain.value, 1)
  f.engine.stop(); f.engine.setVolume(0.5); assert.equal(f.gains[0].gain.value, 0); f.engine.dispose()
})
test('nature: disposal cancels pending switches and is idempotent', () => {
  const f = fixture(); f.engine.start(); f.engine.setSound('ocean'); f.engine.dispose(); f.engine.dispose(); f.time()
  assert.equal(f.context.closes, 1); assert.equal(f.timeouts.size, 0); assert.equal(f.intervals.size, 0)
  assert.equal(f.sources.length, 0)
})
test('nature: a disposed handle cannot allocate sound or raise gain again', () => {
  const f = fixture(); f.engine.dispose(); const count = f.all.length
  f.engine.setSound('pluie'); f.engine.setVolume(1); f.engine.start(); f.time()
  assert.equal(f.all.length, count); assert.equal(f.gains[0].gain.value, 0)
})
test('nature: naturally ended rain transient releases both nodes', () => {
  const f = fixture(); f.engine.setSound('pluie'); f.engine.start(); f.tick()
  const source = f.sources.at(-1), gain = f.gains.at(-1)
  assert.equal(typeof source.onended, 'function'); source.onended()
  assert.ok(source.disconnects > 0 && gain.disconnects > 0); f.engine.dispose()
})
test('nature: stop releases rain transients even if a source stop throws', () => {
  const f = fixture(); f.engine.setSound('pluie'); f.engine.start(); f.tick()
  const source = f.sources.at(-1), gain = f.gains.at(-1); source.failStop = true
  assert.doesNotThrow(() => f.engine.stop())
  assert.ok(source.disconnects > 0 && gain.disconnects > 0); f.engine.dispose()
})
test('nature: a failing persistent source stop cannot skip its disconnect', () => {
  const f = fixture(); f.engine.setSound('ocean'); f.engine.start(); const source = f.sources[0]; source.failStop = true
  assert.doesNotThrow(() => f.engine.dispose()); assert.ok(source.disconnects > 0); assert.equal(f.context.closes, 1)
})
test('nature: failing automation cancellation cannot skip emergency silence', () => {
  const f = fixture(); f.engine.start(); f.gains[0].gain.failCancel = true
  assert.doesNotThrow(() => f.engine.stop()); assert.equal(f.gains[0].gain.value, 0); f.engine.dispose()
})
test('nature: stale interval from an old session cannot allocate a transient', () => {
  const f = fixture(); f.engine.setSound('pluie'); f.engine.start(); const old = [...f.intervals.values()]
  f.engine.stop(); f.engine.setSound('ocean'); f.engine.start(); const count = f.sources.length
  old.forEach(fn => fn()); assert.equal(f.sources.length, count); f.engine.dispose()
})
test('nature: rejected audio resume clears gains and allocated resources', async () => {
  const f = fixture(); f.context.deferResume = true; f.engine.setSound('pluie'); f.engine.start()
  f.pendingResumes[0].reject(new Error('blocked')); await flush()
  assert.equal(f.gains[0].gain.value, 0); assert.equal(f.intervals.size, 0); f.engine.dispose()
})
test('nature: rejection of an older resume cannot stop a newer session', async () => {
  const f = fixture(); f.context.deferResume = true; f.engine.setSound('ocean'); f.engine.start(); f.engine.stop()
  f.context.deferResume = false; f.engine.start(); f.pendingResumes[0].reject(new Error('stale')); await flush()
  assert.ok(f.gains[0].gain.value > 0); f.engine.dispose()
})
