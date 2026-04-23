'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  RefreshCw,
  Wind,
  AlertTriangle,
  Flag,
  Leaf,
  Waves,
} from 'lucide-react'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import { PROGRAM_REGEN_COOLDOWN_DAYS } from '@/lib/constants'
import type { StoredProgram } from '@/lib/programs'

interface Props {
  addictionId: string
  currentProgram: StoredProgram | null
  canRegenerate: boolean
  nextRegenAt: string | null
}

type Phase = 'idle' | 'initializing' | 'streaming' | 'persisting' | 'done' | 'error'

interface SSEDone {
  program_id: string
  version: number
  summary: {
    phases: number
    micro_meditations: number
    affirmations: number
    plants: number
    anti_pulsion_actions: number
    hypnose_scripts: number
  }
  intention: string
}

export default function ProgramView({ addictionId, currentProgram, canRegenerate, nextRegenAt }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [phase, setPhase] = useState<Phase>('idle')
  const [chars, setChars] = useState(0)
  const [outputTokens, setOutputTokens] = useState(0)
  const [status, setStatus] = useState<string>('')

  const startGeneration = async () => {
    setPhase('initializing')
    setStatus('Connexion à Opus 4.7…')
    setChars(0)
    setOutputTokens(0)

    try {
      const res = await fetch('/api/program/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addiction_id: addictionId }),
      })

      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(errJson?.error ?? 'Impossible de lancer la génération.')
        setPhase('error')
        return
      }

      if (!res.body) {
        toast.error('Stream non disponible — réessaie.')
        setPhase('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          if (!chunk.trim()) continue
          const lines = chunk.split('\n')
          const eventLine = lines.find(l => l.startsWith('event:'))
          const dataLine = lines.find(l => l.startsWith('data:'))
          if (!eventLine || !dataLine) continue

          const eventName = eventLine.slice(6).trim()
          const dataStr = dataLine.slice(5).trim()
          let data: unknown
          try {
            data = JSON.parse(dataStr)
          } catch {
            continue
          }

          if (eventName === 'status' && data && typeof data === 'object') {
            const d = data as { phase?: string; message?: string }
            if (d.phase === 'initializing' || d.phase === 'streaming' || d.phase === 'persisting') {
              setPhase(d.phase)
            }
            if (d.message) setStatus(d.message)
          } else if (eventName === 'progress' && data && typeof data === 'object') {
            const d = data as { chars?: number }
            if (typeof d.chars === 'number') setChars(d.chars)
          } else if (eventName === 'usage' && data && typeof data === 'object') {
            const d = data as { output_tokens?: number }
            if (typeof d.output_tokens === 'number') setOutputTokens(d.output_tokens)
          } else if (eventName === 'done') {
            const d = data as SSEDone
            setPhase('done')
            toast.success(`Programme v${d.version} généré — ${d.summary.micro_meditations} micro-méditations, ${d.summary.affirmations} affirmations.`, { duration: 6000 })
            startTransition(() => router.refresh())
          } else if (eventName === 'error' && data && typeof data === 'object') {
            const d = data as { message?: string }
            toast.error(d.message ?? 'Erreur pendant la génération.')
            setPhase('error')
          }
        }
      }
    } catch {
      toast.error('Connexion perdue pendant la génération — réessaie.')
      setPhase('error')
    }
  }

  const isGenerating = phase === 'initializing' || phase === 'streaming' || phase === 'persisting'

  if (!currentProgram) {
    return (
      <section className="flex flex-col items-center gap-6 rounded-3xl border border-[var(--border)] bg-white/5 p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--cyan)]/30 to-[var(--purple)]/30 text-4xl">
          ✨
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-[var(--text-primary)]">Ton programme personnalisé arrive</h3>
          <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
            Claude Opus 4.7 compose un accompagnement 90 jours sur mesure : 3 phases, micro-méditations,
            rituels quotidiens, affirmations, déclencheurs et plantes informatives. ~60-90 secondes.
          </p>
        </div>

        {isGenerating ? (
          <GeneratingCard phase={phase} status={status} chars={chars} outputTokens={outputTokens} />
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={startGeneration}
            icon={<Sparkles className="h-4 w-4" />}
            data-testid="generate-program"
          >
            Générer mon programme 90 jours
          </Button>
        )}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-6" data-testid="program-view">
      <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cyan)]">
            Programme v{currentProgram.version}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{currentProgram.intention}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          {canRegenerate ? (
            isGenerating ? (
              <GeneratingCard phase={phase} status={status} chars={chars} outputTokens={outputTokens} compact />
            ) : (
              <Button
                variant="secondary"
                onClick={startGeneration}
                icon={<RefreshCw className="h-4 w-4" />}
                data-testid="regenerate-program"
              >
                Régénérer
              </Button>
            )
          ) : (
            <p className="max-w-xs text-right text-xs text-[var(--text-muted)]">
              Prochaine régénération disponible{' '}
              {nextRegenAt
                ? `le ${new Date(nextRegenAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
                : `dans ${PROGRAM_REGEN_COOLDOWN_DAYS} jours`}
              .
            </p>
          )}
        </div>
      </header>

      {/* Phases 3 */}
      <div className="grid gap-4 md:grid-cols-3">
        {currentProgram.phases.map((p, i) => (
          <div
            key={p.days_range}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white/5 p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Phase {i + 1}</span>
              <span className="text-xs text-[var(--cyan)]">J{p.days_range}</span>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{p.name}</h3>
            <p className="text-sm text-[var(--text-secondary)]">{p.intent}</p>
            {p.daily_rituals.length > 0 && (
              <ul className="flex flex-col gap-1.5 pt-2 text-xs text-[var(--text-secondary)]">
                {p.daily_rituals.slice(0, 3).map(r => (
                  <li key={r.title} className="flex items-start gap-2">
                    <span aria-hidden>•</span>
                    <span>
                      <strong className="text-[var(--text-primary)]">{r.title}</strong> — {r.duration_sec}s
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Affirmations & micro-méditations */}
      <div className="grid gap-4 md:grid-cols-2">
        <CollapsibleSection
          title="Affirmations libératrices"
          icon={<Sparkles className="h-4 w-4 text-[var(--purple)]" />}
          count={currentProgram.affirmations.length}
        >
          <ul className="flex flex-col gap-2">
            {currentProgram.affirmations.slice(0, 8).map((a, i) => (
              <li
                key={i}
                className="rounded-xl border border-[var(--purple)]/20 bg-[var(--purple)]/5 p-3 text-sm text-[var(--text-primary)]"
              >
                « {a} »
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        <CollapsibleSection
          title="Micro-méditations"
          icon={<Wind className="h-4 w-4 text-[var(--cyan)]" />}
          count={currentProgram.micro_meditations.length}
        >
          <ul className="flex flex-col gap-2">
            {currentProgram.micro_meditations.slice(0, 6).map((m, i) => (
              <li
                key={i}
                className="flex flex-col gap-1 rounded-xl border border-[var(--cyan)]/20 bg-[var(--cyan)]/5 p-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--cyan)]">{m.title}</span>
                  <span className="text-[var(--text-muted)]">
                    {m.trigger} · {m.duration_sec}s
                  </span>
                </div>
                <p className="text-sm text-[var(--text-primary)]">{m.script}</p>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      </div>

      {/* Actions anti-pulsion + déclencheurs */}
      <div className="grid gap-4 md:grid-cols-2">
        <CollapsibleSection
          title="Actions anti-pulsion"
          icon={<Waves className="h-4 w-4 text-[var(--accent,#10B981)]" />}
          count={currentProgram.anti_pulsion_actions.length}
        >
          <ul className="flex flex-col gap-2">
            {currentProgram.anti_pulsion_actions.slice(0, 6).map((a, i) => (
              <li key={i} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm">
                <p className="text-[var(--text-muted)]">{a.situation}</p>
                <p className="mt-1 text-[var(--text-primary)]">→ {a.action}</p>
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        <CollapsibleSection
          title="Déclencheurs à risque"
          icon={<AlertTriangle className="h-4 w-4 text-[var(--gold,#F59E0B)]" />}
          count={currentProgram.risk_triggers.length}
        >
          <ul className="flex flex-wrap gap-2">
            {currentProgram.risk_triggers.map((r, i) => (
              <span
                key={i}
                className="rounded-full border border-[var(--gold,#F59E0B)]/30 bg-[var(--gold,#F59E0B)]/5 px-3 py-1 text-xs text-[var(--gold,#F59E0B)]"
              >
                {r}
              </span>
            ))}
          </ul>
        </CollapsibleSection>
      </div>

      {currentProgram.plants_info.length > 0 && (
        <CollapsibleSection
          title="Plantes informatives"
          icon={<Leaf className="h-4 w-4 text-[var(--accent,#10B981)]" />}
          count={currentProgram.plants_info.length}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {currentProgram.plants_info.map((p, i) => (
              <div key={i} className="rounded-xl border border-[var(--border)] bg-white/5 p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{p.name}</p>
                {p.latin_name && <p className="text-xs italic text-[var(--text-muted)]">{p.latin_name}</p>}
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{p.benefits}</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">⚠ {p.disclaimer}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {currentProgram.success_markers.length > 0 && (
        <CollapsibleSection
          title="Marqueurs de succès"
          icon={<Flag className="h-4 w-4 text-[var(--cyan)]" />}
          count={currentProgram.success_markers.length}
        >
          <ul className="flex flex-col gap-2">
            {currentProgram.success_markers.map((s, i) => (
              <li key={i} className="text-sm text-[var(--text-secondary)]">
                ✓ {s}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      <div className="rounded-2xl border border-[var(--purple)]/20 bg-[var(--purple)]/5 p-4 text-sm text-[var(--text-secondary)]">
        <p className="font-medium text-[var(--purple,#c4a9ff)]">🌀 En cas de détresse</p>
        <p className="mt-1">{currentProgram.emergency_message}</p>
      </div>
    </section>
  )
}

function CollapsibleSection({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/5 p-5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="mb-3 flex w-full items-center justify-between gap-3"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          {icon} {title}
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-[var(--text-muted)]">{count}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GeneratingCard({
  phase,
  status,
  chars,
  outputTokens,
  compact,
}: {
  phase: Phase
  status: string
  chars: number
  outputTokens: number
  compact?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border border-[var(--cyan)]/30 bg-gradient-to-br from-[var(--cyan)]/10 to-[var(--purple)]/10 ${
        compact ? 'w-full max-w-xs p-4' : 'w-full max-w-sm p-6'
      }`}
      data-testid="generating-card"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"
      >
        <Sparkles className="h-5 w-5 text-[var(--cyan)]" />
      </motion.div>
      <p className="text-center text-sm font-medium text-[var(--text-primary)]">{status}</p>
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span>
          <strong className="text-[var(--cyan)]">{chars.toLocaleString('fr-FR')}</strong> caractères
        </span>
        <span className="text-white/20">·</span>
        <span>
          <strong className="text-[var(--purple)]">{outputTokens.toLocaleString('fr-FR')}</strong> tokens
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
        {phase === 'persisting' ? 'sauvegarde' : phase === 'streaming' ? 'composition' : 'préparation'}
      </p>
    </div>
  )
}
