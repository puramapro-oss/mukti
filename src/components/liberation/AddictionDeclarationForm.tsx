'use client'

import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { ADDICTION_TYPES } from '@/lib/constants'
import { STEPS } from './addiction-form/types-constants'
import { useAddictionForm } from './addiction-form/useAddictionForm'
import FormStep1Type from './addiction-form/FormStep1Type'
import FormStep2Severity from './addiction-form/FormStep2Severity'
import FormStep3History from './addiction-form/FormStep3History'
import FormStep4Triggers from './addiction-form/FormStep4Triggers'

export default function AddictionDeclarationForm() {
  const {
    step,
    setStep,
    state,
    setState,
    customTrigger,
    setCustomTrigger,
    submitting,
    triggerSuggestions,
    canAdvance,
    toggleTrigger,
    addCustomTrigger,
    handleSubmit,
  } = useAddictionForm()

  const selectedTypeMeta = ADDICTION_TYPES.find(t => t.id === state.type)

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-8" data-testid="addiction-form">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={4}>
        {STEPS.map(s => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all',
                step > s.id
                  ? 'bg-[var(--cyan)] text-[var(--bg-base)]'
                  : step === s.id
                    ? 'bg-gradient-to-br from-[var(--cyan)] to-[var(--purple)] text-white ring-4 ring-[var(--cyan)]/20'
                    : 'bg-white/5 text-[var(--text-muted)]',
              )}
            >
              {step > s.id ? <Check className="h-4 w-4" /> : s.id}
            </div>
            {s.id < 4 && <div className={cn('h-[2px] w-8 rounded-full transition-all', step > s.id ? 'bg-[var(--cyan)]' : 'bg-white/10')} />}
          </div>
        ))}
      </div>

      <h2 className="text-center text-sm font-medium uppercase tracking-widest text-[var(--text-muted)]">
        Étape {step}/4 — {STEPS[step - 1].title}
      </h2>

      <AnimatePresence mode="wait">
        {step === 1 && <FormStep1Type state={state} setState={setState} />}

        {step === 2 && selectedTypeMeta && <FormStep2Severity state={state} setState={setState} />}

        {step === 3 && selectedTypeMeta && <FormStep3History state={state} setState={setState} />}

        {step === 4 && selectedTypeMeta && (
          <FormStep4Triggers
            state={state}
            customTrigger={customTrigger}
            setCustomTrigger={setCustomTrigger}
            triggerSuggestions={triggerSuggestions}
            toggleTrigger={toggleTrigger}
            addCustomTrigger={addCustomTrigger}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1 || submitting}
          icon={<ArrowLeft className="h-4 w-4" />}
          data-testid="form-back"
        >
          Retour
        </Button>

        {step < 4 ? (
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => setStep(s => Math.min(4, s + 1))}
            disabled={!canAdvance}
            data-testid="form-next"
          >
            Continuer <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            data-testid="form-submit"
          >
            Commencer ma libération
          </Button>
        )}
      </div>
    </form>
  )
}
