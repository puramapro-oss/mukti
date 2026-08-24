import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseArSessionResult {
  sessionId: string | null
  startingSession: boolean
  startError: string | null
  remaining: number
  completionStatus: 'idle' | 'saving' | 'saved' | 'error'
  completionMsg: string | null
  handleStart: (params: {
    mode: 'manifestation' | 'liberation'
    species_slug: string
    beacon_slug?: string
    fallback_imaginary: boolean
  }) => Promise<boolean>
  handleComplete: (durationUsed: number, intensityVal: number | null) => Promise<void>
  handleStopEarly: () => void
  handleRetry: () => void
}

export function useArSession(durationSec: number): UseArSessionResult {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [startingSession, setStartingSession] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number>(0)
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [completionMsg, setCompletionMsg] = useState<string | null>(null)
  const sessionStartRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  const handleComplete = useCallback(
    async (durationUsed: number, intensityVal: number | null) => {
      if (!sessionId) return
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      setCompletionStatus('saving')
      setCompletionMsg(null)
      try {
        const res = await fetch(`/api/ar/sessions/${sessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            duration_sec: durationUsed,
            intensity_1_5: intensityVal ?? undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          setCompletionStatus('error')
          setCompletionMsg(data.error ?? 'Impossible de clôturer la session.')
          return
        }
        setCompletionStatus('saved')
        setCompletionMsg('Ton envoi est scellé ✨')
      } catch {
        setCompletionStatus('error')
        setCompletionMsg('Erreur réseau. Ta session reste valide localement.')
      }
    },
    [sessionId],
  )

  useEffect(() => {
    if (sessionId === null || sessionStartRef.current === null) return
    const tick = () => {
      if (sessionStartRef.current === null) return
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000)
      const left = Math.max(0, durationSec - elapsed)
      setRemaining(left)
      if (left <= 0) {
        handleComplete(durationSec, null)
      }
    }
    tick()
    timerRef.current = window.setInterval(tick, 500)
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, durationSec])

  const handleStart = useCallback(
    async (params: {
      mode: 'manifestation' | 'liberation'
      species_slug: string
      beacon_slug?: string
      fallback_imaginary: boolean
    }): Promise<boolean> => {
      setStartError(null)
      setStartingSession(true)
      try {
        const res = await fetch('/api/ar/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          setStartError(data.error ?? 'Impossible de démarrer la session.')
          setStartingSession(false)
          return false
        }
        setSessionId(data.session.id)
        sessionStartRef.current = Date.now()
        setRemaining(durationSec)
        setStartingSession(false)
        return true
      } catch {
        setStartError('Erreur réseau. Réessaie.')
        setStartingSession(false)
        return false
      }
    },
    [durationSec],
  )

  const handleStopEarly = useCallback(() => {
    if (sessionStartRef.current === null) return
    const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000)
    handleComplete(elapsed, null)
  }, [handleComplete])

  const handleRetry = useCallback(() => {
    setSessionId(null)
    sessionStartRef.current = null
    setRemaining(0)
    setCompletionStatus('idle')
    setCompletionMsg(null)
  }, [])

  return {
    sessionId,
    startingSession,
    startError,
    remaining,
    completionStatus,
    completionMsg,
    handleStart,
    handleComplete,
    handleStopEarly,
    handleRetry,
  }
}
