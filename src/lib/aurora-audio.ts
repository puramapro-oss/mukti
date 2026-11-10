// MUKTI — G5.3 AURORA Audio engine
// Client-only. Web Audio API natif (oscillators + biquad filters + gain envelopes).
// 3 couches : nappe aiguë montante (inspire), sub doux (expire), clic cristallin (pause).
// SpeechSynthesis opt-in pour guidage voix FR (désactivé par défaut).
//
// Synthèse locale. La latence et le niveau acoustique dépendent du matériel.

import type { BreathPhase } from '@/components/aurora/types'
import { createAuroraRitualLayers, normalizeRitualMix, type AuroraRitualMix } from './aurora-melody'

export type { AuroraRitualMix } from './aurora-melody'

type StopFn = () => void

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
  /** null restores the original breathing soundscape. Levels are relative 0..1. */
  setRitualMix?: (mix: AuroraRitualMix | null) => void
  /** Driven by the existing session clock; no second sequencing timer. */
  setPosition?: (elapsedSec: number) => void
  /** Ritual speech requires an explicitly selected French local-service voice. */
  getCapabilities?: () => { audio: boolean; voice: boolean }
}

export interface AuroraAudioConfig {
  /** Fréquence porteuse nappe inspire (Hz). Défaut 432, sans effet thérapeutique revendiqué. */
  nappeFreqHz?: number
  /** Fréquence porteuse sub expire (Hz). Défaut 96 (proche de 96.5 vague). */
  subFreqHz?: number
  /** Gain numérique (0-1), sans garantie de niveau acoustique. Défaut 0.35. */
  masterGain?: number
  /** Ritual only: let the caller keep text/music running and report lost speech. */
  onVoiceError?: (reason: 'unavailable' | 'playback') => void
}

