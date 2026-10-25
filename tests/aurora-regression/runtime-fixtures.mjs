/** Test doubles only: no hardware or acoustic calibration. */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
const sourceDir = process.env.MUKTI_SOURCE_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/lib')

export function load(name, globals = {}) {
  const source = fs.readFileSync(path.join(sourceDir, name + '.ts'), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(js, { exports, DOMException, AbortController, Promise, Number, Set, Math,
    setTimeout, clearTimeout, ...globals }, { filename: name + '.js' })
  return exports
}
export const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
function timerFixture() {
  const pending = new Map(); let counter = 0
  return { pending, setTimeout(fn) { pending.set(++counter, fn); return counter },
    clearTimeout(id) { pending.delete(id) }, expire() { for (const [id, fn] of [...pending]) { pending.delete(id); fn() } } }
}
export function apiFixture(fetch) {
  const timer = timerFixture()
  const { auroraRequest } = load('aurora-session-api', { fetch, setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout })
  return { timer, request: auroraRequest }
}
export const response = (value, ok = true) => ({ ok, json: async () => value })


class Param {
  constructor(value = 0) { this.value = value; this.events = [] }
  cancelScheduledValues(t) { this.events.push(['cancel', t]); if (this.throwOnCancel) throw new Error('cancel failed') }
  setValueAtTime(v, t) { if (!Number.isFinite(v)) throw new Error('non-finite parameter'); this.value = v; this.events.push(['set', v, t]) }
  linearRampToValueAtTime(v, t) { if (!Number.isFinite(v)) throw new Error('non-finite parameter'); this.value = v; this.events.push(['linear', v, t]) }
  exponentialRampToValueAtTime(v, t) { if (!Number.isFinite(v) || v <= 0) throw new Error('invalid exponential value'); this.value = v; this.events.push(['exp', v, t]) }
}
class AudioNode {
  constructor() { this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); this.stops = 0; this.disconnections = 0 }
  connect() {}
  disconnect() { this.disconnections++; if (this.throwOnDisconnect) throw new Error('disconnect failed') }
  start() {}
  stop() { this.stops++; if (this.throwOnStop) throw new Error('stop failed') }
}
export function audioFixture({ support = true, voiceThrows = false, utterance = true, rejectResume = false } = {}) {
  const contexts = []
  class Context {
    constructor() { contexts.push(this); this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; this.gains = []; this.sources = []; this.filters = []; this.closed = 0; this.state = 'suspended' }
    createGain() { const n = new AudioNode(); this.gains.push(n); return n }
    createOscillator() { const n = new AudioNode(); this.sources.push(n); return n }
    createBiquadFilter() { const n = new AudioNode(); this.filters.push(n); return n }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) } }
    createBufferSource() { const n = new AudioNode(); this.sources.push(n); return n }
    async resume() { if (rejectResume) throw new Error('resume rejected'); this.state = 'running' }
    async suspend() { this.state = 'suspended' }
    async close() { this.closed++; this.state = 'closed' }
  }
  const speech = { cancellations: 0, cues: [], cancel() { this.cancellations++; if (voiceThrows) throw new Error('voice unavailable') }, speak(cue) { this.cues.push(cue); if (voiceThrows) throw new Error('voice unavailable') } }
  const window = { speechSynthesis: speech }; if (support) window.AudioContext = Context
  const globals = { window }
  if (utterance) globals.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
  const { createAuroraAudio } = load('aurora-audio', globals)
  return { create: createAuroraAudio, context: () => contexts.at(-1), speech }
}

