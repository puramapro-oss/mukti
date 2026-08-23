'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ADDICTION_TYPES, type AddictionId } from '@/lib/constants'
import type { FormState } from './types-constants'

interface Props {
  state: FormState
  setState: React.Dispatch<React.SetStateAction<FormState>>
}

export default function AddictionFormStep1({ state, setState }: Props) {
  return (
    <motion.section
      key="step1"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      <div className="text-center">
        <h3 className="text-3xl font-semibold text-[var(--text-primary)]">Quelle libération t&apos;appelle ?</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Choisis celle qui résonne le plus fort aujourd&apos;hui. Tu pourras en ajouter d&apos;autres plus tard (3 max actives).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ADDICTION_TYPES.map(t => {
          const selected = state.type === t.id
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`addiction-type-${t.id}`}
              onClick={() => setState(prev => ({ ...prev, type: t.id as AddictionId, triggers: [] }))}
              className={cn(
                'group relative flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-all active:scale-95',
                selected
                  ? 'border-[var(--cyan)] bg-gradient-to-br from-[var(--cyan)]/20 to-[var(--purple)]/20 shadow-[0_0_30px_rgba(0,212,255,0.25)]'
                  : 'border-[var(--border)] bg-white/5 hover:border-[var(--border-glow)] hover:bg-white/10',
              )}
              aria-pressed={selected}
            >
              <span className="text-3xl" aria-hidden>
                {t.icon}
              </span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{t.name}</span>
              {selected && (
                <motion.div
                  layoutId="selected-ring"
                  className="absolute inset-0 rounded-2xl ring-2 ring-[var(--cyan)]/60"
                />
              )}
            </button>
          )
        })}
      </div>
    </motion.section>
  )
}
