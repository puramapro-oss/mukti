// MUKTI — G5.3 AURORA Haptique (navigator.vibrate)
// Patterns discrets par phase — no-op si non supporté (iOS Safari, desktop).
// Brief section 5 : inspire montée continue, expire glide long, pause tap unique.

import type { BreathPhase } from '@/components/aurora/types'
import { safeVibrate } from '@/lib/accessibility'

export interface AuroraHapticHandle {
  pulse: (phase: BreathPhase) => void
  cancel: () => void
  setEnabled: (enabled: boolean) => void
  isSupported: () => boolean
}

/**
 * Retourne un pattern en ms pour `navigator.vibrate`.
 * Chaque valeur alterne ON/OFF (ex [50, 30, 80] = 50ms on, 30ms off, 80ms on).
 */
function patternForPhase(phase: BreathPhase): number[] | null {
  switch (phase) {
    case 'inspire':
      // micro-vagues montantes de 20ms espacées (sensation "aspirer")
      return [20, 60, 30, 60, 40, 60, 50]
    case 'expire':
      // glide long unique — sensation "déposer"
      return [180]
    case 'hold':
      // tap unique sec (ancre neurologique)
      return [15]
    default:
      return null
  }
}

export function createAuroraHaptic(): AuroraHapticHandle {
  let enabled = true

  const isSupported = () =>
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

  function pulse(phase: BreathPhase) {
    if (!enabled) return
    if (!isSupported()) return
    const pattern = patternForPhase(phase)
    if (!pattern) {
      try {
        navigator.vibrate(0)
      } catch {
        /* noop */
      }
      return
    }
    try {
      safeVibrate(pattern)
    } catch {
      /* noop */
    }
  }

  function cancel() {
    if (!isSupported()) return
    try {
      navigator.vibrate(0)
    } catch {
      /* noop */
    }
  }

  function setEnabled(v: boolean) {
    enabled = v
    if (!v) cancel()
  }

  return { pulse, cancel, setEnabled, isSupported }
}
