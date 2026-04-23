'use client'

import { useState, useMemo, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { ADDICTION_TYPES, type AddictionId } from '@/lib/constants'

type Severity = 1 | 2 | 3 | 4 | 5
type Goal = 'reduce' | 'stop'

interface FormState {
  type: AddictionId | null
  severity: Severity
  frequency_daily: number | ''
  started_ago_months: number | ''
  goal: Goal
  custom_label: string
  triggers: string[]
}

const TRIGGERS_BY_TYPE: Record<AddictionId, string[]> = {
  tabac: ['Stress', 'Café', 'Après repas', 'Alcool', 'Soirée', 'Pause boulot', 'Téléphone', 'Conduite'],
  alcool: ['Stress', 'Apéro', 'Soirée', 'Seul(e)', 'Week-end', 'Repas', 'Anxiété', 'Évènements sociaux'],
  sucre: ['Émotionnel', 'Fatigue', 'Stress', 'Ennui', 'Après repas', 'Soirée', 'Publicité', 'TV'],
  drogue: ['Soirée', 'Stress', 'Entourage', 'Musique', 'Week-end', 'Solitude', 'Déception', 'Excitation'],
  ecran: ['Ennui', 'Anxiété', 'Attente', 'Soirée', 'Au réveil', 'Transports', 'Au lit', 'Solitude'],
  jeux: ['Solitude', 'Stress', 'Ennui', 'Adrénaline', 'Week-end', 'Évasion', 'Frustration'],
  reseaux_sociaux: ['Ennui', 'Comparaison', 'FOMO', 'Attente', 'Notification', 'Au réveil', 'Au lit'],
  pornographie: ['Solitude', 'Stress', 'Fatigue', 'Nuit', 'Ennui', 'Anxiété', 'Frustration'],
  achats: ['Pub', 'Mauvaise journée', 'Stress', 'Réconfort', 'Promos', 'Scroll', 'Week-end'],
  nourriture: ['Émotionnel', 'Stress', 'Ennui', 'Soirée', 'Fatigue', 'Solitude', 'Récompense'],
  codependance: ['Besoin validation', 'Peur solitude', 'Insécurité', 'Relation instable', 'Comparaison'],
  travail: ['Pression', 'Peur échec', 'Perfectionnisme', 'Burnout', 'Validation', 'Dopamine projet'],
  autre: ['Stress', 'Solitude', 'Fatigue', 'Ennui', 'Émotionnel', 'Évasion'],
}

const INITIAL_STATE: FormState = {
  type: null,
  severity: 3,
  frequency_daily: '',
  started_ago_months: '',
  goal: 'stop',
  custom_label: '',
  triggers: [],
}

const STEPS = [
  { id: 1, title: 'Ton défi' },
  { id: 2, title: 'Intensité' },
  { id: 3, title: 'Histoire' },
  { id: 4, title: 'Déclencheurs' },
] as const

export default function AddictionDeclarationForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [state, setState] = useState<FormState>(INITIAL_STATE)
  const [customTrigger, setCustomTrigger] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedTypeMeta = useMemo(() => ADDICTION_TYPES.find(t => t.id === state.type), [state.type])
  const triggerSuggestions = useMemo(
    () => (state.type ? TRIGGERS_BY_TYPE[state.type] : []),
    [state.type],
  )

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        return state.type !== null
      case 2:
        return state.severity >= 1 && state.severity <= 5 && (state.type !== 'autre' || state.custom_label.trim().length >= 2)
      case 3:
        return true
      case 4:
        return true
      default:
        return false
    }
  }, [step, state])

  const toggleTrigger = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setState(prev => ({
      ...prev,
      triggers: prev.triggers.includes(trimmed)
        ? prev.triggers.filter(t => t !== trimmed)
        : prev.triggers.length >= 10
          ? prev.triggers
          : [...prev.triggers, trimmed],
    }))
  }

  const addCustomTrigger = () => {
    const trimmed = customTrigger.trim()
    if (!trimmed) return
    if (state.triggers.includes(trimmed)) {
      setCustomTrigger('')
      return
    }
    if (state.triggers.length >= 10) {
      toast.error('10 déclencheurs maximum — tu pourras affiner plus tard.')
      return
    }
    setState(prev => ({ ...prev, triggers: [...prev.triggers, trimmed] }))
    setCustomTrigger('')
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!state.type || submitting) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/addictions/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: state.type,
          severity: state.severity,
          frequency_daily: state.frequency_daily === '' ? undefined : state.frequency_daily,
          started_ago_months: state.started_ago_months === '' ? undefined : state.started_ago_months,
          triggers: state.triggers,
          goal: state.goal,
          custom_label: state.type === 'autre' ? state.custom_label.trim() : undefined,
        }),
      })

      const json = (await res.json().catch(() => null)) as { error?: string; addiction?: { id: string }; message?: string } | null

      if (!res.ok || !json?.addiction) {
        toast.error(json?.error ?? 'Impossible de déclarer ta libération. Réessaie.')
        setSubmitting(false)
        return
      }

      toast.success(json.message ?? 'Ta libération commence maintenant. 🌱')
      router.push(`/dashboard/liberation?new=${json.addiction.id}`)
      router.refresh()
    } catch {
      toast.error('Erreur réseau — vérifie ta connexion.')
      setSubmitting(false)
    }
  }

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
        {/* STEP 1 : type */}
        {step === 1 && (
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
        )}

        {/* STEP 2 : severity */}
        {step === 2 && selectedTypeMeta && (
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
        )}

        {/* STEP 3 : history */}
        {step === 3 && selectedTypeMeta && (
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
        )}

        {/* STEP 4 : triggers */}
        {step === 4 && selectedTypeMeta && (
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
