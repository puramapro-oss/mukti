// MUKTI — G5.4 Nature Sounds procéduraux (Web Audio natif, client-only)
// 5 ambiances synthétisées : forêt, rivière, vent, pluie, océan + silence.
// Zéro fichier externe, zéro bundle cost, loop infini naturel via modulation stochastique.

import type { NatureSound } from './constants'

export interface NatureSoundHandle {
  start: () => void
  stop: () => void
  setVolume: (vol: number) => void // 0-1
  setSound: (sound: NatureSound) => void
  dispose: () => void
}

/**
 * Crée un moteur de son nature. Client-only (AudioContext).
 * Fade in/out 1.5s inter-changements.
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

  // --- Bruit coloré (white / pink / brown) via buffer 2s loopé ---
  function createNoiseBuffer(color: 'white' | 'pink' | 'brown'): AudioBuffer {
    const bufferSize = 2 * ctx.sampleRate
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    if (color === 'white') {
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    } else if (color === 'pink') {
      // Paul Kellet pink noise filter
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      }
    } else {
      // brown (red) noise : integration
      let last = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      }
    }
    return buffer
  }

  function disposeCurrent() {
    intervalIds.forEach((id) => clearInterval(id))
    intervalIds = []
    nodes.forEach((n) => {
      try {
        if ('stop' in n && typeof (n as AudioBufferSourceNode).stop === 'function') {
          ;(n as AudioBufferSourceNode).stop()
        }
        n.disconnect()
      } catch {
        /* noop */
      }
    })
    nodes = []
  }

  // ----------------- Constructors par ambiance -----------------
  function buildForest() {
    // Bruit vert (bandpass 800-2000Hz) + chants d'oiseaux occasionnels (sine burst aigu)
    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer('pink')
    noise.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.value = 0.55
    // LFO modulation filter freq pour "vent dans les arbres"
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.12
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 400
    lfo.connect(lfoGain)
    lfoGain.connect(bp.frequency)
    lfo.start()

    noise.connect(bp)
    bp.connect(g)
    g.connect(master)
    noise.start()
    nodes.push(noise, bp, g, lfo, lfoGain)

    // Chants d'oiseaux : tirer 1 burst toutes les 8-20s
    const birdInterval = setInterval(
      () => {
        if (Math.random() < 0.5) spawnBirdCall()
      },
      6000 + Math.random() * 12000
    )
    intervalIds.push(birdInterval)
  }

  function spawnBirdCall() {
    const now = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    const baseFreq = 2000 + Math.random() * 2500
    o.frequency.setValueAtTime(baseFreq, now)
    o.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.15)
    o.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.3)
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.linearRampToValueAtTime(0.08, now + 0.05)
    g.gain.linearRampToValueAtTime(0.0001, now + 0.45)
    o.connect(g)
    g.connect(master)
    o.start(now)
    o.stop(now + 0.5)
  }

  function buildRiver() {
    // Bruit pink + bandpass 1500-3500Hz + LFO amplitude pour pulsations d'eau
    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer('pink')
    noise.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2500
    bp.Q.value = 0.4
    const g = ctx.createGain()
    g.gain.value = 0.6

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.4
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.15
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    lfo.start()

    noise.connect(bp)
    bp.connect(g)
    g.connect(master)
    noise.start()
    nodes.push(noise, bp, g, lfo, lfoGain)
  }

  function buildWind() {
    // Bruit brown + lowpass 800Hz + LFO lent pour souffles
    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer('brown')
    noise.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    lp.Q.value = 0.5
    const g = ctx.createGain()
    g.gain.value = 0.55

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.08
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.25
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    lfo.start()

    noise.connect(lp)
    lp.connect(g)
    g.connect(master)
    noise.start()
    nodes.push(noise, lp, g, lfo, lfoGain)
  }

  function buildRain() {
    // Bruit white + highpass 2500Hz + micro-pops aléatoires (clic sine bref)
    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer('white')
    noise.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2800
    hp.Q.value = 0.5
    const g = ctx.createGain()
    g.gain.value = 0.45

    noise.connect(hp)
    hp.connect(g)
    g.connect(master)
    noise.start()
    nodes.push(noise, hp, g)

    // Gouttes isolées plus grasses — intervalle 60-200ms
    const dropInterval = setInterval(() => {
      spawnDrop()
    }, 80 + Math.random() * 120)
    intervalIds.push(dropInterval)
  }

  function spawnDrop() {
    const now = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    const f = 400 + Math.random() * 800
    o.frequency.setValueAtTime(f, now)
    o.frequency.exponentialRampToValueAtTime(f * 0.6, now + 0.08)
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.linearRampToValueAtTime(0.04, now + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
    o.connect(g)
    g.connect(master)
    o.start(now)
    o.stop(now + 0.12)
  }

  function buildOcean() {
    // Bruit brown + lowpass 600Hz + LFO amplitude très lent (vagues 0.1Hz)
    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer('brown')
    noise.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 700
    lp.Q.value = 0.6
    const g = ctx.createGain()
    g.gain.value = 0.6

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.1
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.35
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    lfo.start()

    noise.connect(lp)
    lp.connect(g)
    g.connect(master)
    noise.start()
    nodes.push(noise, lp, g, lfo, lfoGain)
  }

  function rebuildForSound(sound: NatureSound) {
    disposeCurrent()
    if (sound === 'foret') buildForest()
    else if (sound === 'riviere') buildRiver()
    else if (sound === 'vent') buildWind()
    else if (sound === 'pluie') buildRain()
    else if (sound === 'ocean') buildOcean()
    // 'silence' : rien (pas de build)
  }

  function start() {
    if (started) return
    started = true
    if (ctx.state === 'suspended') void ctx.resume()
    rebuildForSound(currentSound)
    fadeGain(master.gain, targetVolume, 1.5)
  }

  function stop() {
    if (!started) return
    fadeGain(master.gain, 0, 1.5)
    setTimeout(() => {
      disposeCurrent()
      started = false
    }, 1600)
  }

  function setVolume(vol: number) {
    targetVolume = Math.max(0, Math.min(1, vol))
    if (started) fadeGain(master.gain, targetVolume, 0.5)
  }

  function setSound(sound: NatureSound) {
    if (sound === currentSound) return
    const wasStarted = started
    currentSound = sound
    if (wasStarted) {
      // fade out, swap, fade in
      fadeGain(master.gain, 0, 0.8)
      setTimeout(() => {
        rebuildForSound(sound)
        fadeGain(master.gain, targetVolume, 1.0)
      }, 850)
    }
  }

  function dispose() {
    try {
      disposeCurrent()
      void ctx.close()
    } catch {
      /* noop */
    }
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
