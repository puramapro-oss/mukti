import { act, fireEvent, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuroraSession } from '../../src/components/aurora/useAuroraSession'
import { createRitualPlan, type RitualDraft, type RitualPlan } from '../../src/lib/aurora-ritual'
import { mockAnimationClock } from './clock'

const mocks = vi.hoisted(() => {
  const audio = {
    prepare: vi.fn(async () => {}), start: vi.fn(async () => {}), stop: vi.fn(),
    dispose: vi.fn(), setPhase: vi.fn(), setEnabled: vi.fn(), setVoiceGuidance: vi.fn(),
    speakPhaseCue: vi.fn(), setRitualMix: vi.fn(), setPosition: vi.fn(),
    getCapabilities: vi.fn(() => ({ audio: true, voice: true })),
  }
  const haptic = { pulse: vi.fn(), cancel: vi.fn(), setEnabled: vi.fn(), isSupported: () => true }
  return {
    audio, haptic,
    createAudio: vi.fn((_config?: { onVoiceError?: (reason: 'unavailable' | 'playback') => void }) => audio), createHaptic: vi.fn(() => haptic),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    fetch: vi.fn(() => { throw new Error('A ritual must not call a persistence or reward API') }),
  }
})

vi.mock('@/lib/aurora-audio', () => ({ createAuroraAudio: mocks.createAudio }))
vi.mock('@/lib/aurora-haptic', () => ({ createAuroraHaptic: mocks.createHaptic }))
vi.mock('sonner', () => ({ toast: mocks.toast }))

const draft: RitualDraft = {
  intention: 'Écrire mon projet', outcome: 'Un brouillon utile', obstacle: 'Le doute',
  response: 'Ouvrir le document', action: 'Écrire une phrase', context: 'Demain au bureau', mode: 'factuel',
}
const plan = createRitualPlan(draft, 248)
type Session = ReturnType<typeof useAuroraSession>

function useTestSession(initialPlan: RitualPlan = plan) {
  return renderHook(({ currentPlan }) => useAuroraSession('focus', currentPlan), {
    initialProps: { currentPlan: initialPlan },
  })
}

function chooseTextOnly(result: { current: Session }) {
  act(() => {
    result.current.setVoiceEnabled(false)
    result.current.setRitualMix({ voice: 0, music: 0, tone: 0 })
  })
}

function tickFromStart(clock: ReturnType<typeof mockAnimationClock>, seconds: number) {
  for (let second = 1; second <= seconds; second += 1) clock.frame(second * 1000)
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.audio.prepare.mockReset().mockResolvedValue(undefined)
  mocks.audio.start.mockReset().mockResolvedValue(undefined)
  mocks.audio.getCapabilities.mockReset().mockReturnValue({ audio: true, voice: true })
  vi.stubGlobal('fetch', mocks.fetch)
})

