import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuroraAudio } from '../../src/lib/aurora-audio'

class Param {
  value = 0
  cancelScheduledValues = vi.fn()
  setValueAtTime = vi.fn((value: number) => { this.value = value })
  linearRampToValueAtTime = vi.fn((value: number) => { this.value = value })
  exponentialRampToValueAtTime = vi.fn((value: number) => { this.value = value })
}
class AudioNodeMock {
  gain = new Param()
  frequency = new Param()
  Q = new Param()
  type = ''
  buffer: unknown
  loop = false
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
  onended: (() => void) | null = null
}
class Context {
  static instances: Context[] = []
  state = 'suspended'
  currentTime = 0
  sampleRate = 48000
  destination = {}
  gains: AudioNodeMock[] = []
  oscillators: AudioNodeMock[] = []
  resume = vi.fn(async () => { this.state = 'running' })
  suspend = vi.fn(async () => { this.state = 'suspended' })
  close = vi.fn(async () => { this.state = 'closed' })
  constructor() { Context.instances.push(this) }
  createGain() { const node = new AudioNodeMock(); this.gains.push(node); return node }
  createOscillator() { const node = new AudioNodeMock(); this.oscillators.push(node); return node }
  createBiquadFilter() { return new AudioNodeMock() }
  createBufferSource() { return new AudioNodeMock() }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
}

const speech = { cancel: vi.fn(), speak: vi.fn() }
beforeEach(() => {
  Context.instances = []
  vi.clearAllMocks()
  vi.stubGlobal('AudioContext', Context)
  vi.stubGlobal('speechSynthesis', speech)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
})

describe('AURORA audio lifecycle', () => {
  it('does not speak outside a started session', () => {
    const audio = createAuroraAudio()
    audio.setVoiceGuidance(true)
    audio.speakPhaseCue('cue')
    expect(speech.speak).not.toHaveBeenCalled()
    audio.dispose()
  })
  it('stop cancels queued speech and blocks future cues', async () => {
    const audio = createAuroraAudio()
    await audio.start()
    audio.setVoiceGuidance(true)
    audio.speakPhaseCue('first')
    speech.cancel.mockClear()
    audio.stop()
    audio.speakPhaseCue('late')
    expect(speech.cancel).toHaveBeenCalled()
    expect(speech.speak).toHaveBeenCalledTimes(1)
    expect(Context.instances[0].gains[0].gain.value).toBe(0)
    audio.dispose()
  })
  it('muting also cancels and suppresses speech', async () => {
    const audio = createAuroraAudio()
    await audio.start()
    audio.setVoiceGuidance(true)
    audio.setEnabled(false)
    audio.speakPhaseCue('muted')
    expect(speech.cancel).toHaveBeenCalled()
    expect(speech.speak).not.toHaveBeenCalled()
    audio.dispose()
  })
  it('disposal is idempotent and prevents restart', async () => {
    const audio = createAuroraAudio()
    audio.dispose()
    audio.dispose()
    await audio.start()
    expect(Context.instances[0].close).toHaveBeenCalledOnce()
    expect(Context.instances[0].resume).not.toHaveBeenCalled()
  })
  it('preparation unlocks audio without raising the master gain', async () => {
    const audio = createAuroraAudio()
    await audio.prepare()
    expect(Context.instances[0].resume).toHaveBeenCalledOnce()
    expect(Context.instances[0].gains[0].gain.value).toBe(0)
    audio.dispose()
  })
  it('a pending resume cannot re-enable audio after stop', async () => {
    const audio = createAuroraAudio()
    const context = Context.instances[0]
    let resolve!: () => void
    context.resume.mockImplementationOnce(() => new Promise<void>((r) => { resolve = r }))
    const pending = audio.start()
    audio.stop()
    resolve()
    await pending
    expect(context.gains[0].gain.value).toBe(0)
    audio.dispose()
  })
  it('cleans up transient hold tones when stopping', async () => {
    const audio = createAuroraAudio()
    await audio.start()
    audio.setPhase('hold')
    const transient = Context.instances[0].oscillators.at(-1)!
    audio.stop()
    expect(transient.disconnect).toHaveBeenCalled()
    audio.dispose()
  })
  it('handles invalid numeric configuration without passing non-finite audio values', async () => {
    const audio = createAuroraAudio({ masterGain: NaN, nappeFreqHz: Infinity, subFreqHz: -1 })
    await audio.start()
    const context = Context.instances[0]
    expect(context.gains[0].gain.value).toBe(0.35)
    expect(context.oscillators.map((o) => o.frequency.value)).toEqual([432, 96])
    audio.dispose()
  })
  it('rejects a blocked audio context within the deadline', async () => {
    vi.useFakeTimers()
    const audio = createAuroraAudio()
    Context.instances[0].resume.mockImplementation(() => new Promise<void>(() => {}))
    const pending = expect(audio.prepare()).rejects.toThrow('Audio indisponible')
    await vi.advanceTimersByTimeAsync(5000)
    await pending
    expect(Context.instances[0].gains[0].gain.value).toBe(0)
    audio.dispose()
  })
})
