import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAuroraPhase } from '../../src/components/aurora/useAuroraPhase'
import { mockAnimationClock } from './clock'
import { AURORA_PHASES, AURORA_VARIANTS } from '../../src/lib/constants/aurora'

describe('AURORA active time and phase transitions', () => {
  it('never adds an earlier pause back after a breath transition', () => {
    const clock = mockAnimationClock()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'calm' }))
    act(() => result.current.actions.start())
    clock.frame(0)
    clock.frame(1000)
    act(() => result.current.actions.pause())
    clock.set(11000)
    act(() => result.current.actions.resume())
    clock.frame(12100)
    clock.frame(12200)
    expect(result.current.meta.sessionElapsedSec).toBeCloseTo(2.2)
    expect(result.current.meta.currentPhaseIndex).toBe(0)
  })

  it('stopping during a pause records active time only', () => {
    const clock = mockAnimationClock()
    const onStop = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'calm', onStop }))
    act(() => result.current.actions.start())
    clock.frame(1000)
    act(() => result.current.actions.pause())
    clock.set(21000)
    act(() => result.current.actions.stop())
    expect(onStop).toHaveBeenCalledOnce()
    expect(onStop.mock.calls[0][1].sessionElapsedSec).toBe(1)
  })

  it('does not spend animation frames while paused', () => {
    const clock = mockAnimationClock()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'calm' }))
    act(() => result.current.actions.start())
    act(() => result.current.actions.pause())
    expect(clock.frames.size).toBe(0)
    act(() => result.current.actions.resume())
    act(() => result.current.actions.resume())
    expect(clock.frames.size).toBe(1)
  })

  it('starts with a fresh visible state before the first frame', () => {
    mockAnimationClock()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'calm' }))
    act(() => result.current.actions.start())
    expect(result.current.meta.running).toBe(true)
    expect(result.current.state.phase).toBe('inspire')
    act(() => result.current.actions.stop())
    act(() => result.current.actions.start())
    expect(result.current.meta.stoppedReason).toBeNull()
    expect(result.current.meta.phasesCompleted).toEqual([])
  })

  it('sends the first breath cue immediately when the phase changes', () => {
    const clock = mockAnimationClock()
    const onBreathStep = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'calm', onBreathStep }))
    act(() => result.current.actions.start())
    for (const time of [0, 2100, 4101, 6200, 8010]) clock.frame(time)
    expect(result.current.meta.currentPhaseName).toBe('double_sigh')
    expect(onBreathStep).toHaveBeenLastCalledWith('inspire')
    expect(result.current.state.progress).toBe(0)
  })

  it.each(['soft', 'core'] as const)('honours the %s hold setting', (powerSwitch) => {
    const clock = mockAnimationClock()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'ignite', powerSwitch }))
    act(() => result.current.actions.start())
    for (const time of [0, 8000, 28000, 88000, 91000]) clock.frame(time)
    expect(result.current.state.phase).toBe(powerSwitch === 'soft' ? 'expire' : 'hold')
  })

  it('completes once and releases the animation loop', () => {
    const clock = mockAnimationClock()
    const onComplete = vi.fn()
    const onStop = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'ignite', onComplete, onStop }))
    act(() => result.current.actions.start())
    for (const time of [0, 8000, 28000, 88000, 108000, 128000, 130000]) clock.frame(time)
    act(() => result.current.actions.stop())
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onStop).not.toHaveBeenCalled()
    expect(clock.frames.size).toBe(0)
    expect(onComplete.mock.calls[0][0].sessionElapsedSec).toBe(128)
  })

  it('repeated stop commands save only once', () => {
    const clock = mockAnimationClock()
    const onStop = vi.fn()
    const { result } = renderHook(() => useAuroraPhase({ variant: 'calm', onStop }))
    act(() => result.current.actions.start())
    clock.frame(1000)
    act(() => { result.current.actions.stop(); result.current.actions.stop() })
    expect(onStop).toHaveBeenCalledOnce()
    expect(clock.frames.size).toBe(0)
  })

  it.each(AURORA_VARIANTS)('advertises the rounded duration of $id accurately', ({ id, duration_min }) => {
    const seconds = AURORA_PHASES[id].reduce((sum, phase) => sum + phase.duration_sec, 0)
    expect(duration_min).toBe(Math.round(seconds / 60))
  })
})
