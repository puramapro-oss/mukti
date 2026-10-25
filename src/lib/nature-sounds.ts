// MUKTI — G5.4 Nature Sounds procéduraux (Web Audio natif, client-only)
// 5 ambiances synthétisées : forêt, rivière, vent, pluie, océan + silence.
// Synthèse locale. Le niveau acoustique dépend du casque et du matériel utilisé.

import type { NatureSound } from './constants'
import { buildNatureSound } from './nature-sound-builders'

export interface NatureSoundHandle {
  start: () => void
  stop: () => void
  setVolume: (vol: number) => void // 0-1
  setSound: (sound: NatureSound) => void
  dispose: () => void
}

/**
 * Crée un moteur de son nature. Client-only (AudioContext).
 * Transitions progressives ; arrêt explicite immédiat et annulation des tâches différées.
 */
export function createNatureSoundEngine(): NatureSoundHandle {
  if (typeof window === 'undefined') return noopHandle()

  const Ctx = (window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!Ctx) return noopHandle()

  const ctx = new Ctx()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  let currentSound: NatureSound = 'silence'
  let targetVolume = 0.5
  let nodes: AudioNode[] = []
  let intervalIds: ReturnType<typeof setInterval>[] = []
  let started = false
  let disposed = false
  let generation = 0
  let graphGeneration = 0
  let switchGeneration = 0
  let switchTimer: ReturnType<typeof setTimeout> | null = null
  type Transient = { source: OscillatorNode; gain: GainNode }
  const transients = new Set<Transient>()

  function cleanup(action: () => void) {
    try { action() } catch { /* One failed cleanup must not leave other outputs active. */ }
  }

  function cancelSwitch() {
    switchGeneration += 1
    if (switchTimer !== null) clearTimeout(switchTimer)
    switchTimer = null
  }

  function silenceMaster() {
    cleanup(() => master.gain.cancelScheduledValues(ctx.currentTime))
    try {
      master.gain.setValueAtTime(0, ctx.currentTime)
    } catch {
      // Fail closed if a broken context refuses to zero its output.
      cleanup(() => master.disconnect())
    }
  }

  function releaseTransient(transient: Transient, stopSource: boolean) {
    if (!transients.delete(transient)) return
    transient.source.onended = null
    if (stopSource) cleanup(() => transient.source.stop())
    cleanup(() => transient.source.disconnect())
    cleanup(() => transient.gain.disconnect())
  }

  function trackTransient(source: OscillatorNode, gain: GainNode) {
    const transient = { source, gain }
    transients.add(transient)
    source.onended = () => releaseTransient(transient, false)
  }

  function scheduleEffect(effect: () => void, delay: number) {
    const graph = graphGeneration
    intervalIds.push(setInterval(() => {
      if (disposed || !started || graph !== graphGeneration) return
      effect()
    }, delay))
  }

  function disposeCurrent() {
    graphGeneration += 1
    intervalIds.forEach((id) => clearInterval(id))
    intervalIds = []
    for (const transient of [...transients]) releaseTransient(transient, true)
    const previous = nodes
    nodes = []
    for (const node of previous) {
      if ('stop' in node && typeof (node as AudioBufferSourceNode).stop === 'function') {
        cleanup(() => (node as AudioBufferSourceNode).stop())
      }
      cleanup(() => node.disconnect())
    }
  }

  function rebuildForSound(sound: NatureSound) {
    disposeCurrent()
    buildNatureSound(sound, {
      ctx, master, nodes, trackTransient, scheduleEffect,
      isActive: () => started && !disposed,
    })
  }

  function start() {
    if (started || disposed) return
    cancelSwitch()
    const ticket = ++generation
    started = true
    try {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {
          if (!disposed && ticket === generation) stop()
        })
      }
      rebuildForSound(currentSound)
      fadeGain(master.gain, targetVolume, 1.5)
    } catch (error) {
      stop()
      throw error
    }
  }

  function stop() {
    if (disposed) return
    generation += 1
    started = false
    cancelSwitch()
    silenceMaster()
    disposeCurrent()
  }

  function setVolume(vol: number) {
    if (disposed) return
    targetVolume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0
    if (started) {
      if (!Number.isFinite(vol)) silenceMaster()
      else fadeGain(master.gain, targetVolume, 0.5)
    }
  }

  function setSound(sound: NatureSound) {
    if (disposed || sound === currentSound) return
    if (!['foret', 'riviere', 'vent', 'pluie', 'ocean', 'silence'].includes(sound)) return
    currentSound = sound
    cancelSwitch()
    if (!started) return
    const ticket = generation
    const change = switchGeneration
    // A later change or stop invalidates even an already queued callback.
    fadeGain(master.gain, 0, 0.8)
    switchTimer = setTimeout(() => {
      if (disposed || !started || ticket !== generation || change !== switchGeneration) return
      switchTimer = null
      try {
        rebuildForSound(currentSound)
        fadeGain(master.gain, targetVolume, 1.0)
      } catch {
        stop()
      }
    }, 850)
  }

  function dispose() {
    if (disposed) return
    stop()
    disposed = true
    cleanup(() => master.disconnect())
    cleanup(() => { void ctx.close().catch(() => undefined) })
  }

  function fadeGain(param: AudioParam, target: number, seconds: number) {
    const now = ctx.currentTime
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(target, now + Math.max(0.01, seconds))
  }

  return { start, stop, setVolume, setSound, dispose }
}

function noopHandle(): NatureSoundHandle {
  return {
    start: () => undefined,
    stop: () => undefined,
    setVolume: () => undefined,
    setSound: () => undefined,
    dispose: () => undefined,
  }
}
