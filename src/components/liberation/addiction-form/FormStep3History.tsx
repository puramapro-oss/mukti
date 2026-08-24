import { motion } from 'framer-motion'
import type { FormState } from './types-constants'

interface FormStep3HistoryProps {
  state: FormState
  setState: React.Dispatch<React.SetStateAction<FormState>>
}

export default function FormStep3History({ state, setState }: FormStep3HistoryProps) {
  return (
    <motion.section
      key="step3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      <div className="text-center">
        <h3 className="text-3xl font-semibold text-[var(--text-primary)]">Ton histoire</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Ces infos sont optionnelles. Elles aident MUKTI à affiner ton programme.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="freq" className="text-sm text-[var(--text-secondary)]">
          Fréquence par jour
          <span className="ml-1 text-[var(--text-muted)]">(optionnel)</span>
        </label>
        <input
          id="freq"
          type="number"
          min={0}
          max={100}
          value={state.frequency_daily}
          onChange={e =>
            setState(prev => ({
              ...prev,
              frequency_daily: e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value))),
            }))
          }
          placeholder="Ex : 10"
          className="w-full rounded-xl border border-[var(--border)] bg-white/5 px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--cyan)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]/30"
          data-testid="frequency-input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="months" className="text-sm text-[var(--text-secondary)]">
          Depuis combien de mois ?
          <span className="ml-1 text-[var(--text-muted)]">(optionnel)</span>
        </label>
        <input
          id="months"
          type="number"
          min={0}
          max={600}
          value={state.started_ago_months}
          onChange={e =>
            setState(prev => ({
              ...prev,
              started_ago_months:
                e.target.value === '' ? '' : Math.max(0, Math.min(600, Number(e.target.value))),
            }))
          }
          placeholder="Ex : 36"
          className="w-full rounded-xl border border-[var(--border)] bg-white/5 px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--cyan)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]/30"
          data-testid="months-input"
        />
      </div>
    </motion.section>
  )
}
