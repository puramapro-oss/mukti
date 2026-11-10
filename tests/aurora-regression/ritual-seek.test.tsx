import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAuroraPhase } from '../../src/components/aurora/useAuroraPhase'
import { mockAnimationClock } from './clock'

describe('AURORA paused ritual rewind', () => {
  it('rewinds within a phase, updates its sub-step, and stays frozen until resume', () => {
    const clock = mockAnimationClock()
    const onPhaseChange = vi.fn()
    const onBreathStep = vi.fn()
    const onStop = vi.fn()
    const onComplete = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({
      variant: 'focus', onPhaseChange, onBreathStep, onStop, onComplete,
    }))
    act(() => result.current.actions.start())
    for (const time of [1000, 4000, 7000]) clock.frame(time)
    act(() => result.current.actions.pause())
    const phaseCalls = onPhaseChange.mock.calls.length
    const breathCalls = onBreathStep.mock.calls.length
    clock.set(50000)
    act(() => expect(result.current.actions.rewindPausedTo(3.5)).toBe(true))
    expect(result.current.meta).toMatchObject({
      running: true, paused: true, currentPhaseIndex: 0,
      currentPhaseName: 'armement', sessionElapsedSec: 3.5,
      sessionTotalSec: 248, phaseStartSec: 0, phaseDurationSec: 8,
    })
    expect(result.current.state).toEqual({
      phase: 'expire', progress: 0.75, elapsedSec: 3.5, phaseDurationSec: 2,
    })
    expect(clock.frames.size).toBe(0)
    expect(onPhaseChange).toHaveBeenCalledTimes(phaseCalls)
    expect(onBreathStep).toHaveBeenCalledTimes(breathCalls)
    expect(onStop).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
    clock.frame(70000)
    expect(result.current.meta.sessionElapsedSec).toBe(3.5)
    expect(clock.frames.size).toBe(0)
    act(() => {
      result.current.actions.resume()
      result.current.actions.resume()
    })
    expect(clock.frames.size).toBe(1)
    clock.frame(71000)
    expect(result.current.meta.sessionElapsedSec).toBeCloseTo(4.5)
    expect(result.current.meta.paused).toBe(false)
    expect(clock.frames.size).toBe(1)
  })

  it('rewinds to an earlier phase and discards later phase records', () => {
    const clock = mockAnimationClock()
    const onPhaseChange = vi.fn()
    const onBreathStep = vi.fn()
    const onStop = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({
      variant: 'focus', onPhaseChange, onBreathStep, onStop,
    }))
    act(() => result.current.actions.start())
    for (const time of [8000, 38000, 158000, 170000]) clock.frame(time)
    expect(result.current.meta.currentPhaseName).toBe('omega_lock')
    act(() => result.current.actions.pause())
    const phaseCalls = onPhaseChange.mock.calls.length
    const breathCalls = onBreathStep.mock.calls.length
    act(() => expect(result.current.actions.rewindPausedTo(14.5)).toBe(true))
    expect(result.current.meta).toMatchObject({
      currentPhaseIndex: 1, currentPhaseName: 'double_sigh',
      sessionElapsedSec: 14.5, phaseStartSec: 8, phaseDurationSec: 30,
      paused: true, running: true,
    })
    expect(result.current.meta.phasesCompleted.map((phase) => phase.phase)).toEqual(['armement'])
    expect(result.current.state.phase).toBe('expire')
    expect(result.current.state.phaseDurationSec).toBe(6)
    expect(result.current.state.progress).toBeCloseTo(2.5 / 6)
    expect(onPhaseChange).toHaveBeenCalledTimes(phaseCalls)
    expect(onBreathStep).toHaveBeenCalledTimes(breathCalls)
    clock.set(200000)
    act(() => result.current.actions.resume())
    clock.frame(201000)
    expect(result.current.meta.sessionElapsedSec).toBeCloseTo(15.5)
    clock.frame(223500)
    expect(result.current.meta.currentPhaseName).toBe('resonance_core')
    expect(result.current.meta.sessionElapsedSec).toBe(38)
    act(() => result.current.actions.stop())
    const stopped = onStop.mock.calls[0][1]
    expect(stopped.phasesCompleted.map((phase: { phase: string }) => phase.phase))
      .toEqual(['armement', 'double_sigh', 'resonance_core'])
    expect(stopped.phasesCompleted[1].duration_sec).toBe(30)
    expect(stopped.phasesCompleted[2].duration_sec).toBe(0)
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('places an exact boundary at the start of the next phase', () => {
    const clock = mockAnimationClock()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'focus' }))
    act(() => result.current.actions.start())
    for (const time of [8000, 38000, 50000]) clock.frame(time)
    act(() => result.current.actions.pause())
    act(() => expect(result.current.actions.rewindPausedTo(38)).toBe(true))
    expect(result.current.meta).toMatchObject({
      currentPhaseIndex: 2, phaseStartSec: 38, sessionElapsedSec: 38,
      currentPhaseName: 'resonance_core', breathsCounted: 0,
    })
    expect(result.current.meta.phasesCompleted.map((phase) => phase.phase))
      .toEqual(['armement', 'double_sigh'])
    expect(result.current.state.phase).toBe('inspire')
    expect(result.current.state.progress).toBe(0)
    expect(clock.frames.size).toBe(0)
  })

  it('can replay from zero and complete once without duplicated phase records or clocks', () => {
    const clock = mockAnimationClock()
    const onComplete = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'ignite', onComplete }))
    act(() => result.current.actions.start())
    for (const time of [8000, 28000, 50000]) clock.frame(time)
    act(() => result.current.actions.pause())
    act(() => expect(result.current.actions.rewindPausedTo(0)).toBe(true))
    expect(result.current.meta.phasesCompleted).toEqual([])
    expect(result.current.meta.sessionElapsedSec).toBe(0)
    expect(result.current.meta.currentPhaseIndex).toBe(0)
    expect(result.current.state.progress).toBe(0)
    clock.frame(60000)
    expect(result.current.meta.sessionElapsedSec).toBe(0)
    act(() => result.current.actions.resume())
    for (const time of [68000, 88000, 148000, 168000, 188000, 190000]) clock.frame(time)
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onComplete.mock.calls[0][0].sessionElapsedSec).toBe(128)
    expect(onComplete.mock.calls[0][0].phasesCompleted.map((phase: { phase: string }) => phase.phase))
      .toEqual(['armement', 'double_sigh', 'resonance_core', 'omega_lock', 'glide_out'])
    expect(clock.frames.size).toBe(0)
    expect(result.current.actions.rewindPausedTo(0)).toBe(false)
  })

  it.each(['soft', 'core'] as const)('rebuilds the %s sub-cycle without emitting cues', (powerSwitch) => {
    const clock = mockAnimationClock()
    const onBreathStep = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'ignite', powerSwitch, onBreathStep }))
    act(() => result.current.actions.start())
    for (const time of [8000, 28000, 88000, 100000]) clock.frame(time)
    act(() => result.current.actions.pause())
    const calls = onBreathStep.mock.calls.length
    act(() => expect(result.current.actions.rewindPausedTo(91.5)).toBe(true))
    expect(result.current.meta.currentPhaseName).toBe('omega_lock')
    expect(result.current.state.phase).toBe(powerSwitch === 'soft' ? 'expire' : 'hold')
    expect(result.current.state.progress).toBeCloseTo(powerSwitch === 'soft' ? 0.5 / 3 : 0.5)
    expect(onBreathStep).toHaveBeenCalledTimes(calls)
  })

  it('allows the current paused position but never uses wall time to permit a forward jump', () => {
    const clock = mockAnimationClock()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'focus' }))
    act(() => result.current.actions.start())
    clock.frame(7000)
    act(() => result.current.actions.pause())
    clock.set(107000)
    expect(result.current.actions.rewindPausedTo(8)).toBe(false)
    act(() => expect(result.current.actions.rewindPausedTo(7)).toBe(true))
    expect(result.current.meta.sessionElapsedSec).toBe(7)
    act(() => expect(result.current.actions.rewindPausedTo(2)).toBe(true))
    expect(result.current.actions.rewindPausedTo(3)).toBe(false)
    expect(result.current.meta.sessionElapsedSec).toBe(2)
    act(() => result.current.actions.stop())
    expect(result.current.meta.sessionElapsedSec).toBe(2)
    expect(result.current.meta.running).toBe(false)
  })

  it.each([NaN, Infinity, -Infinity, -0.01, 11, 248, 249, Number.MAX_VALUE, '2', null, undefined])
  ('rejects invalid or future targets without any state change (%s)', (target) => {
    const clock = mockAnimationClock()
    const onPhaseChange = vi.fn()
    const onBreathStep = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'focus', onPhaseChange, onBreathStep }))
    act(() => result.current.actions.start())
    clock.frame(8000)
    clock.frame(10000)
    act(() => result.current.actions.pause())
    const beforeMeta = result.current.meta
    const beforeState = result.current.state
    const phaseCalls = onPhaseChange.mock.calls.length
    const breathCalls = onBreathStep.mock.calls.length
    expect(result.current.actions.rewindPausedTo(target as number)).toBe(false)
    expect(result.current.meta).toBe(beforeMeta)
    expect(result.current.state).toBe(beforeState)
    expect(clock.frames.size).toBe(0)
    expect(onPhaseChange).toHaveBeenCalledTimes(phaseCalls)
    expect(onBreathStep).toHaveBeenCalledTimes(breathCalls)
  })

  it('is a no-op while idle, actively running, or stopped', () => {
    const clock = mockAnimationClock()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'focus' }))
    const idle = result.current.meta
    expect(result.current.actions.rewindPausedTo(0)).toBe(false)
    expect(result.current.meta).toBe(idle)
    expect(clock.frames.size).toBe(0)
    act(() => result.current.actions.start())
    clock.frame(5000)
    const running = result.current.meta
    expect(result.current.actions.rewindPausedTo(2)).toBe(false)
    expect(result.current.meta).toBe(running)
    expect(clock.frames.size).toBe(1)
    act(() => result.current.actions.stop())
    const stopped = result.current.meta
    expect(result.current.actions.rewindPausedTo(0)).toBe(false)
    expect(result.current.meta).toBe(stopped)
    expect(clock.frames.size).toBe(0)
  })
})