export function createAuroraAudio(config: AuroraAudioConfig = {}): AuroraAudioHandle {
  if (typeof window === 'undefined') {
    // Server-side fallback no-op
    return noopHandle()
  }

  const Ctx = (window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!Ctx) return noopHandle()

  const ctx = new Ctx()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const targetMasterGain = Number.isFinite(config.masterGain)
    ? Math.max(0, Math.min(1, config.masterGain!)) : 0.35
  const frequency = (value: number | undefined, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 && value < ctx.sampleRate / 2 ? value : fallback
  const transients = new Set<{ oscillator: OscillatorNode; gain: GainNode }>()

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
    if (!started) return
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
    o.onended = () => { o.disconnect(); g.disconnect(); transients.delete(transient) }
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
  let ritualMix: AuroraRitualMix | null = null
  let ritualLayers: ReturnType<typeof createAuroraRitualLayers> | null = null
  let position = 0
  let speechGeneration = 0
  let currentUtterance: SpeechSynthesisUtterance | null = null

  function speechSupported() {
    return typeof window.speechSynthesis?.speak === 'function' && typeof SpeechSynthesisUtterance !== 'undefined'
  }

  function localFrenchVoice(): SpeechSynthesisVoice | null {
    // Ritual cues contain personal goals. Never use an implicit/default voice,
    // which may send the text to a remote synthesis service.
    try {
      const voices = window.speechSynthesis?.getVoices?.()
      return Array.isArray(voices)
        ? voices.find((voice) => voice.localService === true && /^fr(?:-|$)/i.test(voice.lang)) ?? null
        : null
    } catch { return null }
  }

  function voiceAvailable() {
    return speechSupported() && (ritualMix === null || localFrenchVoice() !== null)
  }

  function cancelVoice() {
    speechGeneration += 1
    currentUtterance = null
    window.speechSynthesis?.cancel()
    ritualLayers?.setDucked(false)
  }

  function stopTransients() {
    for (const node of transients) {
      node.oscillator.stop()
      node.oscillator.disconnect()
      node.gain.disconnect()
    }
    transients.clear()
  }

  function silenceBreathingLayers() {
    cancelRamps()
    for (const layer of [nappeGain, subGain, noiseGain]) {
      layer.gain.cancelScheduledValues(ctx.currentTime)
      layer.gain.setValueAtTime(0, ctx.currentTime)
    }
    stopTransients()
  }

  function applyMaster(seconds: number) {
    const audible = started && enabled && (ritualMix === null || ritualMix.music > 0 || ritualMix.tone > 0)
    if (audible) rampGain(master.gain, targetMasterGain, seconds)
    else {
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setValueAtTime(0, ctx.currentTime)
    }
  }

  function setRitualMix(mix: AuroraRitualMix | null) {
    if (disposed) return
    const next = mix === null ? null : normalizeRitualMix(mix)
    const previous = ritualMix
    ritualMix = next
    if (next === null) {
      ritualLayers?.setRunning(false)
      cancelVoice()
      applyMaster(0.3)
      setPhase(currentPhase)
      return
    }
    silenceBreathingLayers()
    ritualLayers ??= createAuroraRitualLayers(ctx, master)
    ritualLayers.setMix(next)
    ritualLayers.setPosition(position)
    ritualLayers.setRunning(started && enabled)
    if (next.voice === 0 || previous === null) cancelVoice()
    else if (currentUtterance) currentUtterance.volume = next.voice
    applyMaster(0.3)
  }

  function setPosition(elapsedSec: number) {
    if (disposed || !Number.isFinite(elapsedSec) || elapsedSec < 0) return
    position = elapsedSec
    ritualLayers?.setPosition(elapsedSec)
  }

  function cancelRamps() {
    ramps.forEach((r) => r())
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
    if (!started || !enabled || ritualMix !== null) return
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
      // idle : tout à zéro doux
      ramps.push(rampGain(nappeGain.gain, 0, 1))
      ramps.push(rampGain(subGain.gain, 0, 1))
      ramps.push(rampGain(noiseGain.gain, 0, 1))
    }
  }

  async function prepare() {
    if (disposed) return
    if (ctx.state === 'closed') throw new Error('Audio indisponible. Réessaie.')
    let timeout: ReturnType<typeof setTimeout> | undefined
    // Toujours ordonner resume après un éventuel suspend encore en attente.
    try {
      await Promise.race([ctx.resume(), new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Audio indisponible. Réessaie.')), 5000)
      })])
      if (ctx.state !== 'running') throw new Error('Audio indisponible. Réessaie.')
    } finally {
      clearTimeout(timeout)
    }
  }

  async function start() {
    if (started || disposed) return
    const ticket = ++generation
    try { await prepare() } catch (error) {
      if (disposed || ticket !== generation) return
      throw error
    }
    if (disposed || ticket !== generation) return
    started = true
    applyMaster(1.2)
    ritualLayers?.setRunning(enabled && ritualMix !== null)
    setPhase(currentPhase)
  }

  function stop() {
    generation += 1
    if (disposed) return
    cancelRamps()
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(0, ctx.currentTime)
    started = false
    currentPhase = 'idle'
    ritualLayers?.setRunning(false)
    stopTransients()
    cancelVoice()
    // Le master est déjà muet, même si le navigateur refuse la suspension.
    void ctx.suspend().catch(() => undefined)
  }

  function setEnabled(next: boolean) {
    if (disposed) return
    enabled = next
    if (!enabled) {
      cancelRamps()
      rampGain(nappeGain.gain, 0, 0.3)
      rampGain(subGain.gain, 0, 0.3)
      rampGain(noiseGain.gain, 0, 0.3)
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setValueAtTime(0, ctx.currentTime)
      ritualLayers?.setRunning(false)
      cancelVoice()
    } else if (started) {
      applyMaster(0.3)
      ritualLayers?.setRunning(ritualMix !== null)
      setPhase(currentPhase)
    }
  }

  function setVoiceGuidance(v: boolean) {
    if (disposed) return
    voiceGuidance = v
    if (!v) cancelVoice()
  }

  function speakPhaseCue(cue: string) {
    if (!voiceGuidance || !started || !enabled || disposed) return
    if (ritualMix?.voice === 0 || !cue.trim()) return
    // Recheck at speech time: the platform's voice list can change after start.
    const selectedVoice = ritualMix === null ? null : localFrenchVoice()
    if (!speechSupported() || (ritualMix !== null && !selectedVoice)) {
      if (ritualMix !== null) {
        cancelVoice()
        config.onVoiceError?.('unavailable')
      }
      return
    }
    cancelVoice()
    const ticket = speechGeneration
    const sessionTicket = generation
    const utter = new SpeechSynthesisUtterance(cue)
    currentUtterance = utter
    utter.lang = selectedVoice?.lang ?? 'fr-FR'
    if (selectedVoice) utter.voice = selectedVoice
    utter.rate = 0.9
    utter.pitch = 0.95
    utter.volume = ritualMix?.voice ?? 0.7
    const current = () => !disposed && started && enabled && voiceGuidance &&
      ticket === speechGeneration && sessionTicket === generation && currentUtterance === utter
    const finish = (failed = false) => {
      if (!current()) return
      currentUtterance = null
      speechGeneration += 1
      ritualLayers?.setDucked(false)
      if (failed && ritualMix !== null) config.onVoiceError?.('playback')
    }
    utter.onstart = () => { if (current()) ritualLayers?.setDucked(true) }
    utter.onend = () => finish()
    utter.onerror = () => finish(true)
    ritualLayers?.setDucked(true)
    try { window.speechSynthesis.speak(utter) } catch { finish(true) }
  }

  function dispose() {
    if (disposed) return
    stop()
    disposed = true
    try {
      cancelRamps()
      nappeOsc.stop()
      subOsc.stop()
      noiseSource.stop()
      ritualLayers?.dispose()
      window.speechSynthesis?.cancel()
      void ctx.close().catch(() => undefined)
    } catch {
      /* noop */
    }
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
    setRitualMix,
    setPosition,
    getCapabilities: () => ({ audio: !disposed && ctx.state !== 'closed', voice: !disposed && ctx.state !== 'closed' && voiceAvailable() }),
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
    setRitualMix: () => undefined,
    setPosition: () => undefined,
    getCapabilities: () => ({ audio: false, voice: false }),
  }
}
