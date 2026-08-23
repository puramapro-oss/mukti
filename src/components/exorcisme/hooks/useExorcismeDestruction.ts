import { useCallback, useRef, useState } from 'react'
import { safeVibrate } from '@/lib/accessibility'
import { EXORCISME_SHATTER_TAPS } from '@/lib/exorcisme-utils'
import type { UseExorcismePhaseReturn } from './useExorcismePhase'

function haptic(pattern: number | number[]) {
  void safeVibrate(pattern)
}

export interface UseExorcismeDestructionReturn {
  taps: number
  affirmationFr: string | null
  affirmationLoading: boolean
  affirmationError: string | null
  handleDestructionTap: () => void
}

export function useExorcismeDestruction(
  sessionRef: React.MutableRefObject<{ id: string; possessionText: string } | null>,
  tapsRef: React.MutableRefObject<number>,
  affirmationFrRef: React.MutableRefObject<string | null>,
  goToPhase: UseExorcismePhaseReturn['goToPhase']
): UseExorcismeDestructionReturn {
  const [taps, setTaps] = useState(0)
  const [affirmationFr, setAffirmationFr] = useState<string | null>(null)
  const [affirmationLoading, setAffirmationLoading] = useState(false)
  const [affirmationError, setAffirmationError] = useState<string | null>(null)

  const handleDestructionTap = useCallback(() => {
    setTaps(prev => {
      const next = prev + 1
      tapsRef.current = next
      haptic([30, 60, 90])
      if (next >= EXORCISME_SHATTER_TAPS) {
        // fetch affirmation puis go reprogrammation
        if (sessionRef.current) {
          const { id: sessionId, possessionText } = sessionRef.current
          setAffirmationLoading(true)
          setAffirmationError(null)
          fetch('/api/exorcisme/affirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              possession_text: possessionText,
            }),
          })
            .then(async r => {
              if (!r.ok) throw new Error('fetch_failed')
              return (await r.json()) as { affirmation_fr: string; affirmation_en: string }
            })
            .then(data => {
              setAffirmationFr(data.affirmation_fr)
              affirmationFrRef.current = data.affirmation_fr
            })
            .catch(() => {
              // Fallback mot générique — UI affiche quelque chose plutôt que rien
              const fallback = 'Ce qui me possédait n\'a plus de prise. Je choisis ce qui me nourrit.'
              setAffirmationFr(fallback)
              affirmationFrRef.current = fallback
              setAffirmationError('generator_unavailable')
            })
            .finally(() => setAffirmationLoading(false))
        }
        // Petite pause cinématographique avant phase 4
        setTimeout(() => goToPhase('reprogrammation'), 900)
      }
      return next
    })
  }, [sessionRef, tapsRef, affirmationFrRef, goToPhase])

  return {
    taps,
    affirmationFr,
    affirmationLoading,
    affirmationError,
    handleDestructionTap,
  }
}
