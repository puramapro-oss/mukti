import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  BOUCLE_URGENCE_HAPTIC_PATTERN,
  BOUCLE_URGENCE_HAPTIC_INTERVAL_MS,
  BOUCLE_URGENCE_WORD_INTERVAL_MS,
  BOUCLE_URGENCE_WORD_VISIBLE_MS,
} from '@/lib/boucle-urgence-utils'
import { safeVibrate } from '@/lib/accessibility'

function vibrate(pattern: number | number[]) {
  void safeVibrate(pattern)
}

interface UseBoucleUrgenceSessionParams {
  isOpen: boolean
  triggerSource: string | null
  targetDurationSec: number
  onComplete: () => void
}

export function useBoucleUrgenceSession({
  isOpen,
  triggerSource,
  targetDurationSec,
  onComplete,
}: UseBoucleUrgenceSessionParams) {
  const [session, setSession] = useState<{ session_id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [wordIndex, setWordIndex] = useState(0)
  const [wordVisible, setWordVisible] = useState(false)
  const [hapticUsed, setHapticUsed] = useState(false)

  const startTsRef = useRef<number | null>(null)
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wordHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedRef = useRef(false)
  const sessionRef = useRef<{ session_id: string } | null>(null)
  const wordCountRef = useRef(0)

  const resetLocalState = useCallback(() => {
    setSession(null)
    setError(null)
    setElapsedSec(0)
    setWordIndex(0)
    setWordVisible(false)
    setHapticUsed(false)
    startTsRef.current = null
    completedRef.current = false
    sessionRef.current = null
    wordCountRef.current = 0
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    if (wordIntervalRef.current) clearInterval(wordIntervalRef.current)
    if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current)
    if (wordHideTimerRef.current) clearTimeout(wordHideTimerRef.current)
    tickIntervalRef.current = null
    wordIntervalRef.current = null
    hapticIntervalRef.current = null
    wordHideTimerRef.current = null
  }, [])

  const sendComplete = useCallback(
    async (outcome: 'completed' | 'interrupted', durationSec: number) => {
      const sid = sessionRef.current?.session_id
      if (!sid) return null
      try {
        const resp = await fetch('/api/boucle-urgence/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sid,
            outcome,
            duration_sec: Math.max(0, Math.round(durationSec)),
            haptic_used: hapticUsed,
            words_shown: wordCountRef.current,
          }),
        })
        if (!resp.ok) return null
        return (await resp.json().catch(() => null)) as {
          ok: true
          stats: { total: number; today_count: number; current_streak_days: number }
        } | null
      } catch {
        return null
      }
    },
    [hapticUsed]
  )

  const handleClose = useCallback(
    async (outcome: 'completed' | 'interrupted') => {
      if (completedRef.current) {
        onComplete()
        return
      }
      completedRef.current = true
      const durationSec = startTsRef.current ? (performance.now() - startTsRef.current) / 1000 : 0
      const result = await sendComplete(outcome, durationSec)
      if (outcome === 'completed') {
        const todayCount = result?.stats?.today_count ?? 0
        toast.success(
          todayCount > 1
            ? `Camouflage terminé. ${todayCount}× aujourd'hui — tu as tenu.`
            : "Camouflage terminé. Personne n'a remarqué — bien joué.",
          { duration: 3000 }
        )
      } else {
        toast('Boucle levée — reviens quand tu veux.', { duration: 2500 })
      }
      onComplete()
    },
    [onComplete, sendComplete]
  )

  // Démarrer la session quand l'overlay s'ouvre
  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => resetLocalState())
      return
    }
    let aborted = false
    ;(async () => {
      try {
        const resp = await fetch('/api/boucle-urgence/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: triggerSource ?? 'page',
            duration_sec: targetDurationSec,
          }),
        })
        if (aborted) return
        if (!resp.ok) {
          const { error: errMsg } = await resp.json().catch(() => ({ error: null }))
          setError(errMsg ?? 'Impossible de démarrer — réessaie.')
          return
        }
        const data = (await resp.json()) as { session_id: string }
        sessionRef.current = { session_id: data.session_id }
        setSession(data)
        startTsRef.current = performance.now()
        setHapticUsed(true)
        vibrate(BOUCLE_URGENCE_HAPTIC_PATTERN as number[])
      } catch {
        if (!aborted) setError('Connexion perdue — réessaie.')
      }
    })()
    return () => {
      aborted = true
    }
  }, [isOpen, triggerSource, targetDurationSec, resetLocalState])

  // Tick secondes + auto-complete
  useEffect(() => {
    if (!isOpen || !session || error) return
    tickIntervalRef.current = setInterval(() => {
      if (startTsRef.current === null) return
      const s = (performance.now() - startTsRef.current) / 1000
      setElapsedSec(s)
      if (s >= targetDurationSec) {
        void handleClose('completed')
      }
    }, 250)
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
      tickIntervalRef.current = null
    }
  }, [isOpen, session, error, targetDurationSec, handleClose])

  // Rotation mots flottants
  useEffect(() => {
    if (!isOpen || !session || error) return
    wordCountRef.current = 1
    queueMicrotask(() => {
      setWordIndex(0)
      setWordVisible(true)
    })
    wordHideTimerRef.current = setTimeout(() => setWordVisible(false), BOUCLE_URGENCE_WORD_VISIBLE_MS)
    let localIndex = 1
    wordIntervalRef.current = setInterval(() => {
      setWordIndex(localIndex)
      setWordVisible(true)
      wordCountRef.current += 1
      if (wordHideTimerRef.current) clearTimeout(wordHideTimerRef.current)
      wordHideTimerRef.current = setTimeout(() => setWordVisible(false), BOUCLE_URGENCE_WORD_VISIBLE_MS)
      localIndex += 1
    }, BOUCLE_URGENCE_WORD_INTERVAL_MS)
    return () => {
      if (wordIntervalRef.current) clearInterval(wordIntervalRef.current)
      if (wordHideTimerRef.current) clearTimeout(wordHideTimerRef.current)
      wordIntervalRef.current = null
      wordHideTimerRef.current = null
    }
  }, [isOpen, session, error])

  // Haptic loop (toutes 6s)
  useEffect(() => {
    if (!isOpen || !session || error) return
    hapticIntervalRef.current = setInterval(() => {
      vibrate(BOUCLE_URGENCE_HAPTIC_PATTERN as number[])
    }, BOUCLE_URGENCE_HAPTIC_INTERVAL_MS)
    return () => {
      if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current)
      hapticIntervalRef.current = null
    }
  }, [isOpen, session, error])

  // Esc → interrupted
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        void handleClose('interrupted')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, handleClose])

  return {
    session,
    error,
    elapsedSec,
    wordIndex,
    wordVisible,
    handleClose,
  }
}
