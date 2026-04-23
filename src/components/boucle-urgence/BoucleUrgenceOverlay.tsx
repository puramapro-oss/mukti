'use client'

// MUKTI — G5.7 BoucleUrgenceOverlay — mode "invisible en société"
// UI camouflée : fond sobre type page de notes. Mini-cercle respi bas-droite 48px.
// Mots FR qui fade-in/out bas-gauche. Vibrations toutes 6s. Esc = interrupted.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  BOUCLE_URGENCE_HAPTIC_PATTERN,
  BOUCLE_URGENCE_HAPTIC_INTERVAL_MS,
  BOUCLE_URGENCE_BREATH_CYCLE_MS,
  BOUCLE_URGENCE_WORD_INTERVAL_MS,
  BOUCLE_URGENCE_WORD_VISIBLE_MS,
  pickWord,
} from '@/lib/boucle-urgence-utils'
import { useBoucleUrgence } from './BoucleUrgenceProvider'

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      // ignore
    }
  }
}

export default function BoucleUrgenceOverlay() {
  const { isOpen, triggerSource, targetDurationSec, closeBoucle } = useBoucleUrgence()

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
        closeBoucle()
        return
      }
      completedRef.current = true
      const durationSec = startTsRef.current
        ? (performance.now() - startTsRef.current) / 1000
        : 0
      const result = await sendComplete(outcome, durationSec)
      if (outcome === 'completed') {
        const todayCount = result?.stats?.today_count ?? 0
        toast.success(
          todayCount > 1
            ? `Camouflage terminé. ${todayCount}× aujourd'hui — tu as tenu.`
            : 'Camouflage terminé. Personne n\'a remarqué — bien joué.',
          { duration: 3000 }
        )
      } else {
        toast('Boucle levée — reviens quand tu veux.', { duration: 2500 })
      }
      closeBoucle()
    },
    [closeBoucle, sendComplete]
  )

  // Démarrer la session quand l'overlay s'ouvre
  useEffect(() => {
    if (!isOpen) {
      resetLocalState()
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
    // Premier mot tout de suite
    wordCountRef.current = 1
    setWordIndex(0)
    setWordVisible(true)
    wordHideTimerRef.current = setTimeout(
      () => setWordVisible(false),
      BOUCLE_URGENCE_WORD_VISIBLE_MS
    )
    let localIndex = 1
    wordIntervalRef.current = setInterval(() => {
      setWordIndex(localIndex)
      setWordVisible(true)
      wordCountRef.current += 1
      if (wordHideTimerRef.current) clearTimeout(wordHideTimerRef.current)
      wordHideTimerRef.current = setTimeout(
        () => setWordVisible(false),
        BOUCLE_URGENCE_WORD_VISIBLE_MS
      )
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

  const remainingSec = Math.max(0, Math.ceil(targetDurationSec - elapsedSec))
  const progressPct = Math.min(100, (elapsedSec / targetDurationSec) * 100)
  const currentWord = pickWord(wordIndex)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="boucle-urgence-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[55] overflow-hidden bg-[#0F1419] text-slate-200"
        >
          {/* Fond camouflé — gradient subtil gris/cyan (ressemble à une page de notes) */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#0E1A1F] to-[#0B1519]"
          />

          {/* Grille discrète façon carnet */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '100% 28px',
            }}
          />

          {error ? (
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-sm text-rose-300/80">{error}</p>
              <button
                type="button"
                onClick={() => void handleClose('interrupted')}
                className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-sm text-white/80 hover:bg-white/[0.08]"
              >
                Fermer
              </button>
            </div>
          ) : !session ? (
            <div className="relative z-10 flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-white/40">
                <div className="h-6 w-6 animate-pulse rounded-full bg-[#06B6D4]/30" />
                <p className="text-[11px] uppercase tracking-[0.25em]">Activation…</p>
              </div>
            </div>
          ) : (
            <>
              {/* Faux titre de notes (camouflage visuel pour un coup d'œil latéral) */}
              <header className="relative z-10 flex items-start justify-between px-6 pt-8 sm:px-10">
                <div>
                  <p
                    id="boucle-urgence-title"
                    className="font-serif text-sm tracking-wide text-white/50"
                  >
                    Notes · {new Date().toLocaleDateString('fr-FR')}
                  </p>
                  <h1 className="mt-1 font-serif text-lg text-white/70">Pensées calmes</h1>
                </div>
                <button
                  type="button"
                  onClick={() => void handleClose('interrupted')}
                  className="text-[11px] uppercase tracking-[0.22em] text-white/35 hover:text-white/70"
                  aria-label="Fermer la boucle urgence"
                >
                  Fermer
                </button>
              </header>

              {/* Contenu faux-notes (camouflage) */}
              <div className="relative z-10 mx-auto max-w-md px-6 pt-10 font-serif text-[15px] leading-8 text-white/35 sm:px-10 sm:text-base">
                <p>— observer sans réagir.</p>
                <p>— laisser l&apos;onde monter puis redescendre.</p>
                <p>— revenir à l&apos;instant présent.</p>
                <p className="opacity-60">
                  {remainingSec}s · rester posé·e, rien à faire.
                </p>
              </div>

              {/* Progress bar ultra-fine en haut (très discret) */}
              <div
                aria-hidden
                className="absolute left-0 right-0 top-0 h-[2px] bg-white/[0.03]"
              >
                <div
                  className="h-full bg-gradient-to-r from-[#06B6D4]/60 to-[#0891B2]/40 transition-[width]"
                  style={{ width: `${progressPct}%`, transitionDuration: '240ms' }}
                />
              </div>

              {/* Mot flottant — bas-gauche */}
              <div
                aria-live="polite"
                className="pointer-events-none absolute bottom-28 left-6 z-10 font-serif text-xl italic text-white/70 transition-opacity duration-700 sm:left-10 sm:text-2xl"
                style={{ opacity: wordVisible ? 1 : 0 }}
              >
                {currentWord}
              </div>

              {/* Mini-cercle respi — bas-droite 48px (discret) */}
              <div
                aria-hidden
                className="absolute bottom-8 right-6 z-10 flex h-12 w-12 items-center justify-center sm:right-10"
              >
                <div className="relative h-12 w-12">
                  <div
                    className="absolute inset-0 rounded-full bg-[#06B6D4]/15 blur-md motion-safe:animate-[boucle-breath_7s_ease-in-out_infinite] motion-reduce:hidden"
                  />
                  <div
                    className="absolute inset-2 rounded-full border border-[#06B6D4]/40 motion-safe:animate-[boucle-breath_7s_ease-in-out_infinite]"
                  />
                </div>
              </div>

              {/* Keyframes injection */}
              <style jsx global>{`
                @keyframes boucle-breath {
                  0%,
                  100% {
                    transform: scale(0.9);
                    opacity: 0.65;
                  }
                  50% {
                    transform: scale(1.1);
                    opacity: 1;
                  }
                }
              `}</style>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
