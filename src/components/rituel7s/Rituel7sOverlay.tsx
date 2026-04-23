'use client'

// MUKTI — G5.6 Rituel 7 Secondes Overlay
// Plein écran au-dessus du reste. Timer RAF précis (pas de drift).
// Phases fixes : STOP 0-1s / INSPIRE 1-3s / SUSPENDS 3-4s / EXPIRE 4-7s.
// Respecte prefers-reduced-motion. Esc/bouton ✕ → interrupted.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import {
  RITUEL_7S_PHASES,
  RITUEL_7S_TOTAL_MS,
  type Rituel7sPhase,
} from '@/lib/rituel-7s-utils'
import { useRituel7s } from './Rituel7sProvider'

function findPhase(elapsedMs: number): Rituel7sPhase {
  for (const p of RITUEL_7S_PHASES) {
    if (elapsedMs >= p.start_ms && elapsedMs < p.end_ms) return p
  }
  return RITUEL_7S_PHASES[RITUEL_7S_PHASES.length - 1]!
}

function phaseScale(phase: Rituel7sPhase, elapsedMs: number): number {
  // Cercle respire : 0.85 → 1.55 pendant INSPIRE, stable pendant SUSPENDS, 1.55 → 0.75 pendant EXPIRE
  const t = (elapsedMs - phase.start_ms) / (phase.end_ms - phase.start_ms)
  const clamped = Math.max(0, Math.min(1, t))
  switch (phase.name) {
    case 'stop':
      return 0.85 + clamped * 0.02
    case 'inspire':
      return 0.87 + clamped * 0.68 // → 1.55
    case 'suspend':
      return 1.55 - Math.abs(clamped - 0.5) * 0.05 // micro-pulse
    case 'expire':
      return 1.55 - clamped * 0.8 // → 0.75
  }
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      // ignore
    }
  }
}

