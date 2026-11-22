import { StrictMode, type PropsWithChildren } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNightPlayerVolume } from '../../src/components/reprogrammation/useNightPlayerVolume'
import { useExorcismePhase } from '../../src/components/exorcisme/hooks/useExorcismePhase'
import { REPROG_NIGHT_VOLUME_RAMP_MIN } from '../../src/lib/constants'
import { mockAnimationClock } from './clock'

const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>

describe('night volume clock lifecycle', () => {
  it('preserves active time when callbacks are replaced during playback', () => {
    const clock = mockAnimationClock()
    const first = vi.fn(), second = vi.fn(), stop = vi.fn()
    const view = renderHook((props) => useNightPlayerVolume(props), {
      initialProps: { running: true, rampEnabled: true, onVolumeChange: first, onAutoStop: stop },
    })
    clock.frame(10_000)
    view.rerender({ running: true, rampEnabled: true, onVolumeChange: second, onAutoStop: stop })
    clock.frame(20_000)
    expect(view.result.current.elapsedSec).toBe(20)
    expect(second).toHaveBeenCalledOnce()
    expect(first).toHaveBeenCalledOnce()
  })
  it('changing ramp preference does not reset elapsed time', () => {
    const clock = mockAnimationClock()
    const onVolumeChange = vi.fn(), onAutoStop = vi.fn()
    const view = renderHook((props) => useNightPlayerVolume(props), {
      initialProps: { running: true, rampEnabled: true, onVolumeChange, onAutoStop },
    })
    clock.frame(5_000)
    view.rerender({ running: true, rampEnabled: false, onVolumeChange, onAutoStop })
    clock.frame(10_000)
    expect(view.result.current.elapsedSec).toBe(10)
    expect(view.result.current.volumePct).toBe(0.45)
    view.rerender({ running: true, rampEnabled: true, onVolumeChange, onAutoStop })
    clock.frame(15_000)
    expect(view.result.current.elapsedSec).toBe(15)
  })
  it('completes once at the deadline with zero volume and no remaining frame', () => {
    const clock = mockAnimationClock(), onVolumeChange = vi.fn(), onAutoStop = vi.fn()
    const view = renderHook(() => useNightPlayerVolume({ running: true, rampEnabled: true, onVolumeChange, onAutoStop }))
    clock.frame(REPROG_NIGHT_VOLUME_RAMP_MIN * 60_000)
    expect(onAutoStop).toHaveBeenCalledOnce()
    expect(onVolumeChange).toHaveBeenLastCalledWith(0)
    expect(view.result.current.rampProgress).toBe(1)
    expect(view.result.current.rampRemainingSec).toBe(0)
    expect(clock.frames.size).toBe(0)
    clock.frame(REPROG_NIGHT_VOLUME_RAMP_MIN * 60_000 + 1_000)
    expect(onAutoStop).toHaveBeenCalledOnce()
  })
  it('uses the latest stop callback without restarting the clock', () => {
    const clock = mockAnimationClock(), onVolumeChange = vi.fn()
    const oldStop = vi.fn(), newStop = vi.fn()
    const view = renderHook((props) => useNightPlayerVolume(props), {
      initialProps: { running: true, rampEnabled: true, onVolumeChange, onAutoStop: oldStop },
    })
    clock.frame(1_000)
    view.rerender({ running: true, rampEnabled: true, onVolumeChange, onAutoStop: newStop })
    clock.frame(REPROG_NIGHT_VOLUME_RAMP_MIN * 60_000)
    expect(oldStop).not.toHaveBeenCalled()
    expect(newStop).toHaveBeenCalledOnce()
  })
  it('stops the frame loop on unmount, including an already captured callback', () => {
    const clock = mockAnimationClock(), onVolumeChange = vi.fn(), onAutoStop = vi.fn()
    const view = renderHook(() => useNightPlayerVolume({ running: true, rampEnabled: true, onVolumeChange, onAutoStop }))
    const pending = [...clock.frames.values()]
    view.unmount()
    expect(clock.frames.size).toBe(0)
    act(() => pending.forEach(callback => callback(10_000)))
    expect(onVolumeChange).not.toHaveBeenCalled()
    expect(clock.frames.size).toBe(0)
  })
  it('starts a new clock after explicit stop and restart', () => {
    const clock = mockAnimationClock(), onVolumeChange = vi.fn(), onAutoStop = vi.fn()
    const view = renderHook((props) => useNightPlayerVolume(props), {
      initialProps: { running: true, rampEnabled: true, onVolumeChange, onAutoStop },
    })
    clock.frame(10_000)
    view.rerender({ running: false, rampEnabled: true, onVolumeChange, onAutoStop })
    expect(clock.frames.size).toBe(0)
    expect(view.result.current.elapsedSec).toBe(0)
    clock.set(20_000)
    view.rerender({ running: true, rampEnabled: true, onVolumeChange, onAutoStop })
    clock.frame(25_000)
    expect(view.result.current.elapsedSec).toBe(5)
  })
})

describe('phase timing snapshots', () => {
  it('measures the last phase from its own start, not the session start', () => {
    const clock = mockAnimationClock()
    const view = renderHook(() => useExorcismePhase())
    clock.set(1_000); act(() => view.result.current.goToPhase('revelation'))
    clock.set(3_000); act(() => view.result.current.goToPhase('destruction'))
    clock.set(7_000)
    expect(view.result.current.snapshotPhaseDurations()).toEqual({ invocation: 1_000, revelation: 2_000, destruction: 4_000 })
    expect(view.result.current.phaseMsRef.current).toEqual({ invocation: 1_000, revelation: 2_000 })
  })
  it('keeps state updater side effects out of StrictMode replays', () => {
    const clock = mockAnimationClock()
    const view = renderHook(() => useExorcismePhase(), { wrapper })
    clock.set(1_000); act(() => view.result.current.goToPhase('revelation'))
    clock.set(3_000)
    expect(view.result.current.snapshotPhaseDurations()).toEqual({ invocation: 1_000, revelation: 2_000 })
  })
  it('does not restart a phase when receiving its transition twice', () => {
    const clock = mockAnimationClock()
    const view = renderHook(() => useExorcismePhase())
    clock.set(1_000); act(() => view.result.current.goToPhase('revelation'))
    clock.set(2_000); act(() => view.result.current.goToPhase('revelation'))
    clock.set(3_000)
    expect(view.result.current.snapshotPhaseDurations()).toEqual({ invocation: 1_000, revelation: 2_000 })
  })
  it('returns an independent snapshot without closing or mutating the phase', () => {
    const clock = mockAnimationClock()
    const view = renderHook(() => useExorcismePhase())
    clock.set(1_000)
    const snapshot = view.result.current.snapshotPhaseDurations()
    snapshot.invocation = 999
    clock.set(2_000)
    expect(view.result.current.snapshotPhaseDurations().invocation).toBe(2_000)
    expect(view.result.current.phaseMsRef.current).toEqual({})
  })
  it('preserves earlier visits to a phase', () => {
    const clock = mockAnimationClock()
    const view = renderHook(() => useExorcismePhase())
    clock.set(1_000); act(() => view.result.current.goToPhase('revelation'))
    clock.set(3_000); act(() => view.result.current.goToPhase('invocation'))
    clock.set(5_000)
    expect(view.result.current.snapshotPhaseDurations()).toEqual({ invocation: 3_000, revelation: 2_000 })
  })
  it('cancels automatic transitions on unmount', () => {
    vi.useFakeTimers()
    mockAnimationClock()
    const view = renderHook(() => useExorcismePhase())
    expect(vi.getTimerCount()).toBe(1)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
