import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuroraAudio, type AuroraAudioConfig, type AuroraAudioHandle } from '../../src/lib/aurora-audio'
import { AURORA_RITUAL_MELODY, melodyAtPosition, normalizeRitualMix } from '../../src/lib/aurora-melody'

type Automation = { kind: 'set' | 'linear' | 'exponential'; value: number; at: number }

// Inspect the connected graph and scheduled gains, including after time advances.
// This is a Web Audio double, not a claim about acoustic output on real devices.
class Param {
  private initial = 0
  private events: Automation[] = []
  constructor(private readonly clock: () => number) {}
  set value(value: number) { this.initial = value }
  get value() { return this.at(this.clock()) }
  cancelScheduledValues = vi.fn((at: number) => { this.events = this.events.filter((event) => event.at < at) })
  setValueAtTime = vi.fn((value: number, at: number) => { this.events.push({ kind: 'set', value, at }) })
  linearRampToValueAtTime = vi.fn((value: number, at: number) => { this.events.push({ kind: 'linear', value, at }) })
  exponentialRampToValueAtTime = vi.fn((value: number, at: number) => { this.events.push({ kind: 'exponential', value, at }) })
  private at(time: number) {
    let value = this.initial
    let previousTime = 0
    for (const event of [...this.events].sort((a, b) => a.at - b.at)) {
      if (event.at > time) {
        const fraction = Math.max(0, (time - previousTime) / (event.at - previousTime))
        if (event.kind === 'linear') return value + (event.value - value) * fraction
        if (event.kind === 'exponential' && value > 0) return value * (event.value / value) ** fraction
        return value
      }
      value = event.value
      previousTime = event.at
    }
    return value
  }
}

class NodeDouble {
  gain: Param
  frequency: Param
  Q: Param
  type = ''
  buffer: unknown
  loop = false
  startedAt = Infinity
  stoppedAt = Infinity
  connections = new Set<NodeDouble>()
  onended: (() => void) | null = null
  constructor(readonly context: ContextDouble, readonly kind: string) {
    const clock = () => context.currentTime
    this.gain = new Param(clock); this.frequency = new Param(clock); this.Q = new Param(clock)
  }
  connect = vi.fn((node: NodeDouble) => { this.connections.add(node); return node })
  disconnect = vi.fn(() => { this.connections.clear() })
  start = vi.fn((at = this.context.currentTime) => { this.startedAt = at })
  stop = vi.fn((at = this.context.currentTime) => { this.stoppedAt = Math.min(this.stoppedAt, at) })
  outputGain(): number {
    if (this.kind === 'destination') return 1
    const local = this.kind === 'gain' ? this.gain.value : 1
    return local * [...this.connections].reduce((sum, next) => sum + next.outputGain(), 0)
  }
}

class ContextDouble {
  static instances: ContextDouble[] = []
  state = 'suspended'
  currentTime = 0
  sampleRate = 48000
  destination = new NodeDouble(this, 'destination')
  gains: NodeDouble[] = []
  sources: NodeDouble[] = []
  resume = vi.fn(async () => { this.state = 'running' })
  suspend = vi.fn(async () => { this.state = 'suspended' })
  close = vi.fn(async () => { this.state = 'closed' })
  constructor() { ContextDouble.instances.push(this) }
  createGain() { const node = new NodeDouble(this, 'gain'); this.gains.push(node); return node }
  createOscillator() { const node = new NodeDouble(this, 'oscillator'); this.sources.push(node); return node }
  createBiquadFilter() { return new NodeDouble(this, 'filter') }
  createBufferSource() { const node = new NodeDouble(this, 'buffer'); this.sources.push(node); return node }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) } }
  audibleSources() {
    if (this.state !== 'running') return []
    return this.sources.filter((node) => node.startedAt <= this.currentTime && node.stoppedAt > this.currentTime && node.outputGain() > 1e-9)
  }
}

class UtteranceDouble {
  lang = ''; rate = 1; pitch = 1; volume = 1
  voice: SpeechSynthesisVoice | null = null
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(readonly text: string) {}
}

