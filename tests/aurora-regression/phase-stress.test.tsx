import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAuroraPhase } from '../../src/components/aurora/useAuroraPhase'
import { AURORA_PHASES, type AuroraVariant, type AuroraPowerSwitch } from '../../src/lib/constants'
import { mockAnimationClock } from './clock'

const variants: AuroraVariant[] = ['calm', 'focus', 'sleep', 'ignite']
const modes: AuroraPowerSwitch[] = ['soft', 'core', 'omega']

describe.each(variants)('full deterministic lifecycle: %s', (variant) => {
  it.each(modes)('%s: exact active time, repeated pauses, single completion and restart', (powerSwitch) => {
    const clock = mockAnimationClock()
    const onComplete = vi.fn()
    const onStop = vi.fn()
    const onPhaseChange = vi.fn()
    const onBreathStep = vi.fn()
    const view = renderHook(() => useAuroraPhase({ variant, powerSwitch, onComplete, onStop, onPhaseChange, onBreathStep }))
    const total = AURORA_PHASES[variant].reduce((sum, phase) => sum + phase.duration_sec, 0)
    let now = 0
    let activeMs = 0
    let iterations = 0
    act(() => { view.result.current.actions.start(); view.result.current.actions.start() })
    expect(clock.frames.size).toBe(1)
    while (view.result.current.meta.running && iterations < 20_000) {
      if (iterations % 37 === 0) {
        const elapsed = view.result.current.meta.sessionElapsedSec
        act(() => { view.result.current.actions.pause(); view.result.current.actions.pause() })
        expect(clock.frames.size).toBe(0)
        now += 1000 + (iterations * 7919) % 120_000
        clock.frame(now)
        expect(view.result.current.meta.sessionElapsedSec).toBe(elapsed)
        act(() => { view.result.current.actions.resume(); view.result.current.actions.resume() })
        expect(clock.frames.size).toBe(1)
      }
      now += 100
      activeMs += 100
      clock.frame(now)
      expect(view.result.current.meta.sessionElapsedSec).toBeCloseTo(Math.min(total, activeMs / 1000), 7)
      expect(Number.isFinite(view.result.current.state.progress)).toBe(true)
      expect(view.result.current.state.progress).toBeGreaterThanOrEqual(0)
      expect(view.result.current.state.progress).toBeLessThanOrEqual(1)
      iterations++
    }
    expect(iterations).toBeLessThan(20_000)
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onStop).not.toHaveBeenCalled()
    expect(clock.frames.size).toBe(0)
    expect(view.result.current.meta.sessionElapsedSec).toBe(total)
    expect(onPhaseChange.mock.calls.map(call => call[0])).toEqual(AURORA_PHASES[variant].map(phase => phase.name))
    expect(onComplete.mock.calls[0][0].phasesCompleted.map((phase: { duration_sec: number }) => phase.duration_sec))
      .toEqual(AURORA_PHASES[variant].map(phase => phase.duration_sec))
    if (powerSwitch === 'soft') expect(onBreathStep.mock.calls.some(call => call[0] === 'hold')).toBe(false)
    act(() => { view.result.current.actions.stop(); view.result.current.actions.resume() })
    expect(clock.frames.size).toBe(0)
    act(() => view.result.current.actions.start())
    expect(view.result.current.meta.sessionElapsedSec).toBe(0)
    act(() => view.result.current.actions.stop())
    expect(onStop).toHaveBeenCalledOnce()
    expect(onComplete).toHaveBeenCalledOnce()
    view.unmount()
    expect(clock.frames.size).toBe(0)
  }, 15_000)
})
