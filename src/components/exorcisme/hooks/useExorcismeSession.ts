import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { safeVibrate } from '@/lib/accessibility'
import { sanitizePossessionText } from '@/lib/exorcisme-utils'
import { wellbeingRequest } from '@/lib/wellbeing-request'
import type { UseExorcismePhaseReturn } from './useExorcismePhase'

interface SessionState { id: string; possessionText: string }

export interface UseExorcismeSessionReturn {
  session: SessionState | null
  sessionRef: React.MutableRefObject<SessionState | null>
  startError: string | null
  possessionDraft: string
  setPossessionDraft: (text: string) => void
  handleSubmitPossession: () => Promise<void>
  exitSession: (outcome: 'completed' | 'interrupted', sealed: boolean) => Promise<void>
  starting: boolean
  closing: boolean
  saving: boolean
  saveError: string | null
  retrySave: () => Promise<void>
  leaveWithoutSaving: () => void
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function useExorcismeSession(
  phaseData: UseExorcismePhaseReturn,
  tapsRef: React.MutableRefObject<number>,
  affirmationFrRef: React.MutableRefObject<string | null>
): UseExorcismeSessionReturn {
  const router = useRouter()
  const [session, setSession] = useState<SessionState | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [possessionDraft, setPossessionDraft] = useState('')
  const [starting, setStarting] = useState(false)
  const [closing, setClosing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const sessionRef = useRef<SessionState | null>(null)
  const mounted = useRef(false)
  const leaving = useRef(false)
  const closingRef = useRef(false)
  const request = useRef<AbortController | null>(null)
  const attempt = useRef(0)
  const completionBody = useRef<string | null>(null)
  const { snapshotPhaseDurations, startTsRef, goToPhase } = phaseData

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      attempt.current += 1
      request.current?.abort()
      request.current = null
      sessionRef.current = null
    }
  }, [])

  const leaveWithoutSaving = useCallback(() => {
    if (!mounted.current || leaving.current) return
    leaving.current = true
    attempt.current += 1
    request.current?.abort()
    request.current = null
    sessionRef.current = null
    router.push('/dashboard/exorcisme')
  }, [router])

  const retrySave = useCallback(async () => {
    const body = completionBody.current
    if (!body || !mounted.current || leaving.current || request.current) return
    const current = ++attempt.current
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setSaveError(null)
    const isCurrent = () => mounted.current && !leaving.current && attempt.current === current
    try {
      await wellbeingRequest('/api/exorcisme/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      }, controller.signal)
      if (!isCurrent()) return
      toast.success('Séance enregistrée.')
      leaveWithoutSaving()
    } catch (error) {
      if (isCurrent()) setSaveError(error instanceof Error ? error.message : 'Enregistrement non confirmé.')
    } finally {
      if (isCurrent()) {
        request.current = null
        setSaving(false)
      }
    }
  }, [leaveWithoutSaving])

  const exitSession = useCallback(async (outcome: 'completed' | 'interrupted', sealed: boolean) => {
    if (!mounted.current || leaving.current || closingRef.current) return
    closingRef.current = true
    attempt.current += 1
    request.current?.abort()
    request.current = null
    const currentSession = sessionRef.current
    // Invalidate guidance and taps synchronously, before the closing screen renders.
    sessionRef.current = null
    setStarting(false)
    setClosing(true)
    if (!currentSession) { leaveWithoutSaving(); return }
    const now = performance.now()
    completionBody.current = JSON.stringify({
      session_id: currentSession.id, outcome,
      duration_sec: Math.min(15 * 60, Math.max(0, Math.round((now - startTsRef.current) / 1000))),
      taps_destruction: tapsRef.current,
      phases_ms: snapshotPhaseDurations(now), sealed,
      ...(affirmationFrRef.current ? { affirmation_used: affirmationFrRef.current } : {}),
    })
    await retrySave()
  }, [affirmationFrRef, leaveWithoutSaving, retrySave, snapshotPhaseDurations, startTsRef, tapsRef])

  const handleSubmitPossession = useCallback(async () => {
    if (!mounted.current || leaving.current || closingRef.current || request.current || sessionRef.current) return
    const text = sanitizePossessionText(possessionDraft)
    if (!text) { setStartError('Nomme au moins un mot.'); return }
    const current = ++attempt.current
    const controller = new AbortController()
    request.current = controller
    setStarting(true)
    setStartError(null)
    const isCurrent = () => mounted.current && !leaving.current && !closingRef.current && attempt.current === current
    try {
      const data = await wellbeingRequest<Record<string, unknown>>('/api/exorcisme/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ possession_text: text }),
      }, controller.signal)
      if (!isCurrent()) return
      if (typeof data.session_id !== 'string' || !UUID.test(data.session_id)
        || typeof data.possession_text !== 'string' || !sanitizePossessionText(data.possession_text)) {
        throw new Error('Démarrage non confirmé : réponse invalide.')
      }
      const next = { id: data.session_id, possessionText: sanitizePossessionText(data.possession_text) }
      sessionRef.current = next
      setSession(next)
      void safeVibrate(30)
      goToPhase('destruction')
    } catch (error) {
      if (isCurrent()) setStartError(error instanceof Error ? error.message : 'Démarrage non confirmé.')
    } finally {
      if (isCurrent()) {
        request.current = null
        setStarting(false)
      }
    }
  }, [goToPhase, possessionDraft])

  return { session, sessionRef, startError, possessionDraft, setPossessionDraft,
    handleSubmitPossession, exitSession, starting, closing, saving, saveError, retrySave, leaveWithoutSaving }
}