export default function Rituel7sOverlay() {
  const { isOpen, triggerSource, closeRituel } = useRituel7s()
  const [session, setSession] = useState<{
    session_id: string
    affirmation_text: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [currentPhase, setCurrentPhase] = useState<Rituel7sPhase>(RITUEL_7S_PHASES[0]!)

  const rafRef = useRef<number | null>(null)
  const startTsRef = useRef<number | null>(null)
  const lastPhaseNameRef = useRef<string>('')
  const completedRef = useRef(false)
  const sessionRef = useRef<{ session_id: string } | null>(null)

  // Reset refs au passage d'ouverture
  const resetLocalState = useCallback(() => {
    setSession(null)
    setError(null)
    setElapsedMs(0)
    setCurrentPhase(RITUEL_7S_PHASES[0]!)
    startTsRef.current = null
    lastPhaseNameRef.current = ''
    completedRef.current = false
    sessionRef.current = null
  }, [])

  const sendComplete = useCallback(
    async (outcome: 'completed' | 'interrupted', durationSec: number) => {
      const sid = sessionRef.current?.session_id
      if (!sid) return null
      try {
        const resp = await fetch('/api/rituel-7s/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sid,
            outcome,
            duration_sec: Math.min(15, Math.max(0, Math.round(durationSec))),
            haptic_used: true,
          }),
        })
        if (!resp.ok) return null
        const json = (await resp.json().catch(() => null)) as
          | { ok: true; streak: { current_days: number; today_count: number } }
          | null
        return json
      } catch {
        return null
      }
    },
    []
  )

  const handleClose = useCallback(
    async (outcome: 'completed' | 'interrupted') => {
      if (completedRef.current) {
        closeRituel()
        return
      }
      completedRef.current = true
      const durationSec = startTsRef.current
        ? (performance.now() - startTsRef.current) / 1000
        : 0
      const result = await sendComplete(outcome, durationSec)
      if (outcome === 'completed') {
        const streakDays = result?.streak?.current_days ?? 0
        const todayCount = result?.streak?.today_count ?? 1
        vibrate([40, 30, 40, 30, 80])
        toast.success(
          streakDays > 0
            ? `Fait. Streak : J${streakDays}. ⚡${todayCount > 1 ? ` (${todayCount}× aujourd'hui)` : ''}`
            : `Fait. Belle pause. ⚡`,
          { duration: 3000 }
        )
      } else {
        toast('Interrompu — pas de jugement, reviens quand tu veux.', { duration: 2500 })
      }
      closeRituel()
    },
    [closeRituel, sendComplete]
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
        const resp = await fetch('/api/rituel-7s/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: triggerSource ?? 'button' }),
        })
        if (aborted) return
        if (!resp.ok) {
          const { error: errMsg } = await resp.json().catch(() => ({ error: null }))
          setError(errMsg ?? 'Impossible de démarrer — réessaie.')
          return
        }
        const data = (await resp.json()) as {
          session_id: string
          affirmation_text: string
        }
        sessionRef.current = { session_id: data.session_id }
        setSession(data)
        startTsRef.current = performance.now()
        vibrate(25) // tap STOP
      } catch {
        if (!aborted) setError('Connexion perdue — réessaie.')
      }
    })()
    return () => {
      aborted = true
    }
  }, [isOpen, triggerSource, resetLocalState])

  // RAF loop — mise à jour elapsedMs + phase
  useEffect(() => {
    if (!isOpen || !session || error) return

    function tick(now: number) {
      if (startTsRef.current === null) startTsRef.current = now
      const elapsed = now - startTsRef.current
      const clamped = Math.min(elapsed, RITUEL_7S_TOTAL_MS)
      setElapsedMs(clamped)

      const phase = findPhase(clamped)
      if (phase.name !== lastPhaseNameRef.current) {
        lastPhaseNameRef.current = phase.name
        setCurrentPhase(phase)
        // Haptics aux transitions de phase
        if (phase.name === 'inspire') vibrate([10, 40, 10])
        else if (phase.name === 'expire') vibrate([20, 30, 20, 30, 20])
      }

      if (elapsed >= RITUEL_7S_TOTAL_MS) {
        // Fin naturelle → completed
        void handleClose('completed')
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isOpen, session, error, handleClose])

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

  const progressPct = Math.min(100, (elapsedMs / RITUEL_7S_TOTAL_MS) * 100)
  const remainingSec = Math.max(0, Math.ceil((RITUEL_7S_TOTAL_MS - elapsedMs) / 1000))
  const scale = phaseScale(currentPhase, elapsedMs)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rituel7s-phase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0A0A0F]/95 backdrop-blur-xl"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => void handleClose('interrupted')}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 backdrop-blur transition-colors hover:text-white sm:right-8 sm:top-8"
            aria-label="Fermer le rituel"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Progress bar fine en haut */}
          <div aria-hidden className="absolute left-0 right-0 top-0 h-1 bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-[#F59E0B] to-[#F97316] transition-[width]"
              style={{ width: `${progressPct}%`, transitionDuration: '80ms' }}
            />
          </div>

          {error ? (
            <div className="max-w-sm text-center px-6">
              <p className="text-sm text-rose-300">{error}</p>
              <button
                type="button"
                onClick={() => void handleClose('interrupted')}
                className="mt-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white hover:bg-white/[0.08]"
              >
                Fermer
              </button>
            </div>
          ) : !session ? (
            <div className="flex flex-col items-center gap-3 text-white/60">
              <div className="h-10 w-10 animate-pulse rounded-full bg-[#F59E0B]/30" />
              <p className="text-xs uppercase tracking-[0.25em]">Préparation…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-8 px-6">
              <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                {remainingSec}s
              </div>

              {/* Cercle respiration */}
              <div className="relative flex h-[280px] w-[280px] items-center justify-center sm:h-[360px] sm:w-[360px]">
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-[#F59E0B]/15 blur-3xl motion-safe:transition-transform motion-reduce:hidden"
                  style={{
                    transform: `scale(${scale.toFixed(3)})`,
                    transitionDuration: '80ms',
                  }}
                />
                <div
                  aria-hidden
                  className="absolute h-[200px] w-[200px] rounded-full border border-[#F59E0B]/40 bg-gradient-to-br from-[#F59E0B]/30 to-[#7C3AED]/20 backdrop-blur motion-safe:transition-transform sm:h-[260px] sm:w-[260px]"
                  style={{
                    transform: `scale(${scale.toFixed(3)})`,
                    transitionDuration: '80ms',
                  }}
                />
                <div
                  id="rituel7s-phase"
                  className="relative z-10 text-center"
                >
                  <div className="text-3xl font-light uppercase tracking-[0.3em] text-white sm:text-4xl">
                    {currentPhase.label_fr}
                  </div>
                  <div className="mt-3 text-sm text-white/60 sm:text-base">
                    {currentPhase.hint_fr}
                  </div>
                </div>
              </div>

              {/* Affirmation — s'affiche pendant EXPIRE */}
              <div className="h-10 max-w-md text-center">
                <p
                  className={`text-base font-light text-white/90 transition-opacity duration-500 sm:text-lg ${
                    currentPhase.name === 'expire' ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  « {session.affirmation_text} »
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
