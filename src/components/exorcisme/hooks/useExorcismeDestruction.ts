import { useCallback, useEffect, useRef, useState } from 'react'
import { safeVibrate } from '@/lib/accessibility'
import { EXORCISME_SHATTER_TAPS } from '@/lib/exorcisme-utils'
import { wellbeingRequest } from '@/lib/wellbeing-request'
import type { UseExorcismePhaseReturn } from './useExorcismePhase'

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
  goToPhase: UseExorcismePhaseReturn['goToPhase'],
  active = true,
): UseExorcismeDestructionReturn {
  const [taps, setTaps] = useState(0)
  const [affirmationFr, setAffirmationFr] = useState<string | null>(null)
  const [affirmationLoading, setAffirmationLoading] = useState(false)
  const [affirmationError, setAffirmationError] = useState<string | null>(null)
  const mounted = useRef(false)
  const finished = useRef(false)
  const request = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mounted.current = active
    return () => {
      mounted.current = false
      request.current?.abort()
      request.current = null
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    }
  }, [active])

  const handleDestructionTap = useCallback(() => {
    const session = sessionRef.current
    if (!active || !mounted.current || finished.current || !session) return
    const next = Math.min(EXORCISME_SHATTER_TAPS, tapsRef.current + 1)
    tapsRef.current = next
    setTaps(next)
    void safeVibrate([30, 60, 90])
    if (next < EXORCISME_SHATTER_TAPS) return
    // Lock effects synchronously. React may replay state updaters in StrictMode.
    finished.current = true
    const controller = new AbortController()
    request.current = controller
    const isCurrent = () => mounted.current && !controller.signal.aborted && sessionRef.current?.id === session.id
    setAffirmationLoading(true)
    setAffirmationError(null)
    void wellbeingRequest<Record<string, unknown>>('/api/exorcisme/affirmation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, possession_text: session.possessionText }),
    }, controller.signal).then(data => {
      if (!isCurrent()) return
      if (typeof data.affirmation_fr !== 'string' || !data.affirmation_fr.trim() || data.affirmation_fr.length > 320) {
        throw new Error('invalid_guidance')
      }
      setAffirmationFr(data.affirmation_fr)
      affirmationFrRef.current = data.affirmation_fr
    }).catch(() => {
      if (!isCurrent()) return
      const fallback = 'Je choisis ce qui me nourrit. Je peux avancer à mon rythme.'
      setAffirmationFr(fallback)
      affirmationFrRef.current = fallback
      setAffirmationError('generator_unavailable')
    }).finally(() => {
      if (isCurrent()) setAffirmationLoading(false)
      if (request.current === controller) request.current = null
    })
    timer.current = setTimeout(() => {
      timer.current = null
      if (isCurrent()) goToPhase('reprogrammation')
    }, 900)
  }, [active, sessionRef, tapsRef, affirmationFrRef, goToPhase])

  return { taps, affirmationFr, affirmationLoading, affirmationError, handleDestructionTap }
}
