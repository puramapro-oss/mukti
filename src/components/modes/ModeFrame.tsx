'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { type ModeId, MODES_G2 } from '@/lib/constants'

interface Props {
  modeId: ModeId
  addictionId: string
  /** Le contenu principal du mode reçoit ces callbacks. */
  children: (ctx: { onCompleted: (outcome?: Outcome) => void }) => ReactNode
  /** Timer optionnel : si fourni, affiche entrée → timer → sortie. */
  durationSec?: number
}

type Stage = 'entry' | 'active' | 'exit'
type Outcome = 'resisted' | 'relapsed' | 'interrupted' | 'completed'

export default function ModeFrame({ modeId, addictionId, children, durationSec }: Props) {
  const router = useRouter()
  const meta = MODES_G2.find(m => m.id === modeId)!
  const startedAtRef = useRef<number>(Date.now())
  const [stage, setStage] = useState<Stage>('entry')
  const [urgeBefore, setUrgeBefore] = useState<number | null>(null)
  const [urgeAfter, setUrgeAfter] = useState<number | null>(null)
  const [outcome, setOutcome] = useState<Outcome>('completed')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Prevent body scroll while mode is active
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const startActive = () => {
    startedAtRef.current = Date.now()
    setStage('active')
  }

  const finishMode = (o?: Outcome) => {
    if (o) setOutcome(o)
    setStage('exit')
  }

  const skipLogAndExit = () => {
    router.back()
  }

  const submitLog = async () => {
    if (submitting) return
    setSubmitting(true)
    const duration = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
    try {
      const res = await fetch('/api/mode-sessions/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: modeId,
          addiction_id: addictionId,
          started_at: new Date(startedAtRef.current).toISOString(),
          completed_at: new Date().toISOString(),
          duration_sec: duration,
          urge_before: urgeBefore ?? undefined,
          urge_after: urgeAfter ?? undefined,
          outcome,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(err?.error ?? 'Log impossible — mais ta session reste valide.')
      } else {
        const delta = urgeBefore !== null && urgeAfter !== null ? urgeBefore - urgeAfter : null
        if (delta !== null && delta > 0) {
          toast.success(`Pulsion réduite de ${delta} points — bravo.`)
        } else {
          toast.success('Session enregistrée.')
        }
      }
    } catch {
      toast.error('Erreur réseau — ta session est gardée localement.')
    } finally {
      router.back()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#05050a]"
      role="dialog"
      aria-modal="true"
      aria-label={`Mode ${meta.name}`}
    >
      <header className="flex items-center justify-between border-b border-white/5 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            {meta.emoji}
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Mode</p>
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">{meta.name}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={stage === 'active' ? () => finishMode('interrupted') : skipLogAndExit}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-[var(--text-secondary)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary)]"
          aria-label="Quitter le mode"
          data-testid="mode-close"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {stage === 'entry' && (
            <motion.div
              key="entry"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex w-full max-w-md flex-col items-center gap-8 text-center"
            >
              <p className="text-sm uppercase tracking-widest text-[var(--text-muted)]">Avant de commencer</p>
              <h2 className="text-3xl font-semibold text-[var(--text-primary)]">
                Où en es-tu de l&apos;envie, là tout de suite&nbsp;?
              </h2>
              <UrgeScale value={urgeBefore} onChange={setUrgeBefore} testIdPrefix="urge-before" />
              <button
                type="button"
                onClick={startActive}
                disabled={urgeBefore === null}
                className="w-full rounded-2xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-6 py-4 text-base font-medium text-white transition-all disabled:opacity-40 enabled:hover:opacity-90"
                data-testid="mode-start"
              >
                Commencer {durationSec ? `(${durationSec}s)` : ''}
              </button>
              <button
                type="button"
                onClick={skipLogAndExit}
                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
              >
                Finalement pas maintenant
              </button>
            </motion.div>
          )}

          {stage === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex w-full flex-1 flex-col items-center justify-center"
            >
              {children({ onCompleted: finishMode })}
            </motion.div>
          )}

          {stage === 'exit' && (
            <motion.div
              key="exit"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex w-full max-w-md flex-col items-center gap-6 text-center"
            >
              <CheckCircle2 className="h-12 w-12 text-[var(--accent,#10B981)]" />
              <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Et maintenant&nbsp;?</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Prends un instant. Comment est l&apos;envie après cette session&nbsp;?
              </p>
              <UrgeScale value={urgeAfter} onChange={setUrgeAfter} testIdPrefix="urge-after" />
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={submitLog}
                  disabled={submitting}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-6 py-3 text-sm font-medium text-white transition-all disabled:opacity-60 enabled:hover:opacity-90"
                  data-testid="mode-submit"
                >
                  {submitting ? 'Enregistrement…' : 'Valider la session'}
                </button>
                <button
                  type="button"
                  onClick={skipLogAndExit}
                  className="flex-1 rounded-2xl border border-[var(--border)] bg-white/5 px-6 py-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-white/10"
                >
                  Sortir sans logger
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

function UrgeScale({
  value,
  onChange,
  testIdPrefix,
}: {
  value: number | null
  onChange: (v: number) => void
  testIdPrefix: string
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-baseline justify-between text-xs text-[var(--text-muted)]">
        <span>Calme</span>
        <span className="text-2xl font-semibold text-[var(--cyan)]">{value ?? '—'}/10</span>
        <span>Intense</span>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label="Intensité de l'envie de 1 à 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(v => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`h-10 flex-1 rounded-md border text-xs transition-all ${
              value === v
                ? 'border-[var(--cyan)] bg-[var(--cyan)]/25 text-[var(--cyan)]'
                : 'border-[var(--border)] bg-white/5 text-[var(--text-muted)] hover:border-[var(--border-glow)]'
            }`}
            data-testid={`${testIdPrefix}-${v}`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}
