import { StrictMode } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNightPlayerVolume } from '@/components/reprogrammation/useNightPlayerVolume'
import { REPROG_NIGHT_VOLUME_RAMP_MIN } from '@/lib/constants'
import { mockAnimationClock } from './clock'

const rampSeconds = REPROG_NIGHT_VOLUME_RAMP_MIN * 60

describe('useNightPlayerVolume lifecycle', () => {
  it('starts one loop, stops it and restarts elapsed time from the new session', () => {
    const clock = mockAnimationClock()
    const onVolumeChange = vi.fn()
    const onAutoStop = vi.fn()
    const { result, rerender, unmount } = renderHook(
      ({ running }) => useNightPlayerVolume({
        running, rampEnabled: true, onVolumeChange, onAutoStop,
      }),
      { initialProps: { running: false } },
    )

    expect(clock.frames.size).toBe(0)
    clock.frame(1000)
    expect(onVolumeChange).not.toHaveBeenCalled()
    expect(result.current.elapsedSec).toBe(0)

    rerender({ running: true })
    expect(clock.frames.size).toBe(1)
    clock.frame(11000)
    expect(result.current.elapsedSec).toBe(10)
    rerender({ running: true })
    expect(clock.frames.size).toBe(1)

    rerender({ running: false })
    expect(clock.frames.size).toBe(0)
    expect(result.current.elapsedSec).toBe(0)
    expect(result.current.rampProgress).toBe(0)
    expect(result.current.rampRemainingSec).toBe(rampSeconds)
    clock.frame(200000)
    expect(onVolumeChange).toHaveBeenCalledTimes(1)

    rerender({ running: true })
    expect(clock.frames.size).toBe(1)
    clock.frame(230000)
    expect(result.current.elapsedSec).toBe(30)
    expect(onVolumeChange).toHaveBeenCalledTimes(2)
    expect(onAutoStop).not.toHaveBeenCalled()

    unmount()
    expect(clock.frames.size).toBe(0)
    clock.frame(300000)
    expect(onVolumeChange).toHaveBeenCalledTimes(2)
  })

  it('ramps to zero and requests auto-stop once even before the parent stops', () => {
    const clock = mockAnimationClock()
    clock.set(5000)
    const onVolumeChange = vi.fn()
    const onAutoStop = vi.fn()
    const { result } = renderHook(() => useNightPlayerVolume({
      running: true, rampEnabled: true, onVolumeChange, onAutoStop,
    }))

    clock.frame(5000 + rampSeconds * 500)
    expect(result.current.elapsedSec).toBe(rampSeconds / 2)
    expect(result.current.volumePct).toBeCloseTo(0.275)
    expect(result.current.rampProgress).toBe(0.5)
    expect(result.current.rampRemainingSec).toBe(rampSeconds / 2)
    expect(onAutoStop).not.toHaveBeenCalled()

    clock.frame(5000 + rampSeconds * 1000)
    expect(result.current.volumePct).toBe(0)
    expect(result.current.rampProgress).toBe(1)
    expect(result.current.rampRemainingSec).toBe(0)
    expect(onVolumeChange).toHaveBeenLastCalledWith(0)
    expect(onAutoStop).toHaveBeenCalledTimes(1)
    expect(clock.frames.size).toBe(0)

    clock.frame(5000 + rampSeconds * 2000)
    expect(onAutoStop).toHaveBeenCalledTimes(1)
    expect(onVolumeChange).toHaveBeenCalledTimes(2)
  })

  it('uses the latest auto-stop callback without restarting the ramp', () => {
    const clock = mockAnimationClock()
    const onVolumeChange = vi.fn()
    const firstStop = vi.fn()
    const latestStop = vi.fn()
    const { result, rerender } = renderHook(
      ({ onAutoStop }) => useNightPlayerVolume({
        running: true, rampEnabled: true, onVolumeChange, onAutoStop,
      }),
      { initialProps: { onAutoStop: firstStop } },
    )

    clock.frame(rampSeconds * 500)
    rerender({ onAutoStop: latestStop })
    expect(clock.frames.size).toBe(1)
    clock.frame(rampSeconds * 1000)

    expect(result.current.elapsedSec).toBe(rampSeconds)
    expect(firstStop).not.toHaveBeenCalled()
    expect(latestStop).toHaveBeenCalledTimes(1)
    expect(clock.frames.size).toBe(0)
  })

  it('keeps fixed volume past the ramp deadline until explicitly stopped', () => {
    const clock = mockAnimationClock()
    const onVolumeChange = vi.fn()
    const onAutoStop = vi.fn()
    const { result, rerender } = renderHook(
      ({ running }) => useNightPlayerVolume({
        running, rampEnabled: false, onVolumeChange, onAutoStop,
      }),
      { initialProps: { running: true } },
    )

    clock.frame((rampSeconds + 60) * 1000)
    expect(result.current.volumePct).toBe(0.45)
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.45)
    expect(onAutoStop).not.toHaveBeenCalled()
    expect(clock.frames.size).toBe(1)

    rerender({ running: false })
    expect(clock.frames.size).toBe(0)
    expect(result.current.elapsedSec).toBe(0)
  })

  it('keeps only one RAF under StrictMode and releases it on unmount', () => {
    const clock = mockAnimationClock()
    const onVolumeChange = vi.fn()
    const onAutoStop = vi.fn()
    const { unmount } = renderHook(() => useNightPlayerVolume({
      running: true, rampEnabled: true, onVolumeChange, onAutoStop,
    }), { wrapper: StrictMode })

    expect(clock.frames.size).toBe(1)
    clock.frame(1000)
    expect(onVolumeChange).toHaveBeenCalledTimes(1)
    expect(clock.frames.size).toBe(1)

    unmount()
    expect(clock.frames.size).toBe(0)
    clock.frame(2000)
    expect(onVolumeChange).toHaveBeenCalledTimes(1)
    expect(onAutoStop).not.toHaveBeenCalled()
  })
})
