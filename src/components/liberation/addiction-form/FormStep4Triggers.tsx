import { motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { FormState } from './types-constants'

interface FormStep4TriggersProps {
  state: FormState
  customTrigger: string
  setCustomTrigger: (value: string) => void
  triggerSuggestions: readonly string[]
  toggleTrigger: (value: string) => void
  addCustomTrigger: () => void
}

export default function FormStep4Triggers({
  state,
  customTrigger,
  setCustomTrigger,
  triggerSuggestions,
  toggleTrigger,
  addCustomTrigger,
}: FormStep4TriggersProps) {
  return (
    <motion.section
      key="step4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      <div className="text-center">
        <h3 className="text-3xl font-semibold text-[var(--text-primary)]">Tes déclencheurs</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Sélectionne ceux qui te parlent — ou ajoute les tiens. Tu peux en choisir jusqu&apos;à 10.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {triggerSuggestions.map(t => {
          const selected = state.triggers.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTrigger(t)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm transition-all active:scale-95',
                selected
                  ? 'border-[var(--cyan)] bg-[var(--cyan)]/15 text-[var(--cyan)]'
                  : 'border-[var(--border)] bg-white/5 text-[var(--text-secondary)] hover:border-[var(--border-glow)]',
              )}
              data-testid={`trigger-${t}`}
              aria-pressed={selected}
            >
              {t}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          maxLength={40}
          value={customTrigger}
          onChange={e => setCustomTrigger(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustomTrigger()
            }
          }}
          placeholder="Ajouter un déclencheur personnel…"
          className="flex-1 rounded-xl border border-[var(--border)] bg-white/5 px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--cyan)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]/30"
          data-testid="custom-trigger-input"
        />
        <Button type="button" variant="secondary" onClick={addCustomTrigger} disabled={!customTrigger.trim()}>
          Ajouter
        </Button>
      </div>

      {state.triggers.length > 0 && (
        <div className="rounded-2xl border border-[var(--cyan)]/20 bg-[var(--cyan)]/5 p-4">
          <p className="mb-2 text-xs uppercase tracking-widest text-[var(--text-muted)]">
            {state.triggers.length} / 10 déclencheurs
          </p>
          <div className="flex flex-wrap gap-2">
            {state.triggers.map(t => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--cyan)]/10 px-3 py-1 text-sm text-[var(--cyan)]"
              >
                {t}
                <button
                  type="button"
                  onClick={() => toggleTrigger(t)}
                  className="rounded-full p-0.5 transition-colors hover:bg-white/10"
                  aria-label={`Retirer ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--purple)]/20 bg-[var(--purple)]/5 p-4 text-sm text-[var(--text-secondary)]">
        <p className="font-medium text-[var(--purple-light,#c4a9ff)]">
          <Sparkles className="mr-1 inline h-4 w-4" /> Ton programme 90 jours arrive
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          MUKTI génère un accompagnement entièrement personnalisé avec Claude Opus 4.7 — 3 phases, micro-méditations,
          déclencheurs, affirmations, rituels quotidiens. Spiritualité + neurosciences. Jamais médical.
        </p>
      </div>
    </motion.section>
  )
}
