'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'vida-multisensorial'

function readEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === null ? true : raw === '1'
  } catch {
    return true
  }
}

export function useMultisensorialEnabled() {
  const [enabled, setEnabledState] = useState(false)

  useEffect(() => {
    setEnabledState(readEnabled())
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabledState(e.newValue !== '0')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setEnabled = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {}
    setEnabledState(next)
  }, [])

  return [enabled, setEnabled] as const
}

type HapticPattern = 'tap' | 'success' | 'warn' | 'celebration'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 12,
  success: [18, 40, 24],
  warn: [40, 30, 40],
  celebration: [10, 30, 10, 30, 18, 50, 30],
}

export function useHaptic() {
  const [enabled] = useMultisensorialEnabled()

  return useCallback(
    (pattern: HapticPattern = 'tap') => {
      if (!enabled) return
      if (typeof window === 'undefined') return
      const nav = window.navigator
      if (!nav || typeof nav.vibrate !== 'function') return
      try {
        nav.vibrate(PATTERNS[pattern])
      } catch {
        // Silent — vibration unsupported on this device
      }
    },
    [enabled]
  )
}

type Sound432Options = {
  duration?: number
  frequency?: number
  volume?: number
}

export function useSound432() {
  const [enabled] = useMultisensorialEnabled()
  const ctxRef = useRef<AudioContext | null>(null)

  const play = useCallback(
    ({ duration = 1.6, frequency = 432, volume = 0.08 }: Sound432Options = {}) => {
      if (!enabled) return
      if (typeof window === 'undefined') return
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return

      try {
        if (!ctxRef.current) ctxRef.current = new Ctx()
        const ctx = ctxRef.current
        if (ctx.state === 'suspended') void ctx.resume()

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = frequency

        const now = ctx.currentTime
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(volume, now + 0.18)
        gain.gain.setValueAtTime(volume, now + duration - 0.4)
        gain.gain.linearRampToValueAtTime(0, now + duration)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + duration + 0.05)
      } catch {
        // Silent — audio unsupported or autoplay blocked
      }
    },
    [enabled]
  )

  useEffect(() => {
    return () => {
      const ctx = ctxRef.current
      if (ctx && ctx.state !== 'closed') {
        void ctx.close().catch(() => {})
      }
    }
  }, [])

  return play
}
