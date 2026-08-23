'use client'

// MUKTI — G5.7 Exorcisme Flow orchestrator.
// 5 phases : invocation → revelation → destruction → reprogrammation → scellement.
// State machine simple + track phases_ms + call API start/affirmation/complete.

import { useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ExorcismeCanvas from './ExorcismeCanvas'
import ExorcismeCloseButton from './ExorcismeCloseButton'
import ExorcismeProgressBar from './ExorcismeProgressBar'
import ExorcismePhaseInvocation from './phases/ExorcismePhaseInvocation'
import ExorcismePhaseRevelation from './phases/ExorcismePhaseRevelation'
import ExorcismePhaseDestruction from './phases/ExorcismePhaseDestruction'
import ExorcismePhaseReprogrammation from './phases/ExorcismePhaseReprogrammation'
import ExorcismePhaseScellement from './phases/ExorcismePhaseScellement'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { useExorcismePhase } from './hooks/useExorcismePhase'
import { useExorcismeSession } from './hooks/useExorcismeSession'
import { useExorcismeDestruction } from './hooks/useExorcismeDestruction'
import { useExorcismeSealing } from './hooks/useExorcismeSealing'
import { useExorcismeEscape } from './hooks/useExorcismeEscape'
import { EXORCISME_SHATTER_TAPS } from '@/lib/exorcisme-utils'

export default function ExorcismeFlow() {
  const reducedMotion = usePrefersReducedMotion()
  const phaseData = useExorcismePhase()
  const { phase, goToPhase } = phaseData

  // Refs pour partager l'état entre hooks
  const tapsRef = useRef(0)
  const affirmationFrRef = useRef<string | null>(null)

  const {
    session,
    sessionRef,
    startError,
    possessionDraft,
    setPossessionDraft,
    handleSubmitPossession,
    exitSession,
    closing,
  } = useExorcismeSession(phaseData, tapsRef, affirmationFrRef)

  const {
    taps,
    affirmationFr,
    affirmationLoading,
    affirmationError,
    handleDestructionTap,
  } = useExorcismeDestruction(sessionRef, tapsRef, affirmationFrRef, goToPhase)

  const { sealing, handleSeal } = useExorcismeSealing(exitSession)

  useExorcismeEscape(exitSession)

  const destructionProgress = useMemo(() => {
    if (taps <= 0) return 0
    return Math.min(1, taps / EXORCISME_SHATTER_TAPS)
  }, [taps])

  return (
    <div className="fixed inset-0 z-[40] overflow-hidden bg-[#050308] text-white">
      {!reducedMotion && (
        <ExorcismeCanvas
          phase={phase}
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

      <ExorcismeCloseButton
        onClose={() => void exitSession('interrupted', false)}
        disabled={closing}
      />

      <ExorcismeProgressBar phase={phase} />

      {/* Contenu par phase — centré, glass */}
      <div
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        className="relative z-20 flex h-full flex-col items-center justify-center px-6 py-10"
      >
        <AnimatePresence mode="wait">
          {phase === 'invocation' && <ExorcismePhaseInvocation />}

          {phase === 'revelation' && (
            <ExorcismePhaseRevelation
              possessionDraft={possessionDraft}
              setPossessionDraft={setPossessionDraft}
              startError={startError}
              onSubmit={() => void handleSubmitPossession()}
            />
          )}

          {phase === 'destruction' && session && (
            <ExorcismePhaseDestruction
              session={session}
              taps={taps}
              destructionProgress={destructionProgress}
              onTap={handleDestructionTap}
            />
          )}

          {phase === 'reprogrammation' && (
            <ExorcismePhaseReprogrammation
              affirmationFr={affirmationFr}
              affirmationLoading={affirmationLoading}
              affirmationError={affirmationError}
            />
          )}

          {phase === 'scellement' && (
            <ExorcismePhaseScellement
              sealing={sealing}
              onSeal={handleSeal}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
