import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ADDICTION_TYPES } from '@/lib/constants'
import type { FormState, Severity, Goal } from './types-constants'

interface FormStep2SeverityProps {
  state: FormState
  setState: React.Dispatch<React.SetStateAction<FormState>>
}

export default function FormStep2Severity({ state, setState }: FormStep2SeverityProps) {
  const selectedTypeMeta = ADDICTION_TYPES.find(t => t.id === state.type)

  if (!selectedTypeMeta) return null

  return (
    <motion.section
      key="step2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      <div className="text-center">
        <h3 className="text-3xl font-semibold text-[var(--text-primary)]">
          À quel point {selectedTypeMeta.name.toLowerCase()} pèse sur toi ?
        </h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Sois honnête. Aucun jugement. Ton programme sera calibré selon ta réalité.
        </p>
      </div>

      {state.type === 'autre' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="custom-label" className="text-sm text-[var(--text-secondary)]">
            Précise en un mot ou une phrase
          </label>
          <input
            id="custom-label"
            type="text"
            maxLength={80}
            value={state.custom_label}
            onChange={e => setState(prev => ({ ...prev, custom_label: e.target.value }))}
            placeholder="Ex : caféine, vapotage, téléréalité…"
            className="w-full rounded-xl border border-[var(--border)] bg-white/5 px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--cyan)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]/30"
            data-testid="custom-label-input"
          />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Intensité</span>
          <span className="text-3xl font-semibold text-[var(--cyan)]">{state.severity}/5</span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={state.severity}
          onChange={e => setState(prev => ({ ...prev, severity: Number(e.target.value) as Severity }))}
          className="w-full accent-[var(--cyan)]"
          data-testid="severity-slider"
          aria-label="Sévérité de 1 à 5"
        />
        <div className="flex justify-between text-xs text-[var(--text-muted)]">
          <span>Occasionnel</span>
          <span>Modéré</span>
          <span>Envahissant</span>
        </div>
      </div>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="col-span-2 mb-2 text-sm text-[var(--text-secondary)]">Ton objectif</legend>
        {(['stop', 'reduce'] as Goal[]).map(g => (
          <button
            key={g}
            type="button"
            onClick={() => setState(prev => ({ ...prev, goal: g }))}
            className={cn(
              'rounded-2xl border p-4 text-sm font-medium transition-all active:scale-95',
              state.goal === g
                ? 'border-[var(--cyan)] bg-[var(--cyan)]/10 text-[var(--cyan)]'
                : 'border-[var(--border)] bg-white/5 text-[var(--text-secondary)] hover:border-[var(--border-glow)]',
            )}
            data-testid={`goal-${g}`}
            aria-pressed={state.goal === g}
          >
            {g === 'stop' ? '🎯 Arrêt total' : '📉 Réduction progressive'}
          </button>
        ))}
      </fieldset>
    </motion.section>
  )
}
