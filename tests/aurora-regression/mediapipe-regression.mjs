/** Real loader source with simulated model factories; no camera/GPU/models. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './runtime-fixtures.mjs'

const model = (fail = false) => ({ closes: 0, close() { this.closes++; if (fail) throw new Error('close failed') } })
function deferred() {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
function fixture({ pose, hand, browser = true } = {}) {
  const poses = [], hands = [], warnings = []
  const tasks = {
    FilesetResolver: { forVisionTasks: async () => ({}) },
    PoseLandmarker: { createFromOptions: async () => {
      const value = pose ? await pose() : model(); poses.push(value); return value
    } },
    HandLandmarker: { createFromOptions: async () => {
      const value = hand ? await hand() : model(); hands.push(value); return value
    } },
  }
  const globals = { console: { warn: message => warnings.push(message) }, require(name) {
    if (name === '@mediapipe/tasks-vision') return tasks
    assert.equal(name, '../constants')
    return { AR_MEDIAPIPE_HAND_MODEL_URL: 'test:hand', AR_MEDIAPIPE_POSE_MODEL_URL: 'test:pose', AR_MEDIAPIPE_WASM_BASE: 'test:wasm' }
  } }
  if (browser) globals.window = {}
  const api = load('ar/mediapipe-loader', globals)
  return { api, poses, hands, warnings }
}

test('models: concurrent requests share one initialization', async () => {
  const f = fixture()
  const [a, b] = await Promise.all([f.api.loadMediaPipe(), f.api.loadMediaPipe()])
  assert.equal(a, b); assert.equal(f.poses.length, 1); assert.equal(f.hands.length, 1)
  a.dispose()
})

test('models: failed hand initialization releases the already created pose', async () => {
  const f = fixture({ hand: async () => { throw new Error('hand failed') } })
  await assert.rejects(f.api.loadMediaPipe(), /hand failed/)
  assert.equal(f.poses[0].closes, 1)
})

test('models: retry after failure starts a fresh initialization', async () => {
  let calls = 0
  const f = fixture({ hand: async () => { if (++calls === 1) throw new Error('first failure'); return model() } })
  await assert.rejects(f.api.loadMediaPipe())
  const engine = await f.api.loadMediaPipe()
  assert.equal(f.poses.length, 2); engine.dispose()
})

test('models: disposal is idempotent and invalidates the singleton', async () => {
  const f = fixture()
  const first = await f.api.loadMediaPipe(); first.dispose(); first.dispose()
  assert.equal(first.pose.closes, 1); assert.equal(first.hand.closes, 1)
  const second = await f.api.loadMediaPipe()
  assert.notEqual(first, second); second.dispose()
})

test('models: a failing close cannot skip the other model cleanup', async () => {
  const f = fixture({ pose: async () => model(true) })
  const engine = await f.api.loadMediaPipe()
  assert.doesNotThrow(() => engine.dispose())
  assert.equal(engine.hand.closes, 1); assert.equal(f.warnings.length, 1)
})

test('models: reset of an in-flight load rejects its stale result and releases it', async () => {
  const pending = deferred()
  const f = fixture({ hand: () => pending.promise })
  const old = f.api.loadMediaPipe()
  const rejected = assert.rejects(old, /annul|réinitial/i)
  f.api.resetMediaPipe(); pending.resolve(model())
  await rejected
  assert.equal(f.poses[0].closes, 1); assert.equal(f.hands[0].closes, 1)
})

test('models: old rejection cannot invalidate a newer initialization', async () => {
  const first = deferred(), second = deferred(); let calls = 0
  const f = fixture({ pose: () => ++calls === 1 ? first.promise : second.promise })
  const old = f.api.loadMediaPipe(), rejected = assert.rejects(old, /old failure/)
  for (let i = 0; i < 20; i++) await Promise.resolve()
  f.api.resetMediaPipe()
  const current = f.api.loadMediaPipe()
  first.reject(new Error('old failure')); await rejected
  const shared = f.api.loadMediaPipe(); second.resolve(model())
  const [a, b] = await Promise.all([current, shared])
  assert.equal(a, b); assert.equal(calls, 2); a.dispose()
})

test('models: disposal of an older engine does not invalidate a newer load', async () => {
  const f = fixture()
  const old = await f.api.loadMediaPipe(); f.api.resetMediaPipe()
  const current = await f.api.loadMediaPipe(); old.dispose()
  assert.equal(await f.api.loadMediaPipe(), current); current.dispose()
})

test('models: server-side calls reject without loading models', async () => {
  const f = fixture({ browser: false })
  await assert.rejects(f.api.loadMediaPipe(), /navigateur/)
  assert.equal(f.poses.length, 0)
})
