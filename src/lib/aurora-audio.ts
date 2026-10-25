// MUKTI — G5.3 AURORA Audio engine
// Client-only. Web Audio API natif (oscillators + biquad filters + gain envelopes).
// 3 couches : nappe aiguë montante (inspire), sub doux (expire), clic cristallin (pause).
// SpeechSynthesis opt-in pour guidage voix FR (désactivé par défaut).
//
// Synthèse locale. La latence et le niveau acoustique dépendent du matériel.

import type { BreathPhase } from '@/components/aurora/types'

type StopFn = () => void
type TransientTone = { oscillator: OscillatorNode; gain: GainNode }

export interface AuroraAudioHandle {
  /** Déverrouille le contexte pendant le geste utilisateur, sans émettre de son. */
  prepare: () => Promise<void>
  start: () => Promise<void>
  stop: () => void
  setPhase: (phase: BreathPhase) => void
  setEnabled: (enabled: boolean) => void
  setVoiceGuidance: (enabled: boolean) => void
  speakPhaseCue: (cue: string) => void
  dispose: () => void
}

export interface AuroraAudioConfig {
  /** Fréquence porteuse nappe inspire (Hz). Défaut 432, sans effet thérapeutique revendiqué. */
  nappeFreqHz?: number
  /** Fréquence porteuse sub expire (Hz). Défaut 96 (proche de 96.5 vague). */
  subFreqHz?: number
  /** Gain numérique (0-1), sans garantie de niveau acoustique. Défaut 0.35. */
  masterGain?: number
}