const localVoice: SpeechSynthesisVoice = {
  default: false, lang: 'fr-FR', localService: true, name: 'Voix française locale', voiceURI: 'local:fr',
}
const remoteVoice: SpeechSynthesisVoice = {
  default: true, lang: 'fr-FR', localService: false, name: 'Voix française distante', voiceURI: 'remote:fr',
}
const speech = {
  cancel: vi.fn(), speak: vi.fn<(utterance: UtteranceDouble) => void>(),
  getVoices: vi.fn<() => SpeechSynthesisVoice[]>(() => [localVoice]),
}
let handles: AuroraAudioHandle[] = []
const audio = (config?: AuroraAudioConfig) => { const handle = createAuroraAudio(config); handles.push(handle); return handle }
const context = () => ContextDouble.instances[0]
const spoken = () => speech.speak.mock.calls.at(-1)![0]

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  speech.getVoices.mockReset().mockReturnValue([localVoice])
  ContextDouble.instances = []
  handles = []
  vi.stubGlobal('AudioContext', ContextDouble)
  vi.stubGlobal('webkitAudioContext', undefined)
  vi.stubGlobal('speechSynthesis', speech)
  vi.stubGlobal('SpeechSynthesisUtterance', UtteranceDouble)
})
afterEach(() => { handles.forEach((handle) => handle.dispose()) })

