'use client'

// MUKTI — G5.2 useDemoBreath
// Driver minimal de preview : cycle inspire/hold/expire en boucle.
// Sera remplacé en G5.3 par useAuroraPhase (phases AURORA_PHASES réelles + cohérence).

import { useEffect, useRef, useState } from 'react'
import type { BreathState, BreathPhase } from './types'

export interface DemoBreathConfig {
  inhaleSec: number
  holdSec: number
  exhaleSec: number
  /** Active la respiration auto. */
  active?: boolean
}

export function useDemoBreath(config: DemoBreathConfig = { inhaleSec: 4, holdSec: 2, exhaleSec: 6, active: true }): BreathState {
  const [state, setState] = useState<BreathState>({
    phase: config.active === false ? 'idle' : 'inspire',
    progress: 0,
    elapsedSec: 0,
    phaseDurationSec: config.inhaleSec,
  })
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  const phaseStartRef = useRef<number>(0)
  const phaseRef = useRef<BreathPhase>('inspire')

  useEffect(() => {
    if (config.active === false) {
      setState((s) => ({ ...s, phase: 'idle', progress: 0 }))
      return
    }

    startRef.current = performance.now()
    phaseStartRef.current = performance.now()
    phaseRef.current = 'inspire'

    const tick = (now: number) => {
      const elapsedMs = now - startRef.current
      const phaseElapsedMs = now - phaseStartRef.current

      let duration = config.inhaleSec
      if (phaseRef.current === 'hold') duration = config.holdSec
      else if (phaseRef.current === 'expire') duration = config.exhaleSec

      const progress = Math.max(0, Math.min(1, phaseElapsedMs / 1000 / duration))

      if (progress >= 1) {
        // swap phase
        phaseRef.current =
          phaseRef.current === 'inspire'
            ? config.holdSec > 0
              ? 'hold'
              : 'expire'
            : phaseRef.current === 'hold'
              ? 'expire'
              : 'inspire'
        phaseStartRef.current = now
      }

      const nextPhase = phaseRef.current
      const nextDuration =
        nextPhase === 'inspire'
          ? config.inhaleSec
          : nextPhase === 'hold'
            ? config.holdSec
            : config.exhaleSec

      setState({
        phase: nextPhase,
        progress: progress < 1 ? progress : 0,
        elapsedSec: elapsedMs / 1000,
        phaseDurationSec: nextDuration,
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [config.inhaleSec, config.holdSec, config.exhaleSec, config.active])

  return state
}
