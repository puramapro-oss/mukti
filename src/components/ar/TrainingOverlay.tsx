'use client'

// MUKTI — G4.6 Training Overlay
// Carte DOM bas écran : titre étape + corps + progress dots + bouton Suivant.
// Sauvegarde auto l'étape via POST /api/ar/training/step à chaque passage.

import { useCallback, useState } from 'react'
import { Check, ChevronRight, Loader2 } from 'lucide-react'
import { AR_TRAINING_STEPS, type ArTrainingMode } from '@/lib/constants'

type StepNum = 1 | 2 | 3 | 4 | 5

interface Props {
  mode: ArTrainingMode
  step: StepNum
  onNext: () => void
  onComplete: () => void
  /** Étapes déjà faites lors de sessions précédentes (pour dots remplis). */
  savedSteps?: number[]
}

export default function TrainingOverlay({ mode, step, onNext, onComplete, savedSteps = [] }: Props) {
  const [savingNext, setSavingNext] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentStepConfig = AR_TRAINING_STEPS[mode].find((s) => s.step === step)

  const handleAdvance = useCallback(async () => {
    setSavingNext(true)
    setError(null)
    try {
      const res = await fetch('/api/ar/training/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, step }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Impossible de sauvegarder ta progression.')
        setSavingNext(false)
        return
      }
      if (step >= 5) {
        onComplete()
      } else {
        onNext()
      }
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setSavingNext(false)
    }
  }, [mode, step, onNext, onComplete])

  if (!currentStepConfig) return null

  return (
    <div
      role="region"
      aria-labelledby="training-title"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6"
      data-testid="training-overlay"
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-white/10 bg-black/65 p-5 shadow-xl backdrop-blur">
        <header className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {mode === 'soin' ? 'Formation · Soin' : 'Formation · Manifestation'}
          </p>
          <div className="flex gap-1.5" aria-label={`Étape ${step} sur 5`}>
            {([1, 2, 3, 4, 5] as StepNum[]).map((s) => {
              const done = savedSteps.includes(s) || s < step
              const current = s === step
              return (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    current ? 'w-6 bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)]' : done ? 'w-3 bg-white/60' : 'w-3 bg-white/15'
                  }`}
                  aria-hidden="true"
                />
              )
            })}
          </div>
        </header>

        <div>
          <h3 id="training-title" className="text-lg font-semibold text-white">
            {currentStepConfig.title_fr}
          </h3>
          <p className="mt-1 text-sm leading-snug text-white/70">{currentStepConfig.body_fr}</p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">
            {step} / 5
          </span>
          <button
            type="button"
            onClick={handleAdvance}
            disabled={savingNext}
            data-testid="training-next"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingNext ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step >= 5 ? (
              <Check className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {step >= 5 ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  )
}
