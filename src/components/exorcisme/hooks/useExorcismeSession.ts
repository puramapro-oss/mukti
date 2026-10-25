import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { safeVibrate } from '@/lib/accessibility'
import { sanitizePossessionText } from '@/lib/exorcisme-utils'
import type { UseExorcismePhaseReturn } from './useExorcismePhase'

interface SessionState {
  id: string
  possessionText: string
}

export interface UseExorcismeSessionReturn {
  session: SessionState | null
  sessionRef: React.MutableRefObject<SessionState | null>
  startError: string | null
  possessionDraft: string
  setPossessionDraft: (text: string) => void
  handleSubmitPossession: () => Promise<void>
  exitSession: (outcome: 'completed' | 'interrupted', sealed: boolean) => Promise<void>
  closing: boolean
}

function haptic(pattern: number | number[]) {
  void safeVibrate(pattern)
}

export function useExorcismeSession(
  phaseData: UseExorcismePhaseReturn,
  tapsRef: React.MutableRefObject<number>,
  affirmationFrRef: React.MutableRefObject<string | null>
): UseExorcismeSessionReturn {
  const router = useRouter()
  const [session, setSession] = useState<SessionState | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [possessionDraft, setPossessionDraft] = useState('')
  const [closing, setClosing] = useState(false)

  const sessionRef = useRef<SessionState | null>(null)
  const completedRef = useRef(false)
  const { phase, phaseMsRef, startTsRef } = phaseData

  const sendComplete = useCallback(
    async (outcome: 'completed' | 'interrupted', sealed: boolean) => {
      const s = sessionRef.current
      if (!s) return
      const now = performance.now()
      // Close current phase
      phaseMsRef.current[phase] = Math.max(0, Math.round(now - startTsRef.current))
      const durationSec = (now - startTsRef.current) / 1000

      try {
        await fetch('/api/exorcisme/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: s.id,
            outcome,
            duration_sec: Math.min(15 * 60, Math.max(0, Math.round(durationSec))),
            taps_destruction: tapsRef.current,
            phases_ms: phaseMsRef.current,
            sealed,
            ...(affirmationFrRef.current ? { affirmation_used: affirmationFrRef.current } : {}),
          }),
        })
      } catch {
        // silencieux — l'UX ne doit pas tomber là-dessus
      }
    },
    [phase, phaseMsRef, startTsRef, tapsRef, affirmationFrRef]
  )

  const exitSession = useCallback(
    async (outcome: 'completed' | 'interrupted', sealed: boolean) => {
      if (completedRef.current) return
      completedRef.current = true
      setClosing(true)
      await sendComplete(outcome, sealed)
      if (outcome === 'completed' && sealed) {
        toast.success('Séance scellée. Ce qui te possédait n\'a plus de prise.', {
          duration: 4000,
        })
      } else if (outcome === 'completed') {
        toast('Séance terminée — tu as traversé.', { duration: 3000 })
      } else {
        toast('Séance interrompue — reviens quand tu veux.', { duration: 2500 })
      }
      router.push('/dashboard/exorcisme')
    },
    [router, sendComplete]
  )

  const handleSubmitPossession = useCallback(async () => {
    const text = sanitizePossessionText(possessionDraft)
    if (text.length === 0) {
      setStartError('Nomme au moins un mot.')
      return
    }
    setStartError(null)
    try {
      const resp = await fetch('/api/exorcisme/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ possession_text: text }),
      })
      if (!resp.ok) {
        const { error: errMsg } = await resp.json().catch(() => ({ error: null }))
        setStartError(errMsg ?? 'Impossible de démarrer — réessaie.')
        return
      }
      const data = (await resp.json()) as { session_id: string; possession_text: string }
      const s = { id: data.session_id, possessionText: data.possession_text }
      sessionRef.current = s
      setSession(s)
      haptic(30)
      phaseData.goToPhase('destruction')
    } catch {
      setStartError('Connexion perdue — réessaie.')
    }
  }, [possessionDraft, phaseData])

  return {
    session,
    sessionRef,
    startError,
    possessionDraft,
    setPossessionDraft,
    handleSubmitPossession,
    exitSession,
    closing,
  }
}
