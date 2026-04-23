// MUKTI — G5.3 AURORA Audio engine
// Client-only. Web Audio API natif (oscillators + biquad filters + gain envelopes).
// 3 couches : nappe aiguë montante (inspire), sub doux (expire), clic cristallin (pause).
// SpeechSynthesis opt-in pour guidage voix FR (désactivé par défaut).
//
// Pas de fichiers audio externes — tout synthétisé. Zéro latence, zéro bundle cost.

import type { BreathPhase } from '@/components/aurora/types'

type StopFn = () => void

export interface AuroraAudioHandle {
  start: () => void
  stop: () => void
  setPhase: (phase: BreathPhase) => void
  setEnabled: (enabled: boolean) => void
  setVoiceGuidance: (enabled: boolean) => void
  speakPhaseCue: (cue: string) => void
  dispose: () => void
}

export interface AuroraAudioConfig {
  /** Fréquence porteuse nappe inspire (Hz). Défaut 432 (solfeggio apaisant). */
  nappeFreqHz?: number
  /** Fréquence porteuse sub expire (Hz). Défaut 96 (proche de 96.5 vague). */
  subFreqHz?: number
  /** Master gain (0-1). Défaut 0.35 (non-agressif). */
  masterGain?: number
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

  const targetMasterGain = Math.max(0, Math.min(1, config.masterGain ?? 0.35))

  // --- Nappe (inspire) : triangle + lowpass, glide montant léger ---
  const nappeOsc = ctx.createOscillator()
  nappeOsc.type = 'triangle'
  nappeOsc.frequency.value = config.nappeFreqHz ?? 432

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
  subOsc.frequency.value = config.subFreqHz ?? 96

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
    o.start()
    o.stop(ctx.currentTime + 0.32)
  }

  let started = false
  let enabled = true
  let voiceGuidance = false
  let currentPhase: BreathPhase = 'idle'
  let ramps: StopFn[] = []

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
      // idle : tout à zéro doux
      ramps.push(rampGain(nappeGain.gain, 0, 1))
      ramps.push(rampGain(subGain.gain, 0, 1))
      ramps.push(rampGain(noiseGain.gain, 0, 1))
    }
  }

  function start() {
    if (started) return
    started = true
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    rampGain(master.gain, targetMasterGain, 1.2)
    setPhase(currentPhase)
  }

  function stop() {
    if (!started) return
    cancelRamps()
    rampGain(master.gain, 0, 0.8)
    started = false
    currentPhase = 'idle'
  }

  function setEnabled(next: boolean) {
    enabled = next
    if (!enabled) {
      cancelRamps()
      rampGain(nappeGain.gain, 0, 0.3)
      rampGain(subGain.gain, 0, 0.3)
      rampGain(noiseGain.gain, 0, 0.3)
    } else if (started) {
      setPhase(currentPhase)
    }
  }

  function setVoiceGuidance(v: boolean) {
    voiceGuidance = v
    if (!v) window.speechSynthesis?.cancel()
  }

  function speakPhaseCue(cue: string) {
    if (!voiceGuidance) return
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utter = new SpeechSynthesisUtterance(cue)
    utter.lang = 'fr-FR'
    utter.rate = 0.9
    utter.pitch = 0.95
    utter.volume = 0.7
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }

  function dispose() {
    try {
      cancelRamps()
      nappeOsc.stop()
      subOsc.stop()
      noiseSource.stop()
      window.speechSynthesis?.cancel()
      void ctx.close()
    } catch {
      /* noop */
    }
  }

  return {
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
    start: () => undefined,
    stop: () => undefined,
    setPhase: () => undefined,
    setEnabled: () => undefined,
    setVoiceGuidance: () => undefined,
    speakPhaseCue: () => undefined,
    dispose: () => undefined,
  }
}
