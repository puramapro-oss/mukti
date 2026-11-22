import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Network disabled: each test must explicitly mock fetch')
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