export function createAuroraAudio(config: AuroraAudioConfig = {}): AuroraAudioHandle {
  if (typeof window === 'undefined') {
    // Server-side fallback no-op
    return noopHandle()
  }

  const Ctx = (window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!Ctx) {
    const unavailable = async () => { throw new Error('Audio indisponible dans ce navigateur.') }
    return { ...noopHandle(), prepare: unavailable, start: unavailable }
  }

  const ctx = new Ctx()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const targetMasterGain = Number.isFinite(config.masterGain)
    ? Math.max(0, Math.min(1, config.masterGain!)) : 0.35
  const frequency = (value: number | undefined, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 && value < ctx.sampleRate / 2 ? value : fallback
  const transients = new Set<TransientTone>()

  // --- Nappe (inspire) : triangle + lowpass, glide montant léger ---
  const nappeOsc = ctx.createOscillator()
  nappeOsc.type = 'triangle'
  nappeOsc.frequency.value = frequency(config.nappeFreqHz, 432)

  const nappeFilter = ctx.createBiquadFilter()
  nappeFilter.type = 'lowpass'
  nappeFilter.frequency.value = 1200
  nappeFilter.Q.value = 0.7

  const nappeGain = ctx.createGain()
  nappeGain.gain.value = 0

  nappeOsc.connect(nappeFilter)
  nappeFilter.connect(nappeGain)
  nappeGain.connect(master)
  nappeOsc.start()

  // --- Sub (expire) : sine + lowpass très filtré, souffle de velours ---
  const subOsc = ctx.createOscillator()
  subOsc.type = 'sine'
  subOsc.frequency.value = frequency(config.subFreqHz, 96)

  const subGain = ctx.createGain()
  subGain.gain.value = 0

  subOsc.connect(subGain)
  subGain.connect(master)
  subOsc.start()

  // --- Noise (souffle velours, couche subtile sur expire) ---
  // Buffer de bruit blanc → filtré en hautes médiums (1-3 kHz) pour un "shhh" doux
  const bufferSize = 2 * ctx.sampleRate
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) noiseData[i] = Math.random() * 2 - 1

  const noiseSource = ctx.createBufferSource()
  noiseSource.buffer = noiseBuffer
  noiseSource.loop = true
  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.value = 2000
  noiseFilter.Q.value = 0.5
  const noiseGain = ctx.createGain()
  noiseGain.gain.value = 0
  noiseSource.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(master)
  noiseSource.start()

  // --- Clic cristallin (pause / hold) : burst court aigu enveloppé ---
  function clickCristallin() {
    if (!started || !enabled || disposed || targetMasterGain === 0) return
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(1800, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(3600, ctx.currentTime + 0.04)
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.linearRampToValueAtTime(0.25 * targetMasterGain, ctx.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
    o.connect(g)
    g.connect(master)
    const transient = { oscillator: o, gain: g }
    transients.add(transient)
    o.onended = () => releaseTransient(transient)
    o.start()
    o.stop(ctx.currentTime + 0.32)
  }

  let started = false
  let disposed = false
  let generation = 0
  let enabled = true
  let voiceGuidance = false
  let currentPhase: BreathPhase = 'idle'
  let ramps: StopFn[] = []

  // Cleanup must continue even if an optional browser API fails.
  function cleanup(action: () => void) {
    try { action() } catch { /* best effort cleanup; never skip other outputs */ }
  }

  // Keep cancellation and zeroing independent: a failed optional operation
  // must not skip the remaining mute/stop actions.
  function silenceGain(node: GainNode) {
    cleanup(() => node.gain.cancelScheduledValues(ctx.currentTime))
    cleanup(() => node.gain.setValueAtTime(0, ctx.currentTime))
  }

  function releaseTransient(node: TransientTone, stop = false) {
    node.oscillator.onended = null
    if (stop) {
      silenceGain(node.gain)
      cleanup(() => node.oscillator.stop())
    }
    cleanup(() => node.oscillator.disconnect())
    cleanup(() => node.gain.disconnect())
    transients.delete(node)
  }

  function cancelTransients() {
    for (const node of transients) releaseTransient(node, true)
    transients.clear()
  }

  function cancelVoice() {
    cleanup(() => window.speechSynthesis?.cancel())
  }

  function cancelRamps() {
    ramps.forEach((r) => cleanup(r))
    ramps = []
  }

  function rampGain(
    param: AudioParam,
    target: number,
    seconds: number
  ): StopFn {
    const now = ctx.currentTime
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(target, now + seconds)
    return () => {
      param.cancelScheduledValues(ctx.currentTime)
      param.setValueAtTime(param.value, ctx.currentTime)
    }
  }

  function setPhase(phase: BreathPhase) {
    if (disposed) return
    currentPhase = phase
    if (!started || !enabled) return
    cancelRamps()

    if (phase === 'inspire') {
      // Nappe monte, sub s'efface, noise léger
      ramps.push(rampGain(nappeGain.gain, 0.55 * targetMasterGain, 1.2))
      ramps.push(rampGain(subGain.gain, 0.08 * targetMasterGain, 1.2))
      ramps.push(rampGain(noiseGain.gain, 0.04 * targetMasterGain, 1.2))
    } else if (phase === 'expire') {
      // Sub s'étend, noise velours monte, nappe descend
      ramps.push(rampGain(nappeGain.gain, 0.12 * targetMasterGain, 1.6))
      ramps.push(rampGain(subGain.gain, 0.55 * targetMasterGain, 1.6))
      ramps.push(rampGain(noiseGain.gain, 0.18 * targetMasterGain, 1.6))
    } else if (phase === 'hold') {
      // Silence + clic cristallin à l'entrée
      ramps.push(rampGain(nappeGain.gain, 0.08 * targetMasterGain, 0.5))
      ramps.push(rampGain(subGain.gain, 0.05 * targetMasterGain, 0.5))
      ramps.push(rampGain(noiseGain.gain, 0.0, 0.5))
      clickCristallin()
    } else {
      // idle : tout à zéro doux, sans conserver un clic de la phase précédente.
      cancelTransients()
      ramps.push(rampGain(nappeGain.gain, 0, 1))
      ramps.push(rampGain(subGain.gain, 0, 1))
      ramps.push(rampGain(noiseGain.gain, 0, 1))
    }
  }

  async function prepare() {
    if (disposed) return
    let timeout: ReturnType<typeof setTimeout> | undefined
    // Toujours ordonner resume après un éventuel suspend encore en attente.
    try {
      await Promise.race([ctx.resume(), new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Audio indisponible. Réessaie.')), 5000)
      })])
    } finally {
      clearTimeout(timeout)
    }
  }

  async function start() {
    if (started || disposed) return
    const ticket = ++generation
    await prepare()
    if (disposed || ticket !== generation) return
    started = true
    rampGain(master.gain, enabled ? targetMasterGain : 0, 1.2)
    setPhase(currentPhase)
  }

  function stop() {
    generation += 1
    if (disposed) return
    cancelRamps()
    // Reset every layer: a subsequent start must not replay a previous envelope.
    for (const node of [master, nappeGain, subGain, noiseGain]) silenceGain(node)
    started = false
    currentPhase = 'idle'
    cancelTransients()
    cancelVoice()
    // Le master est déjà muet, même si le navigateur refuse la suspension.
    cleanup(() => { void ctx.suspend().catch(() => undefined) })
  }

  function setEnabled(next: boolean) {
    if (disposed || next === enabled) return
    enabled = next
    if (!enabled) {
      // Mute first; pending transients must not reappear on a fast unmute.
      silenceGain(master)
      cancelVoice()
      cancelRamps()
      for (const node of [nappeGain, subGain, noiseGain]) silenceGain(node)
      cancelTransients()
    } else if (started) {
      rampGain(master.gain, targetMasterGain, 0.3)
      setPhase(currentPhase)
    }
  }

  function setVoiceGuidance(v: boolean) {
    if (disposed) return
    voiceGuidance = v
    if (!v) cancelVoice()
  }

  function speakPhaseCue(cue: string) {
    if (!voiceGuidance || !started || !enabled || disposed || targetMasterGain === 0) return
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance !== 'function') return
    // Optional voice failures must not interrupt the phase clock or its stop path.
    try {
      const utter = new SpeechSynthesisUtterance(cue)
      utter.lang = 'fr-FR'
      utter.rate = 0.9
      utter.pitch = 0.95
      utter.volume = 0.7
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    } catch { /* Voice is optional; visual guidance remains available. */ }
  }

  function dispose() {
    if (disposed) return
    stop()
    disposed = true
    cancelRamps()
    for (const source of [nappeOsc, subOsc, noiseSource]) {
      cleanup(() => source.stop())
      cleanup(() => source.disconnect())
    }
    for (const node of [nappeFilter, noiseFilter, nappeGain, subGain, noiseGain, master]) {
      cleanup(() => node.disconnect())
    }
    cancelVoice()
    cleanup(() => { void ctx.close().catch(() => undefined) })
  }

  return {
    prepare,
    start,
    stop,
    setPhase,
    setEnabled,
    setVoiceGuidance,
    speakPhaseCue,
    dispose,
  }
}

function noopHandle(): AuroraAudioHandle {
  return {
    prepare: async () => undefined,
    start: async () => undefined,
    stop: () => undefined,
    setPhase: () => undefined,
    setEnabled: () => undefined,
    setVoiceGuidance: () => undefined,
    speakPhaseCue: () => undefined,
    dispose: () => undefined,
  }
}