describe('AURORA ritual channels', () => {
  it('reuses immutable Harmonie notes tuned with A=432 and preserves their progression', () => {
    expect(Object.isFrozen(AURORA_RITUAL_MELODY)).toBe(true)
    expect(AURORA_RITUAL_MELODY.every(Object.isFrozen)).toBe(true)
    expect(melodyAtPosition(0)?.frequencyHz).toBe(432)
    expect(melodyAtPosition(1.3)?.frequencyHz).toBeCloseTo(432 * 2 ** (3 / 12), 9)
    expect(melodyAtPosition(2)?.frequencyHz).toBeCloseTo(432 * 2 ** (7 / 12), 9)
    expect(melodyAtPosition(8 * 60 / 72 + 0.1)?.frequencyHz).toBe(432)
    expect(melodyAtPosition(NaN)).toBeNull()
  })

  it('normalizes finite slider values and rejects non-finite or non-numeric channels atomically', async () => {
    expect(normalizeRitualMix({ voice: 2, music: -1, tone: 0.2 })).toEqual({ voice: 1, music: 0, tone: 0.2 })
    const handle = audio()
    handle.setRitualMix!({ voice: 0, music: 0.6, tone: 0 })
    await handle.start()
    context().currentTime = 0.2
    expect(context().audibleSources()).toHaveLength(1)
    const volumeBefore = context().audibleSources()[0].outputGain()
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(() => handle.setRitualMix!({ voice: invalid, music: 0, tone: 0 })).toThrow(RangeError)
    }
    expect(() => normalizeRitualMix({ voice: '1', music: 0, tone: 0 } as unknown as Parameters<typeof normalizeRitualMix>[0])).toThrow(RangeError)
    expect(context().audibleSources()[0].outputGain()).toBe(volumeBefore)
  })

  it('sequences only from setPosition, skips missed notes and has no melody timer', async () => {
    const handle = audio()
    handle.setRitualMix!({ voice: 0, music: 0.7, tone: 0 })
    await handle.start()
    context().currentTime = 0.2
    expect(context().audibleSources().map((source) => source.frequency.value)).toEqual([432])
    const sourcesBefore = context().sources.length
    await vi.advanceTimersByTimeAsync(20_000)
    expect(context().sources).toHaveLength(sourcesBefore)
    expect(vi.getTimerCount()).toBe(0)
    handle.setPosition!(32)
    expect(context().sources).toHaveLength(sourcesBefore + 1)
    const note = context().sources.at(-1)!
    expect(note.frequency.value).toBe(melodyAtPosition(32)!.frequencyHz)
    handle.setPosition!(32)
    expect(context().sources).toHaveLength(sourcesBefore + 1)
  })

  it('starts a distinct pure sine at 432 Hz only when its channel is selected', async () => {
    const handle = audio()
    handle.setRitualMix!({ voice: 0, music: 0, tone: 0.5 })
    await handle.start()
    context().currentTime = 0.3
    const sounding = context().audibleSources()
    expect(sounding).toHaveLength(1)
    expect(sounding[0].type).toBe('sine')
    expect(sounding[0].frequency.value).toBe(432)
    handle.setPosition!(200)
    expect(context().audibleSources()).toEqual(sounding)
    handle.setRitualMix!({ voice: 0, music: 0, tone: 0 })
    expect(context().audibleSources()).toHaveLength(0)
    context().currentTime += 10
    expect(context().audibleSources()).toHaveLength(0)
  })

  it('supports voice alone and immediately cancels voice when its level becomes zero', async () => {
    const handle = audio()
    handle.setRitualMix!({ voice: 0.6, music: 0, tone: 0 })
    handle.setVoiceGuidance(true)
    await handle.start()
    context().currentTime = 0.3
    handle.speakPhaseCue('Imagine ton prochain pas.')
    expect(spoken().volume).toBe(0.6)
    expect(spoken().voice).toBe(localVoice)
    expect(spoken().lang).toBe('fr-FR')
    expect(context().audibleSources()).toHaveLength(0)
    expect(context().gains[0].gain.value).toBe(0)
    speech.cancel.mockClear()
    handle.setRitualMix!({ voice: 0, music: 0, tone: 0 })
    expect(speech.cancel).toHaveBeenCalledOnce()
    handle.speakPhaseCue('Cette phrase ne doit pas être lue.')
    expect(speech.speak).toHaveBeenCalledOnce()
    expect(context().audibleSources()).toHaveLength(0)
  })

  it('requires explicit voice guidance even with a nonzero voice level', async () => {
    const handle = audio()
    handle.setRitualMix!({ voice: 1, music: 0, tone: 0 })
    await handle.start()
    handle.speakPhaseCue('Pas de consentement voix.')
    expect(speech.speak).not.toHaveBeenCalled()
    handle.setVoiceGuidance(true)
    handle.speakPhaseCue('Voix choisie.')
    expect(speech.speak).toHaveBeenCalledOnce()
    handle.setVoiceGuidance(false)
    spoken().onstart?.()
    spoken().onend?.()
    handle.speakPhaseCue('Arrêt de voix choisi.')
    expect(speech.speak).toHaveBeenCalledOnce()
  })

  it('ducks music for the current utterance and ignores the previous utterance ending late', async () => {
    const handle = audio()
    handle.setRitualMix!({ voice: 0.7, music: 0.8, tone: 0 })
    handle.setVoiceGuidance(true)
    await handle.start()
    context().currentTime = 0.2
    const melody = context().audibleSources()[0]
    const bus = [...[...melody.connections][0].connections][0]
    expect(bus.gain.value).toBe(0.8)
    handle.speakPhaseCue('Première phrase.')
    const first = spoken()
    context().currentTime += 0.1
    expect(bus.gain.value).toBeCloseTo(0.2)
    handle.speakPhaseCue('Deuxième phrase.')
    const second = spoken()
    first.onend?.()
    context().currentTime += 0.1
    expect(bus.gain.value).toBeCloseTo(0.2)
    second.onend?.()
    context().currentTime += 0.1
    expect(bus.gain.value).toBeCloseTo(0.8)
  })

  it.each(['stop', 'mute', 'dispose'] as const)('cannot restore any sound from late speech callbacks after %s', async (action) => {
    const handle = audio()
    handle.setRitualMix!({ voice: 0.7, music: 0.8, tone: 0.2 })
    handle.setVoiceGuidance(true)
    await handle.start()
    handle.speakPhaseCue('Une phrase interrompue.')
    const utterance = spoken()
    if (action === 'mute') handle.setEnabled(false)
    else handle[action]()
    utterance.onstart?.()
    utterance.onend?.()
    utterance.onerror?.()
    handle.setPosition!(0.5)
    context().currentTime = 0.5
    expect(context().gains[0].gain.value).toBe(0)
    expect(context().audibleSources()).toHaveLength(0)
    handle.speakPhaseCue('Tardive.')
    expect(speech.speak).toHaveBeenCalledOnce()
  })

  it('does not let an old end callback unduck a new session', async () => {
    const handle = audio()
    handle.setRitualMix!({ voice: 0.7, music: 0.8, tone: 0 })
    handle.setVoiceGuidance(true)
    await handle.start()
    handle.speakPhaseCue('Session précédente.')
    const old = spoken()
    handle.stop()
    await handle.start()
    handle.speakPhaseCue('Session actuelle.')
    old.onend?.()
    context().currentTime = 0.2
    const melody = context().audibleSources()[0]
    const bus = [...[...melody.connections][0].connections][0]
    expect(bus.gain.value).toBeCloseTo(0.2)
  })

  it('keeps music muted after duck completion, without muting the separate tone', async () => {
    const handle = audio()
    handle.setRitualMix!({ voice: 0.7, music: 0.8, tone: 0.2 })
    handle.setVoiceGuidance(true)
    await handle.start()
    handle.speakPhaseCue('Musique baissée.')
    handle.setRitualMix!({ voice: 0.7, music: 0, tone: 0.2 })
    spoken().onend?.()
    context().currentTime = 0.2
    expect(context().audibleSources()).toHaveLength(1)
    expect(context().audibleSources()[0].frequency.value).toBe(432)
    const count = context().sources.length
    handle.setPosition!(55)
    expect(context().sources).toHaveLength(count)
  })

  it('freezes note creation on stop and resumes from the externally supplied position', async () => {
    const handle = audio()
    handle.setRitualMix!({ voice: 0, music: 0.7, tone: 0 })
    await handle.start()
    handle.setPosition!(2)
    handle.stop()
    const count = context().sources.length
    await vi.advanceTimersByTimeAsync(10_000)
    handle.setPosition!(3)
    expect(context().sources).toHaveLength(count)
    expect(context().audibleSources()).toHaveLength(0)
    await handle.start()
    expect(context().sources).toHaveLength(count + 1)
    expect(context().sources.at(-1)!.frequency.value).toBe(melodyAtPosition(3)!.frequencyHz)
  })

  it('restores the original breathing layers when ritual mode is removed', async () => {
    const handle = audio()
    await handle.start()
    handle.setPhase('inspire')
    context().currentTime = 1.5
    const original = context().audibleSources()
    expect(original).toHaveLength(3)
    handle.setRitualMix!({ voice: 0, music: 0, tone: 0 })
    handle.setPhase('inspire')
    expect(context().audibleSources()).toHaveLength(0)
    handle.setRitualMix!(null)
    context().currentTime += 1.5
    expect(context().audibleSources()).toEqual(original)
  })

  it('reports unavailable outputs instead of claiming a successful no-op audio output', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const handle = audio()
    expect(handle.getCapabilities!()).toEqual({ audio: false, voice: false })
    await handle.start()
    handle.setVoiceGuidance(true)
    handle.speakPhaseCue('Absent.')
    expect(speech.speak).not.toHaveBeenCalled()
    expect(ContextDouble.instances).toHaveLength(0)
  })

  it('reports missing speech support independently from Web Audio', () => {
    vi.stubGlobal('SpeechSynthesisUtterance', undefined)
    const handle = audio()
    expect(handle.getCapabilities!()).toEqual({ audio: true, voice: false })
    handle.dispose()
    expect(handle.getCapabilities!()).toEqual({ audio: false, voice: false })
  })

  it.each([
    { voices: [] },
    { voices: [remoteVoice] },
    { voices: [{ ...localVoice, lang: 'en-US' }] },
    { voices: [remoteVoice, { ...localVoice, lang: 'en-US' }] },
  ])('does not send personal ritual text to a default or remote voice (%j)', async ({ voices }) => {
    speech.getVoices.mockReturnValue(voices)
    const handle = audio()
    handle.setRitualMix!({ voice: 0.7, music: 0.3, tone: 0 })
    handle.setVoiceGuidance(true)
    expect(handle.getCapabilities!()).toEqual({ audio: true, voice: false })
    await handle.start()
    handle.speakPhaseCue('Mon objectif privé.')
    expect(speech.speak).not.toHaveBeenCalled()
    context().currentTime = 0.2
    expect(context().audibleSources()).toHaveLength(1)
  })

  it('rechecks that the selected voice is local and French when each private cue is spoken', async () => {
    const handle = audio()
    handle.setRitualMix!({ voice: 0.7, music: 0, tone: 0 })
    handle.setVoiceGuidance(true)
    expect(handle.getCapabilities!().voice).toBe(true)
    await handle.start()
    speech.getVoices.mockReturnValue([remoteVoice])
    handle.speakPhaseCue('Mon objectif ne doit pas partir vers une voix distante.')
    expect(speech.speak).not.toHaveBeenCalled()
    expect(handle.getCapabilities!().voice).toBe(false)
    speech.getVoices.mockReturnValue([remoteVoice, localVoice])
    handle.speakPhaseCue('Cette consigne utilise uniquement la voix locale choisie.')
    expect(spoken().voice).toBe(localVoice)
  })

  it('fails closed when the platform cannot enumerate local voices', async () => {
    speech.getVoices.mockImplementation(() => { throw new Error('Voice list unavailable') })
    const handle = audio()
    handle.setRitualMix!({ voice: 1, music: 0, tone: 0 })
    handle.setVoiceGuidance(true)
    await handle.start()
    expect(handle.getCapabilities!().voice).toBe(false)
    expect(() => handle.speakPhaseCue('Texte personnel.')).not.toThrow()
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('notifies unavailable ritual speech when a local voice or synthesis support disappears', async () => {
    const onVoiceError = vi.fn()
    const handle = audio({ onVoiceError })
    handle.setRitualMix!({ voice: 0.7, music: 0.3, tone: 0 })
    handle.setVoiceGuidance(true)
    await handle.start()
    speech.getVoices.mockReturnValue([remoteVoice])
    handle.speakPhaseCue('Une consigne privée sans voix locale.')
    expect(onVoiceError).toHaveBeenLastCalledWith('unavailable')
    expect(speech.speak).not.toHaveBeenCalled()
    speech.getVoices.mockReturnValue([localVoice])
    vi.stubGlobal('SpeechSynthesisUtterance', undefined)
    handle.speakPhaseCue('Une consigne privée sans synthèse disponible.')
    expect(onVoiceError).toHaveBeenCalledTimes(2)
    expect(onVoiceError).toHaveBeenLastCalledWith('unavailable')
    context().currentTime = 0.2
    expect(context().audibleSources()).toHaveLength(1)
  })

  it('reports active playback errors once and restores music for onerror and speak exceptions', async () => {
    const onVoiceError = vi.fn()
    const handle = audio({ onVoiceError })
    handle.setRitualMix!({ voice: 0.7, music: 0.8, tone: 0 })
    handle.setVoiceGuidance(true)
    await handle.start()
    context().currentTime = 0.2
    const melody = context().audibleSources()[0]
    const bus = [...[...melody.connections][0].connections][0]
    handle.speakPhaseCue('Première consigne.')
    const first = spoken()
    first.onerror?.()
    first.onerror?.()
    expect(onVoiceError).toHaveBeenCalledExactlyOnceWith('playback')
    context().currentTime += 0.1
    expect(bus.gain.value).toBeCloseTo(0.8)
    speech.speak.mockImplementationOnce(() => { throw new Error('Playback unavailable') })
    expect(() => handle.speakPhaseCue('Deuxième consigne.')).not.toThrow()
    expect(onVoiceError).toHaveBeenCalledTimes(2)
    expect(onVoiceError).toHaveBeenLastCalledWith('playback')
    context().currentTime += 0.1
    expect(bus.gain.value).toBeCloseTo(0.8)
    expect(context().audibleSources()).toHaveLength(1)
  })

  it('does not report stale voice errors after replacement, stop, mute or disposal', async () => {
    const onVoiceError = vi.fn()
    for (const operation of ['replace', 'stop', 'mute', 'dispose'] as const) {
      const handle = audio({ onVoiceError })
      handle.setRitualMix!({ voice: 0.7, music: 0.3, tone: 0 })
      handle.setVoiceGuidance(true)
      await handle.start()
      handle.speakPhaseCue('Consigne ancienne.')
      const old = spoken()
      if (operation === 'replace') handle.speakPhaseCue('Consigne actuelle.')
      else if (operation === 'mute') handle.setEnabled(false)
      else handle[operation]()
      old.onerror?.()
      old.onend?.()
      expect(onVoiceError).not.toHaveBeenCalled()
      handle.dispose()
    }
    const legacy = audio({ onVoiceError })
    legacy.setVoiceGuidance(true)
    await legacy.start()
    legacy.speakPhaseCue('Consigne respiratoire historique.')
    spoken().onerror?.()
    expect(onVoiceError).not.toHaveBeenCalled()
  })

  it('rejects contexts that stay suspended or close, with no sound scheduled', async () => {
    const handle = audio()
    context().resume.mockImplementation(async () => {})
    await expect(handle.prepare()).rejects.toThrow('Audio indisponible')
    await expect(handle.start()).rejects.toThrow('Audio indisponible')
    context().state = 'closed'
    await expect(handle.prepare()).rejects.toThrow('Audio indisponible')
    expect(handle.getCapabilities!().audio).toBe(false)
    expect(context().audibleSources()).toHaveLength(0)
  })

  it('suppresses a late failed start after stop and keeps all channels silent', async () => {
    const handle = audio()
    handle.setRitualMix!({ voice: 0.7, music: 0.8, tone: 0.2 })
    let resolve!: () => void
    context().resume.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done }))
    const pending = handle.start()
    handle.stop()
    resolve()
    await expect(pending).resolves.toBeUndefined()
    expect(context().gains[0].gain.value).toBe(0)
    expect(context().audibleSources()).toHaveLength(0)
  })
})
