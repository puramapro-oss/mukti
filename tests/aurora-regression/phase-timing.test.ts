import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAuroraPhase } from '../../src/components/aurora/useAuroraPhase'
import { mockAnimationClock } from './clock'

describe('AURORA delayed animation frames', () => {
  it('keeps the time beyond a phase boundary and displays the current breath position', () => {
    const clock = mockAnimationClock()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'focus' }))
    act(() => result.current.actions.start())
    clock.frame(8250)
    expect(result.current.meta).toMatchObject({
      currentPhaseName: 'double_sigh', phaseStartSec: 8, sessionElapsedSec: 8.25,
    })
    expect(result.current.state).toMatchObject({ phase: 'inspire', elapsedSec: 8.25, phaseDurationSec: 3 })
    expect(result.current.state.progress).toBeCloseTo(0.25 / 3)
    clock.frame(9250)
    expect(result.current.meta.sessionElapsedSec).toBe(9.25)
  })

  it('catches up across sub-steps without playing the missed breath cues in a burst', () => {
    const clock = mockAnimationClock()
    const onBreathStep = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'focus', onBreathStep }))
    act(() => result.current.actions.start())
    onBreathStep.mockClear()
    clock.frame(6500)
    expect(result.current.meta.breathsCounted).toBe(1)
    expect(result.current.state).toMatchObject({ phase: 'expire', progress: 0.25, elapsedSec: 6.5 })
    expect(onBreathStep.mock.calls).toEqual([['expire']])
  })

  it('crosses several phases in one frame, emits only the current cues, and keeps complete records', () => {
    const clock = mockAnimationClock()
    const onPhaseChange = vi.fn()
    const onBreathStep = vi.fn()
    const onStop = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({
      variant: 'ignite', powerSwitch: 'core', onPhaseChange, onBreathStep, onStop,
    }))
    act(() => result.current.actions.start())
    onPhaseChange.mockClear()
    onBreathStep.mockClear()
    clock.frame(91500)
    expect(result.current.meta).toMatchObject({
      currentPhaseIndex: 3, currentPhaseName: 'omega_lock', phaseStartSec: 88,
      sessionElapsedSec: 91.5, running: true,
    })
    expect(result.current.state).toMatchObject({ phase: 'hold', progress: 0.5, phaseDurationSec: 1 })
    expect(onPhaseChange.mock.calls).toEqual([['omega_lock', 3]])
    expect(onBreathStep.mock.calls).toEqual([['hold']])
    expect(clock.frames.size).toBe(1)
    act(() => { result.current.actions.stop(); result.current.actions.stop() })
    expect(onStop).toHaveBeenCalledOnce()
    const stopped = onStop.mock.calls[0][1]
    expect(stopped.sessionElapsedSec).toBe(91.5)
    expect(stopped.phasesCompleted).toMatchObject([
      { phase: 'armement', duration_sec: 8, breaths_counted: 2 },
      { phase: 'double_sigh', duration_sec: 20, breaths_counted: 2 },
      { phase: 'resonance_core', duration_sec: 60, breaths_counted: 10 },
      { phase: 'omega_lock', duration_sec: 3.5, breaths_counted: 0 },
    ])
    for (const record of stopped.phasesCompleted) {
      expect(record.coherence).toBeGreaterThanOrEqual(0)
      expect(record.coherence).toBeLessThanOrEqual(1)
    }
    expect(clock.frames.size).toBe(0)
  })

  it.each([
    ['ignite', 128], ['focus', 248], ['calm', 468], ['sleep', 608],
  ] as const)('finishes %s exactly once when a frame passes the entire remaining timeline', (variant, duration) => {
    const clock = mockAnimationClock()
    const onComplete = vi.fn()
    const onStop = vi.fn()
    const onPhaseChange = vi.fn()
    const onBreathStep = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({
      variant, onComplete, onStop, onPhaseChange, onBreathStep,
    }))
    act(() => result.current.actions.start())
    onPhaseChange.mockClear()
    onBreathStep.mockClear()
    clock.frame((duration + 75) * 1000)
    expect(onComplete).toHaveBeenCalledOnce()
    expect(result.current.meta).toMatchObject({
      running: false, paused: false, stoppedReason: 'glide_out_complete', sessionElapsedSec: duration,
    })
    const completed = onComplete.mock.calls[0][0]
    expect(completed.phasesCompleted.map((phase: { phase: string }) => phase.phase))
      .toEqual(['armement', 'double_sigh', 'resonance_core', 'omega_lock', 'glide_out'])
    expect(completed.phasesCompleted.reduce((sum: number, phase: { duration_sec: number }) => sum + phase.duration_sec, 0))
      .toBe(duration)
    expect(onPhaseChange).not.toHaveBeenCalled()
    expect(onBreathStep).not.toHaveBeenCalled()
    expect(clock.frames.size).toBe(0)
    clock.frame((duration + 100) * 1000)
    act(() => { result.current.actions.stop(); result.current.actions.resume() })
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onStop).not.toHaveBeenCalled()
    expect(clock.frames.size).toBe(0)
  })

  it('excludes a long pause after a late frame without losing the earlier overshoot', () => {
    const clock = mockAnimationClock()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'focus' }))
    act(() => result.current.actions.start())
    clock.frame(8250)
    act(() => result.current.actions.pause())
    clock.set(708250)
    act(() => result.current.actions.resume())
    clock.frame(709000)
    expect(result.current.meta).toMatchObject({
      currentPhaseName: 'double_sigh', sessionElapsedSec: 9, paused: false,
    })
    expect(result.current.state.progress).toBeCloseTo(1 / 3)
    expect(clock.frames.size).toBe(1)
  })

  it('can rewind after catching up and replay a boundary without duplicate records or cues', () => {
    const clock = mockAnimationClock()
    const onPhaseChange = vi.fn()
    const onBreathStep = vi.fn()
    const onStop = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({
      variant: 'focus', onPhaseChange, onBreathStep, onStop,
    }))
    act(() => result.current.actions.start())
    clock.frame(170000)
    act(() => result.current.actions.pause())
    onPhaseChange.mockClear()
    onBreathStep.mockClear()
    clock.set(200000)
    act(() => expect(result.current.actions.rewindPausedTo(14.5)).toBe(true))
    expect(result.current.meta.phasesCompleted.map((phase) => phase.phase)).toEqual(['armement'])
    expect(clock.frames.size).toBe(0)
    expect(onPhaseChange).not.toHaveBeenCalled()
    expect(onBreathStep).not.toHaveBeenCalled()
    act(() => result.current.actions.resume())
    clock.frame(223750)
    expect(result.current.meta).toMatchObject({
      currentPhaseName: 'resonance_core', phaseStartSec: 38, sessionElapsedSec: 38.25,
    })
    expect(onPhaseChange.mock.calls).toEqual([['resonance_core', 2]])
    expect(onBreathStep.mock.calls).toEqual([['inspire']])
    act(() => result.current.actions.stop())
    expect(onStop.mock.calls[0][1].phasesCompleted).toMatchObject([
      { phase: 'armement', duration_sec: 8 },
      { phase: 'double_sigh', duration_sec: 30 },
      { phase: 'resonance_core', duration_sec: 0.3 },
    ])
    expect(clock.frames.size).toBe(0)
  })

  it('pauses before a pending frame at the actual position without issuing any missed cues', () => {
    const clock = mockAnimationClock()
    const onPhaseChange = vi.fn()
    const onBreathStep = vi.fn()
    const onStop = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({
      variant: 'ignite', powerSwitch: 'core', onPhaseChange, onBreathStep, onStop,
    }))
    act(() => result.current.actions.start())
    onPhaseChange.mockClear()
    onBreathStep.mockClear()
    clock.set(91500)
    act(() => result.current.actions.pause())
    expect(result.current.meta).toMatchObject({
      paused: true, running: true, currentPhaseName: 'omega_lock', sessionElapsedSec: 91.5,
    })
    expect(result.current.state).toMatchObject({ phase: 'hold', progress: 0.5 })
    expect(onPhaseChange).not.toHaveBeenCalled()
    expect(onBreathStep).not.toHaveBeenCalled()
    expect(clock.frames.size).toBe(0)
    clock.set(191500)
    act(() => result.current.actions.stop())
    expect(onStop).toHaveBeenCalledOnce()
    expect(onStop.mock.calls[0][1].sessionElapsedSec).toBe(91.5)
    expect(onStop.mock.calls[0][1].phasesCompleted).toHaveLength(4)
    expect(onPhaseChange).not.toHaveBeenCalled()
    expect(onBreathStep).not.toHaveBeenCalled()
  })

  it('stops before a pending frame with all elapsed phases accounted for and no cues', () => {
    const clock = mockAnimationClock()
    const onPhaseChange = vi.fn()
    const onBreathStep = vi.fn()
    const onStop = vi.fn()
    const onComplete = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({
      variant: 'ignite', onPhaseChange, onBreathStep, onStop, onComplete,
    }))
    act(() => result.current.actions.start())
    onPhaseChange.mockClear()
    onBreathStep.mockClear()
    clock.set(91500)
    act(() => result.current.actions.markDizzy())
    expect(onStop).toHaveBeenCalledOnce()
    expect(onStop.mock.calls[0][0]).toBe('dizzy')
    expect(onStop.mock.calls[0][1]).toMatchObject({ sessionElapsedSec: 91.5, running: false, paused: false })
    expect(onStop.mock.calls[0][1].phasesCompleted).toMatchObject([
      { phase: 'armement', duration_sec: 8 },
      { phase: 'double_sigh', duration_sec: 20 },
      { phase: 'resonance_core', duration_sec: 60 },
      { phase: 'omega_lock', duration_sec: 3.5 },
    ])
    expect(onPhaseChange).not.toHaveBeenCalled()
    expect(onBreathStep).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
    expect(clock.frames.size).toBe(0)
    clock.frame(150000)
    expect(onStop).toHaveBeenCalledOnce()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it.each(['pause', 'stop'] as const)('handles an elapsed completion before %s without duplicate finalization', (action) => {
    const clock = mockAnimationClock()
    const onComplete = vi.fn()
    const onStop = vi.fn()
    const onPhaseChange = vi.fn()
    const onBreathStep = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({
      variant: 'ignite', onComplete, onStop, onPhaseChange, onBreathStep,
    }))
    act(() => result.current.actions.start())
    onPhaseChange.mockClear()
    onBreathStep.mockClear()
    clock.set(128750)
    act(() => result.current.actions[action]())
    expect(result.current.meta).toMatchObject({
      running: false, paused: false, sessionElapsedSec: 128,
      stoppedReason: action === 'stop' ? 'user_stop' : 'glide_out_complete',
    })
    expect(result.current.meta.phasesCompleted).toHaveLength(5)
    expect(onComplete).toHaveBeenCalledTimes(action === 'pause' ? 1 : 0)
    expect(onStop).toHaveBeenCalledTimes(action === 'stop' ? 1 : 0)
    expect(onPhaseChange).not.toHaveBeenCalled()
    expect(onBreathStep).not.toHaveBeenCalled()
    expect(clock.frames.size).toBe(0)
    act(() => { result.current.actions.pause(); result.current.actions.stop() })
    expect(onComplete).toHaveBeenCalledTimes(action === 'pause' ? 1 : 0)
    expect(onStop).toHaveBeenCalledTimes(action === 'stop' ? 1 : 0)
  })
})
