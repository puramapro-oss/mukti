'use client'

// MUKTI — G5.7 Exorcisme Flow orchestrator.
// 5 phases : invocation → revelation → destruction → reprogrammation → scellement.
// State machine simple + track phases_ms + call API start/affirmation/complete.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import {
  EXORCISME_PHASES,
  EXORCISME_SHATTER_TAPS,
  EXORCISME_MAX_TEXT_LENGTH,
  sanitizePossessionText,
  type ExorcismePhaseName,
} from '@/lib/exorcisme-utils'
import ExorcismeCanvas from './ExorcismeCanvas'

type PhaseMs = Partial<Record<ExorcismePhaseName, number>>

interface SessionState {
  id: string
  possessionText: string
}

function haptic(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      // ignore
    }
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

export default function ExorcismeFlow() {
  const router = useRouter()
  const reducedMotion = usePrefersReducedMotion()

  const [phase, setPhase] = useState<ExorcismePhaseName>('invocation')
  const [session, setSession] = useState<SessionState | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [possessionDraft, setPossessionDraft] = useState('')
  const [taps, setTaps] = useState(0)
  const [affirmationFr, setAffirmationFr] = useState<string | null>(null)
  const [affirmationLoading, setAffirmationLoading] = useState(false)
  const [affirmationError, setAffirmationError] = useState<string | null>(null)
  const [sealing, setSealing] = useState(false)
  const [closing, setClosing] = useState(false)

  const startTsRef = useRef<number>(performance.now())
  const phaseStartRef = useRef<number>(performance.now())
  const phaseMsRef = useRef<PhaseMs>({})
  const sessionRef = useRef<SessionState | null>(null)
  const completedRef = useRef(false)

  // Phase transition helper — enregistre ms de la phase précédente
  const goToPhase = useCallback((next: ExorcismePhaseName) => {
    const now = performance.now()
    setPhase(prev => {
      phaseMsRef.current[prev] = Math.max(
        0,
        Math.round(now - phaseStartRef.current)
      )
      phaseStartRef.current = now
      return next
    })
  }, [])

  const sendComplete = useCallback(
    async (outcome: 'completed' | 'interrupted', sealed: boolean) => {
      const s = sessionRef.current
      if (!s) return
      const now = performance.now()
      // Close current phase
      phaseMsRef.current[phase] = Math.max(
        0,
        Math.round(now - phaseStartRef.current)
      )
      const durationSec = (now - startTsRef.current) / 1000

      try {
        await fetch('/api/exorcisme/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: s.id,
            outcome,
            duration_sec: Math.min(15 * 60, Math.max(0, Math.round(durationSec))),
            taps_destruction: taps,
            phases_ms: phaseMsRef.current,
            sealed,
            ...(affirmationFr ? { affirmation_used: affirmationFr } : {}),
          }),
        })
      } catch {
        // silencieux — l'UX ne doit pas tomber là-dessus
      }
    },
    [phase, taps, affirmationFr]
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

  // Esc → interrupted à tout moment
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        void exitSession('interrupted', false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exitSession])

  // Phase 1 : INVOCATION — auto-advance après 10s
  useEffect(() => {
    if (phase !== 'invocation') return
    const phaseDur = EXORCISME_PHASES.find(p => p.name === 'invocation')?.duration_ms ?? 10000
    const timer = setTimeout(() => goToPhase('revelation'), phaseDur)
    return () => clearTimeout(timer)
  }, [phase, goToPhase])

  // Phase 4 : REPROGRAMMATION — auto-advance après duration
  useEffect(() => {
    if (phase !== 'reprogrammation') return
    const phaseDur =
      EXORCISME_PHASES.find(p => p.name === 'reprogrammation')?.duration_ms ?? 18000
    const timer = setTimeout(() => goToPhase('scellement'), phaseDur)
    return () => clearTimeout(timer)
  }, [phase, goToPhase])

  // Démarrage session quand l'utilisateur soumet le texte (Révélation)
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
      goToPhase('destruction')
    } catch {
      setStartError('Connexion perdue — réessaie.')
    }
  }, [possessionDraft, goToPhase])

  // Phase 3 : DESTRUCTION — chaque tap compte jusqu'à EXORCISME_SHATTER_TAPS
  const handleDestructionTap = useCallback(() => {
    setTaps(prev => {
      const next = prev + 1
      haptic([30, 60, 90])
      if (next >= EXORCISME_SHATTER_TAPS) {
        // fetch affirmation puis go reprogrammation
        if (sessionRef.current) {
          setAffirmationLoading(true)
          setAffirmationError(null)
          fetch('/api/exorcisme/affirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionRef.current.id,
              possession_text: sessionRef.current.possessionText,
            }),
          })
            .then(async r => {
              if (!r.ok) throw new Error('fetch_failed')
              return (await r.json()) as { affirmation_fr: string; affirmation_en: string }
            })
            .then(data => {
              setAffirmationFr(data.affirmation_fr)
            })
            .catch(() => {
              // Fallback mot générique — UI affiche quelque chose plutôt que rien
              setAffirmationFr('Ce qui me possédait n\'a plus de prise. Je choisis ce qui me nourrit.')
              setAffirmationError('generator_unavailable')
            })
            .finally(() => setAffirmationLoading(false))
        }
        // Petite pause cinématographique avant phase 4
        setTimeout(() => goToPhase('reprogrammation'), 900)
      }
      return next
    })
  }, [goToPhase])

  // Phase 5 : SCELLEMENT tap → flash + exit
  const handleSeal = useCallback(() => {
    setSealing(true)
    haptic([40, 40, 40, 40, 80])
    setTimeout(() => {
      void exitSession('completed', true)
    }, 600)
  }, [exitSession])

  const destructionProgress = useMemo(() => {
    if (taps <= 0) return 0
    return Math.min(1, taps / EXORCISME_SHATTER_TAPS)
  }, [taps])

  const canvasPhase: ExorcismePhaseName = phase

  return (
    <div className="fixed inset-0 z-[40] overflow-hidden bg-[#050308] text-white">
      {!reducedMotion && (
        <ExorcismeCanvas
          phase={canvasPhase}
          destructionProgress={destructionProgress}
          sealing={sealing}
        />
      )}
      {reducedMotion && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#050308] via-[#12091E] to-[#1E1B4B]" />
      )}

      {/* Sealing flash */}
      <AnimatePresence>
        {sealing && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-30 bg-white"
          />
        )}
      </AnimatePresence>

      {/* Close button — toujours accessible */}
      <button
        type="button"
        onClick={() => void exitSession('interrupted', false)}
        disabled={closing}
        className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/70 backdrop-blur transition-colors hover:text-white disabled:opacity-50 sm:right-8 sm:top-8"
        aria-label="Quitter la séance"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Progress bar fine en haut — montre ordre phases */}
      <div aria-hidden className="absolute left-0 right-0 top-0 z-20 h-1 bg-white/[0.04]">
        <div
          className="h-full bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#FFD700] transition-[width]"
          style={{
            width: `${((EXORCISME_PHASES.findIndex(p => p.name === phase) + 1) / EXORCISME_PHASES.length) * 100}%`,
            transitionDuration: '600ms',
          }}
        />
      </div>

      {/* Contenu par phase — centré, glass */}
      <div
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        className="relative z-20 flex h-full flex-col items-center justify-center px-6 py-10"
      >
        <AnimatePresence mode="wait">
          {phase === 'invocation' && (
            <motion.div
              key="invocation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="max-w-xl text-center"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-white/45">Phase 1 · Invocation</p>
              <h2 className="mt-6 text-4xl font-light tracking-tight sm:text-5xl">
                Pose ton téléphone.
              </h2>
              <p className="mt-4 text-lg text-white/70">Prépare-toi. Ça va durer quelques minutes.</p>
            </motion.div>
          )}

          {phase === 'revelation' && (
            <motion.div
              key="revelation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-xl text-center"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-white/45">Phase 2 · Révélation</p>
              <h2 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl">
                Ce qui me possède :
              </h2>

              <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                <textarea
                  value={possessionDraft}
                  onChange={e => setPossessionDraft(e.target.value.slice(0, EXORCISME_MAX_TEXT_LENGTH))}
                  maxLength={EXORCISME_MAX_TEXT_LENGTH}
                  rows={2}
                  placeholder="Ex : la dépendance au sucre après 18h"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-center text-base text-white placeholder:text-white/30 focus:border-[#A855F7]/60 focus:outline-none"
                  aria-label="Ce qui me possède"
                  autoFocus
                />
                <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-widest text-white/40">
                  <span>{possessionDraft.length}/{EXORCISME_MAX_TEXT_LENGTH}</span>
                  <span>Concis, direct.</span>
                </div>
              </div>

              {startError && (
                <p className="mt-3 text-sm text-rose-300/90">{startError}</p>
              )}

              <button
                type="button"
                onClick={() => void handleSubmitPossession()}
                disabled={possessionDraft.trim().length === 0}
                className="mt-6 rounded-full border border-[#A855F7]/50 bg-gradient-to-r from-[#7C3AED]/30 to-[#A855F7]/30 px-8 py-3 text-sm font-medium text-white shadow-[0_0_40px_rgba(168,85,247,0.25)] transition-all hover:from-[#7C3AED]/50 hover:to-[#A855F7]/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Nommer
              </button>
            </motion.div>
          )}

          {phase === 'destruction' && session && (
            <motion.div
              key="destruction"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-2xl text-center"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-white/45">Phase 3 · Destruction</p>
              <p className="mt-3 text-sm text-white/60">
                Frappe {EXORCISME_SHATTER_TAPS} fois pour briser.
              </p>

              <button
                type="button"
                onClick={handleDestructionTap}
                disabled={taps >= EXORCISME_SHATTER_TAPS}
                className="group mt-10 block w-full rounded-3xl border border-rose-500/30 bg-black/40 px-6 py-10 backdrop-blur transition-all hover:border-rose-400/60 hover:bg-rose-900/20 active:scale-95 disabled:opacity-50"
                aria-label="Frapper pour briser"
              >
                <span
                  className={`inline-block font-serif text-2xl font-medium text-white transition-all sm:text-4xl ${
                    taps > 0 ? 'italic' : ''
                  }`}
                  style={{
                    opacity: 1 - destructionProgress * 0.85,
                    transform: `scale(${1 - destructionProgress * 0.4}) rotate(${destructionProgress * 8 - 4}deg)`,
                    filter: `blur(${destructionProgress * 6}px)`,
                  }}
                >
                  « {session.possessionText} »
                </span>
              </button>

              <div className="mt-6 flex items-center justify-center gap-2">
                {Array.from({ length: EXORCISME_SHATTER_TAPS }).map((_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className={`h-2 w-8 rounded-full transition-colors duration-300 ${
                      i < taps ? 'bg-rose-400/80' : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'reprogrammation' && (
            <motion.div
              key="reprogrammation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.7 }}
              className="max-w-2xl text-center"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-white/45">Phase 4 · Reprogrammation</p>

              {affirmationLoading && !affirmationFr && (
                <div className="mt-8 flex flex-col items-center gap-2 text-white/60">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-[#F59E0B]/40" />
                  <p className="text-xs uppercase tracking-[0.25em]">L'affirmation arrive…</p>
                </div>
              )}

              {affirmationFr && (
                <motion.blockquote
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.9 }}
                  className="mt-8 font-serif text-2xl italic text-[#FBBF24] sm:text-3xl"
                >
                  « {affirmationFr} »
                </motion.blockquote>
              )}

              {affirmationError && (
                <p className="mt-4 text-xs text-white/40">
                  Le générateur contextuel est en pause — nous utilisons une formule universelle.
                </p>
              )}

              <p className="mt-8 text-sm text-white/55">
                Lis-la 3 fois en silence. Laisse-la s&apos;installer.
              </p>
            </motion.div>
          )}

          {phase === 'scellement' && (
            <motion.div
              key="scellement"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-xl text-center"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-white/45">Phase 5 · Scellement</p>
              <h2 className="mt-6 text-3xl font-light tracking-tight sm:text-4xl">
                Scelle cette libération.
              </h2>
              <p className="mt-3 text-sm text-white/60">
                Un tap pour sceller. La séance se termine.
              </p>
              <button
                type="button"
                onClick={handleSeal}
                disabled={sealing}
                className="mt-10 rounded-full border border-[#FFD700]/50 bg-gradient-to-r from-[#F59E0B]/30 to-[#FFD700]/30 px-10 py-4 text-base font-medium text-white shadow-[0_0_60px_rgba(255,215,0,0.3)] transition-all hover:from-[#F59E0B]/50 hover:to-[#FFD700]/50 disabled:opacity-50"
              >
                Sceller
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