describe('AURORA local ritual session using the real phase engine', () => {
  it('runs text-only without creating audio, haptics or a server session', async () => {
    const clock = mockAnimationClock()
    const { result } = useTestSession()
    chooseTextOnly(result)
    await act(async () => result.current.start())
    clock.frame(3000)
    expect(result.current.engine.meta.running).toBe(true)
    expect(result.current.engine.meta.sessionElapsedSec).toBe(3)
    expect(mocks.createAudio).not.toHaveBeenCalled()
    expect(mocks.createHaptic).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(result.current.persistError).toBeNull()
    expect(result.current.completedInfo).toBeNull()
  })

  it('uses the chosen mix and personal script, with no old breathing cues or haptics', async () => {
    const clock = mockAnimationClock()
    const { result } = useTestSession()
    const mix = { voice: 0.6, music: 0.2, tone: 0.1 }
    act(() => { result.current.setVoiceEnabled(true); result.current.setRitualMix(mix) })
    await act(async () => result.current.start())
    expect(mocks.audio.setRitualMix).toHaveBeenCalledWith(mix)
    expect(mocks.audio.setVoiceGuidance).toHaveBeenLastCalledWith(true)
    expect(mocks.audio.setPosition).toHaveBeenCalledWith(0)
    expect(mocks.audio.prepare).toHaveBeenCalledOnce()
    expect(mocks.audio.start).toHaveBeenCalledOnce()
    expect(mocks.audio.speakPhaseCue).toHaveBeenCalledWith(plan.cues[0].text)
    tickFromStart(clock, plan.cues[1].at + 1)
    expect(mocks.audio.speakPhaseCue).toHaveBeenCalledWith(plan.cues[1].text)
    expect(mocks.audio.speakPhaseCue).toHaveBeenCalledTimes(2)
    for (const [text] of mocks.audio.speakPhaseCue.mock.calls) {
      expect(plan.cues.some((cue) => cue.text === text)).toBe(true)
    }
    expect(mocks.audio.setPhase).not.toHaveBeenCalled()
    expect(mocks.createHaptic).not.toHaveBeenCalled()
    expect(mocks.haptic.pulse).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('freezes elapsed time on pause and resumes explicitly after backgrounding', async () => {
    const clock = mockAnimationClock()
    const { result } = useTestSession()
    await act(async () => result.current.start())
    clock.frame(3000)
    act(() => result.current.pause())
    expect(result.current.engine.meta.paused).toBe(true)
    expect(clock.frames.size).toBe(0)
    expect(mocks.audio.stop).toHaveBeenCalledOnce()
    clock.frame(30_000)
    expect(result.current.engine.meta.sessionElapsedSec).toBe(3)
    await act(async () => result.current.resume())
    clock.frame(31_000)
    expect(result.current.engine.meta.sessionElapsedSec).toBe(4)
    expect(mocks.audio.setPosition).toHaveBeenCalledWith(3)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    expect(result.current.engine.meta.paused).toBe(true)
    expect(clock.frames.size).toBe(0)
    hidden.mockReturnValue(false)
    fireEvent(document, new Event('visibilitychange'))
    expect(result.current.engine.meta.paused).toBe(true)
    expect(mocks.audio.start).toHaveBeenCalledTimes(2)
    await act(async () => result.current.resume())
    expect(result.current.engine.meta.paused).toBe(false)
    expect(mocks.audio.start).toHaveBeenCalledTimes(3)
    expect(mocks.createHaptic).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('does not start after a preparation promise resolves following a user stop', async () => {
    const clock = mockAnimationClock()
    const ready = deferred()
    mocks.audio.prepare.mockImplementationOnce(() => ready.promise)
    const { result } = useTestSession()
    let pending!: Promise<void>
    act(() => { pending = result.current.start() })
    expect(result.current.starting).toBe(true)
    act(() => result.current.stop())
    await act(async () => { ready.resolve(); await pending })
    expect(result.current.engine.meta.running).toBe(false)
    expect(result.current.starting).toBe(false)
    expect(clock.frames.size).toBe(0)
    expect(mocks.audio.start).not.toHaveBeenCalled()
    expect(mocks.audio.speakPhaseCue).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('restarts the current spoken step on resume instead of skipping the interrupted instruction', async () => {
    const clock = mockAnimationClock()
    const { result } = useTestSession()
    act(() => result.current.setVoiceEnabled(true))
    await act(async () => result.current.start())
    const cue = plan.cues[1]
    const pausedAt = cue.at + 5
    tickFromStart(clock, pausedAt)
    expect(mocks.audio.speakPhaseCue).toHaveBeenLastCalledWith(cue.text)
    act(() => result.current.pause())
    const count = mocks.audio.speakPhaseCue.mock.calls.length
    clock.set((pausedAt + 50) * 1000)
    await act(async () => result.current.resume())
    expect(result.current.engine.meta.paused).toBe(false)
    expect(result.current.engine.meta.sessionElapsedSec).toBe(cue.at)
    expect(mocks.audio.setPosition).toHaveBeenLastCalledWith(cue.at)
    expect(mocks.audio.speakPhaseCue).toHaveBeenCalledTimes(count + 1)
    expect(mocks.audio.speakPhaseCue).toHaveBeenLastCalledWith(cue.text)
    clock.frame((pausedAt + 51) * 1000)
    expect(result.current.engine.meta.sessionElapsedSec).toBe(cue.at + 1)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('ignores a late audio start after the ritual component has unmounted', async () => {
    const clock = mockAnimationClock()
    const output = deferred()
    mocks.audio.start.mockImplementationOnce(() => output.promise)
    const { result, unmount } = useTestSession()
    let pending!: Promise<void>
    await act(async () => { pending = result.current.start(); await Promise.resolve() })
    expect(mocks.audio.start).toHaveBeenCalledOnce()
    unmount()
    await act(async () => { output.resolve(); await pending })
    expect(clock.frames.size).toBe(0)
    expect(mocks.audio.dispose).toHaveBeenCalledOnce()
    expect(mocks.audio.speakPhaseCue).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('replays the current step with its full time budget and only one running clock', async () => {
    const clock = mockAnimationClock()
    const { result } = useTestSession()
    act(() => result.current.setVoiceEnabled(true))
    await act(async () => result.current.start())
    const cue = plan.cues[1]
    tickFromStart(clock, cue.at + 8)
    const count = mocks.audio.speakPhaseCue.mock.calls.length
    act(() => result.current.replayRitualCue())
    expect(result.current.engine.meta.sessionElapsedSec).toBe(cue.at)
    expect(result.current.engine.meta.paused).toBe(false)
    expect(clock.frames.size).toBe(1)
    expect(mocks.audio.speakPhaseCue).toHaveBeenCalledTimes(count + 1)
    expect(mocks.audio.speakPhaseCue).toHaveBeenLastCalledWith(cue.text)
    clock.frame((cue.at + 9) * 1000)
    expect(result.current.engine.meta.sessionElapsedSec).toBe(cue.at + 1)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('announces a live speech failure and continues with text and the existing clock', async () => {
    const clock = mockAnimationClock()
    const { result } = useTestSession()
    act(() => result.current.setVoiceEnabled(true))
    await act(async () => result.current.start())
    const onVoiceError = mocks.createAudio.mock.calls[0][0]?.onVoiceError
    expect(onVoiceError).toBeTypeOf('function')
    act(() => onVoiceError?.('playback'))
    expect(result.current.voiceEnabled).toBe(false)
    expect(result.current.persistError).toContain('Le texte reste disponible')
    clock.frame(1000)
    expect(result.current.engine.meta.running).toBe(true)
    expect(result.current.engine.meta.sessionElapsedSec).toBe(1)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('cannot restart the clock when a paused audio resume resolves after stop', async () => {
    const clock = mockAnimationClock()
    const { result } = useTestSession()
    await act(async () => result.current.start())
    clock.frame(2000)
    act(() => result.current.pause())
    const output = deferred()
    mocks.audio.start.mockImplementationOnce(() => output.promise)
    let pending!: Promise<void>
    await act(async () => { pending = result.current.resume(); await Promise.resolve() })
    act(() => result.current.stop())
    await act(async () => { output.resolve(); await pending })
    expect(result.current.engine.meta.running).toBe(false)
    expect(result.current.ritualCompletion).toBe('stopped')
    expect(clock.frames.size).toBe(0)
    expect(result.current.completedInfo).toBeNull()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it.each(['audio', 'voice'] as const)('rejects an unavailable %s output and permits a fresh text-only attempt', async (missing) => {
    const clock = mockAnimationClock()
    mocks.audio.getCapabilities.mockReturnValue({ audio: missing !== 'audio', voice: missing !== 'voice' })
    const { result } = useTestSession()
    if (missing === 'voice') {
      act(() => {
        result.current.setVoiceEnabled(true)
        result.current.setRitualMix({ voice: 0.8, music: 0, tone: 0 })
      })
    }
    await act(async () => result.current.start())
    expect(result.current.engine.meta.running).toBe(false)
    expect(result.current.persistError).toContain('indisponible')
    expect(clock.frames.size).toBe(0)
    expect(mocks.audio.prepare).not.toHaveBeenCalled()
    expect(mocks.audio.start).not.toHaveBeenCalled()
    act(() => result.current.resetRitualPreparation())
    expect(result.current.persistError).toBeNull()
    chooseTextOnly(result)
    await act(async () => result.current.start())
    expect(result.current.engine.meta.running).toBe(true)
    expect(result.current.persistError).toBeNull()
    expect(mocks.audio.start).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('completes locally without recording breathing scores, assigning rewards or confirming the planned action', async () => {
    const clock = mockAnimationClock()
    const { result } = useTestSession()
    chooseTextOnly(result)
    await act(async () => result.current.start())
    tickFromStart(clock, plan.durationSec)
    expect(result.current.engine.meta.running).toBe(false)
    expect(result.current.ritualCompletion).toBe('completed')
    expect(result.current.completedInfo).toBeNull()
    expect(result.current.saving).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.toast.success).not.toHaveBeenCalled()
    expect(mocks.toast.info).not.toHaveBeenCalled()
    expect(plan.draft.action).toBe(draft.action)
    expect(clock.frames.size).toBe(0)
    act(() => result.current.resetRitualPreparation())
    expect(result.current.ritualCompletion).toBeNull()
    expect(result.current.completedInfo).toBeNull()
    await act(async () => result.current.start())
    expect(result.current.engine.meta.running).toBe(true)
    expect(result.current.engine.meta.sessionElapsedSec).toBe(0)
    expect(result.current.ritualCompletion).toBeNull()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('silences outputs immediately while continuing the ritual clock', async () => {
    const clock = mockAnimationClock()
    const { result } = useTestSession()
    act(() => result.current.setVoiceEnabled(true))
    await act(async () => result.current.start())
    clock.frame(3000)
    mocks.audio.stop.mockClear()
    act(() => result.current.muteRitual())
    expect(mocks.audio.stop).toHaveBeenCalledOnce()
    expect(result.current.voiceEnabled).toBe(false)
    expect(result.current.ritualMix).toEqual({ voice: 0, music: 0, tone: 0 })
    expect(result.current.engine.meta.running).toBe(true)
    expect(result.current.engine.meta.paused).toBe(false)
    const spokenCount = mocks.audio.speakPhaseCue.mock.calls.length
    clock.frame(6000)
    expect(result.current.engine.meta.sessionElapsedSec).toBe(6)
    expect(mocks.audio.speakPhaseCue).toHaveBeenCalledTimes(spokenCount)
    expect(mocks.audio.start).toHaveBeenCalledOnce()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('keeps the approved plan throughout the active run if draft props change', async () => {
    const clock = mockAnimationClock()
    const { result, rerender } = useTestSession()
    act(() => result.current.setVoiceEnabled(true))
    await act(async () => result.current.start())
    const replacement = createRitualPlan({ ...draft, intention: 'Un autre projet', action: 'Dessiner un cercle' }, 248)
    rerender({ currentPlan: replacement })
    // Reopening preparation must be a no-op during an active or paused run.
    act(() => result.current.resetRitualPreparation())
    tickFromStart(clock, plan.cues[1].at)
    expect(mocks.audio.speakPhaseCue).toHaveBeenLastCalledWith(plan.cues[1].text)
    expect(mocks.audio.speakPhaseCue).not.toHaveBeenCalledWith(replacement.cues[1].text)
    act(() => result.current.pause())
    act(() => result.current.resetRitualPreparation())
    await act(async () => result.current.resume())
    act(() => result.current.replayRitualCue())
    expect(mocks.audio.speakPhaseCue).toHaveBeenLastCalledWith(plan.cues[1].text)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
