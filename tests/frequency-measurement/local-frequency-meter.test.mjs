import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLocalFrequencyMeter } from '../../src/lib/audio/local-frequency-meter.ts'

function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function track(settings = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }) {
  const value = new EventTarget()
  value.readyState = 'live'; value.muted = false; value.stops = 0
  value.stop = () => { value.stops++; value.readyState = 'ended' }
  value.getSettings = () => settings
  return value
}
function media(value = track()) { return { value, getTracks: () => [value], getAudioTracks: () => [value] } }

function environment(t, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const originals = new Map(['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const window = new EventTarget(), document = new EventTarget()
  window.isSecureContext = options.secure ?? true; document.visibilityState = 'visible'
  const contexts = [], requests = [], streams = []
  class Context extends EventTarget {
    constructor() {
      super(); this.state = 'suspended'; this.sampleRate = options.rate ?? 48000; this.closed = 0; this.destination = { forbidden: true }; this.connections = []
      contexts.push(this)
    }
    resume() { this.state = 'running'; return options.resume?.() ?? Promise.resolve() }
    close() { this.closed++; this.state = 'closed'; return Promise.resolve() }
    createAnalyser() {
      return { fftSize: 0, smoothingTimeConstant: 0, disconnect() {}, getFloatTimeDomainData: output => {
        if (options.analysisThrows) throw new Error('input failed')
        const hz = options.hz ?? 432
        for (let i = 0; i < output.length; i++) output[i] = 0.2 * Math.sin(2 * Math.PI * hz * i / this.sampleRate)
      } }
    }
    createMediaStreamSource(stream) {
      assert.equal(stream.getAudioTracks()[0].readyState, 'live')
      return { connect: node => this.connections.push(node), disconnect() {} }
    }
  }
  window.AudioContext = Context
  const devices = {
    getSupportedConstraints: () => ({ echoCancellation: true, noiseSuppression: true, autoGainControl: true }),
    getUserMedia: constraints => {
      requests.push(constraints)
      if (options.request) return options.request()
      const stream = media(track(options.settings)); streams.push(stream)
      return Promise.resolve(stream)
    },
  }
  for (const [key, value] of Object.entries({ window, document, navigator: { mediaDevices: devices } })) Object.defineProperty(globalThis, key, { value, configurable: true })
  const states = [], meter = createLocalFrequencyMeter(state => states.push(state))
  t.after(() => {
    meter.dispose(); t.mock.timers.reset()
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  })
  return { window, document, contexts, requests, streams, states, meter }
}

test('microphone off initially; local analyser never connects to the speakers', async t => {
  const env = environment(t)
  assert.equal(env.requests.length, 0)
  await env.meter.start()
  assert.equal(env.requests.length, 1)
  assert.equal(env.requests[0].video, false)
  assert.equal(env.requests[0].audio.echoCancellation.ideal, false)
  assert.equal(env.contexts[0].connections.length, 1)
  assert.ok(env.contexts[0].connections.every(node => node !== env.contexts[0].destination))
  assert.equal(env.meter.getState().status, 'listening')
  assert.equal(env.meter.getState().reading, null)
  t.mock.timers.tick(1000)
  t.mock.timers.tick(300)
  t.mock.timers.tick(300)
  assert.equal(env.meter.getState().reading.status, 'near_target')
  assert.equal(env.meter.getState().reading.dominantHz, 432)
  assert.equal(env.meter.getState().stable, true)
  env.meter.stop()
  assert.equal(env.streams[0].value.readyState, 'ended')
  assert.equal(env.contexts[0].closed, 1)
  assert.equal(env.meter.getState().reading, null)
})

test('432 target is never substituted for a captured 440 Hz signal', async t => {
  const env = environment(t, { hz: 440, rate: 44100 })
  await env.meter.start(); t.mock.timers.tick(1800)
  assert.equal(env.meter.getState().reading.status, 'off_target')
  assert.equal(env.meter.getState().reading.dominantHz, 440)
  assert.equal(env.meter.getState().stable, false)
})

test('duplicate start does not create another permission request or audio context', async t => {
  const pending = deferred(), env = environment(t, { request: () => pending.promise })
  const first = env.meter.start(); await env.meter.start()
  assert.equal(env.requests.length, 1); assert.equal(env.contexts.length, 1)
  pending.resolve(media()); await first
})

test('stop cancels pending start; a late granted microphone is stopped', async t => {
  const pending = deferred(), env = environment(t, { request: () => pending.promise })
  const started = env.meter.start()
  env.meter.stop(); await started
  assert.equal(env.meter.getState().status, 'idle')
  const late = media(); pending.resolve(late); await Promise.resolve(); await Promise.resolve()
  assert.equal(late.value.readyState, 'ended')
  assert.equal(env.meter.getState().reading, null)
})

test('late result from previous start cannot clear the next request timeout', async t => {
  const first = deferred(), second = deferred(); let call = 0
  const env = environment(t, { request: () => (++call === 1 ? first.promise : second.promise) })
  const old = env.meter.start(); env.meter.stop(); await old
  const next = env.meter.start()
  const late = media(); first.resolve(late); await Promise.resolve(); await Promise.resolve()
  t.mock.timers.tick(15001); await next
  assert.equal(env.meter.getState().status, 'error')
  assert.match(env.meter.getState().message, /temps/)
  assert.equal(late.value.readyState, 'ended')
  const secondLate = media(); second.resolve(secondLate); await Promise.resolve(); await Promise.resolve()
  assert.equal(secondLate.value.readyState, 'ended')
})

test('permission denial leaves no context running and no fabricated reading', async t => {
  const error = new Error('denied'); error.name = 'NotAllowedError'
  const env = environment(t, { request: () => Promise.reject(error) })
  await env.meter.start()
  assert.equal(env.meter.getState().status, 'error'); assert.match(env.meter.getState().message, /refusé/)
  assert.equal(env.contexts[0].state, 'closed'); assert.equal(env.meter.getState().reading, null)
})

test('missing secure context prevents capture', async t => {
  const env = environment(t, { secure: false }); await env.meter.start()
  assert.equal(env.requests.length, 0); assert.equal(env.meter.getState().status, 'unavailable')
})

test('unknown processing is not presented as disabled', async t => {
  const env = environment(t, { settings: {} }); await env.meter.start()
  assert.equal(env.meter.getState().processing, 'unknown')
})

test('enabled audio processing is visible', async t => {
  const env = environment(t, { settings: { echoCancellation: true, autoGainControl: false } }); await env.meter.start()
  assert.equal(env.meter.getState().processing, 'active')
})

test('page visibility stops capture and clears previous measured value', async t => {
  const env = environment(t); await env.meter.start(); t.mock.timers.tick(1800)
  env.document.visibilityState = 'hidden'; env.document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(env.streams[0].value.readyState, 'ended'); assert.equal(env.meter.getState().reading, null)
  assert.equal(env.meter.getState().status, 'idle')
})

test('track interruption stops capture instead of retaining a stale 432 Hz result', async t => {
  const env = environment(t); await env.meter.start(); t.mock.timers.tick(1800)
  env.streams[0].value.muted = true; env.streams[0].value.dispatchEvent(new Event('mute'))
  assert.equal(env.meter.getState().status, 'idle'); assert.equal(env.meter.getState().reading, null)
})

test('automatic duration limit frees the microphone', async t => {
  const env = environment(t); await env.meter.start(); t.mock.timers.tick(60001)
  assert.equal(env.meter.getState().status, 'idle'); assert.equal(env.streams[0].value.readyState, 'ended')
  assert.match(env.meter.getState().message, /minute/)
})

test('analysis failure frees capture and reports an error', async t => {
  const env = environment(t, { analysisThrows: true }); await env.meter.start(); t.mock.timers.tick(1200)
  assert.equal(env.meter.getState().status, 'error'); assert.equal(env.streams[0].value.readyState, 'ended')
})

test('dispose during permission request stops late stream and emits no more states', async t => {
  const pending = deferred(), env = environment(t, { request: () => pending.promise })
  const request = env.meter.start(); env.meter.dispose(); const count = env.states.length; await request
  const late = media(); pending.resolve(late); await Promise.resolve(); await Promise.resolve()
  assert.equal(late.value.readyState, 'ended'); assert.equal(env.states.length, count)
})

test('hiding the page during permission request prevents a late background capture', async t => {
  const pending = deferred(), env = environment(t, { request: () => pending.promise })
  const request = env.meter.start()
  env.document.visibilityState = 'hidden'; env.document.dispatchEvent(new Event('visibilitychange'))
  await request
  const late = media(); pending.resolve(late); await Promise.resolve(); await Promise.resolve()
  assert.equal(late.value.readyState, 'ended'); assert.equal(env.meter.getState().status, 'idle')
  assert.equal(env.contexts[0].connections.length, 0)
})

test('unsupported effective sample rate is explicit and does not capture audio', async t => {
  const env = environment(t, { rate: 96000 }); await env.meter.start()
  assert.equal(env.requests.length, 0); assert.equal(env.meter.getState().status, 'unavailable')
  assert.match(env.meter.getState().message, /format audio/)
  assert.equal(env.contexts[0].state, 'closed')
})
