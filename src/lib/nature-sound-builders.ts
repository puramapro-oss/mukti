// MUKTI — Procedural ambience graphs, independent of session lifecycle.
import type { NatureSound } from './constants'

interface NatureGraphOptions {
  ctx: AudioContext
  master: GainNode
  nodes: AudioNode[]
  isActive: () => boolean
  trackTransient: (source: OscillatorNode, gain: GainNode) => void
  scheduleEffect: (effect: () => void, delay: number) => void
}

export function buildNatureSound(sound: NatureSound, options: NatureGraphOptions): void {
  const { ctx, master, nodes, isActive, trackTransient, scheduleEffect } = options
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
    scheduleEffect(
      () => {
        if (Math.random() < 0.5) spawnBirdCall()
      },
      6000 + Math.random() * 12000
    )
  }

  function spawnBirdCall() {
    if (!isActive()) return
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
    trackTransient(o, g)
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
    scheduleEffect(() => {
      spawnDrop()
    }, 80 + Math.random() * 120)
  }

  function spawnDrop() {
    if (!isActive()) return
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
    trackTransient(o, g)
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

  if (sound === 'foret') buildForest()
  else if (sound === 'riviere') buildRiver()
  else if (sound === 'vent') buildWind()
  else if (sound === 'pluie') buildRain()
  else if (sound === 'ocean') buildOcean()
  // Silence intentionally creates no sound sources.
}
