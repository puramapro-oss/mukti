import { act } from '@testing-library/react'
import { vi } from 'vitest'

export function mockAnimationClock() {
  let now = 0
  let id = 0
  const frames = new Map<number, FrameRequestCallback>()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => frames.delete(handle))
  return {
    frames,
    set: (timeMs: number) => { now = timeMs },
    frame: (timeMs: number) => {
      now = timeMs
      const pending = [...frames.values()]
      frames.clear()
      act(() => pending.forEach((callback) => callback(now)))
    },
  }
}
