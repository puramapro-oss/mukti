'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Users, Clock, Radio, Calendar, CircleCheck, Loader2 } from 'lucide-react'
import {
  CIRCLE_CATEGORIES,
  CIRCLE_GUIDANCE_MODES,
  CIRCLE_ROTATION_MODES,
  CIRCLE_DURATION_PRESETS_SEC,
  CIRCLE_MESH_MAX_PARTICIPANTS,
  type CircleCategoryId,
  type CircleGuidanceMode,
  type CircleRotationMode,
} from '@/lib/constants'

interface Phrase {
  id: string
  text_fr: string
  text_en: string
  weight: number
}

interface WizardProps {
  initialCategory?: CircleCategoryId
}

type Step = 1 | 2 | 3 | 4 | 5

const PARTICIPANT_PRESETS = [2, 4, 6, 8, 20, 50, 100, 500]

export default function CircleCreateWizard({ initialCategory }: WizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(initialCategory ? 2 : 1)
  const [category, setCategory] = useState<CircleCategoryId | null>(initialCategory ?? null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(8)
  const [customParticipants, setCustomParticipants] = useState('')
  const [duration, setDuration] = useState<number>(300)
  const [rotationMode, setRotationMode] = useState<CircleRotationMode>('auto')
  const [guidanceMode, setGuidanceMode] = useState<CircleGuidanceMode>('voice')
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [phrasesLoading, setPhrasesLoading] = useState(false)
  const [selectedPhraseIds, setSelectedPhraseIds] = useState<string[]>([])
  const [startMode, setStartMode] = useState<'now' | 'scheduled'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Charge les phrases quand catégorie change
  useEffect(() => {
    if (!category) return
    setPhrasesLoading(true)
    fetch(`/api/intention-phrases?category=${category}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPhrases(d.phrases as Phrase[])
      })
      .catch(() => {})
      .finally(() => setPhrasesLoading(false))
  }, [category])

  // Reset sélection si catégorie change
  useEffect(() => {
    setSelectedPhraseIds([])
  }, [category])

  const selectedCat = useMemo(() => CIRCLE_CATEGORIES.find((c) => c.id === category), [category])
  const audioMode = maxParticipants > CIRCLE_MESH_MAX_PARTICIPANTS ? 'sfu' : 'mesh'

  const canGoNext: Record<Step, boolean> = {
    1: !!category,
    2: title.trim().length >= 3 && maxParticipants >= 2,
    3: true,
    4: startMode === 'now' || (startMode === 'scheduled' && scheduledAt.length >= 10),
    5: true,
  }

  async function handleSubmit() {
    if (!category || submitting) return
    setSubmitting(true)
    setError(null)

    let scheduledIso: string | null = null
    if (startMode === 'scheduled' && scheduledAt) {
      const d = new Date(scheduledAt)
      if (!isNaN(d.getTime())) scheduledIso = d.toISOString()
    }

    try {
      const res = await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim(),
          description: description.trim() || undefined,
          max_participants: maxParticipants,
          duration_per_person_sec: duration,
          rotation_mode: rotationMode,
          guidance_mode: guidanceMode,
          selected_phrase_ids: selectedPhraseIds,
          scheduled_at: scheduledIso,
          auto_start_when_full: startMode === 'now',
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Création impossible.')
        setSubmitting(false)
        return
      }

      router.push(`/dashboard/cercles/${category}?new=${json.circle.id}`)
      router.refresh()
    } catch {
      setError('Erreur réseau. Réessaie.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {/* Stepper */}
      <div className="flex items-center justify-between" aria-label="Étapes de création">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="flex flex-1 items-center">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                step === n
                  ? 'bg-gradient-to-br from-[var(--cyan)] to-[var(--purple)] text-white'
                  : step > n
                    ? 'bg-[var(--cyan)]/20 text-[var(--cyan)]'
                    : 'bg-white/5 text-white/40'
              }`}
            >
              {step > n ? <Check className="h-4 w-4" /> : n}
            </div>
            {n < 5 && (
              <div
                className={`h-0.5 flex-1 transition-colors ${step > n ? 'bg-[var(--cyan)]/30' : 'bg-white/5'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Steps content */}
      <div className="min-h-[420px] rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6">
        {step === 1 && (
          <Step1
            selected={category}
            onSelect={(id) => {
              setCategory(id)
              setTimeout(() => setStep(2), 200)
            }}
          />
        )}
        {step === 2 && (
          <Step2
            title={title}
            description={description}
            maxParticipants={maxParticipants}
            customParticipants={customParticipants}
            duration={duration}
            rotationMode={rotationMode}
            audioMode={audioMode}
            onChangeTitle={setTitle}
            onChangeDescription={setDescription}
            onChangeMax={(v) => {
              setMaxParticipants(v)
              setCustomParticipants('')
            }}
            onChangeCustom={(v) => {
              const n = parseInt(v, 10)
              setCustomParticipants(v)
              if (!isNaN(n) && n >= 2 && n <= 5000) setMaxParticipants(n)
            }}
            onChangeDuration={setDuration}
            onChangeRotation={setRotationMode}
          />
        )}
        {step === 3 && (
          <Step3
            guidanceMode={guidanceMode}
            phrases={phrases}
            phrasesLoading={phrasesLoading}
            selectedPhraseIds={selectedPhraseIds}
            onChangeGuidance={setGuidanceMode}
            onTogglePhrase={(id) =>
              setSelectedPhraseIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
          />
        )}
        {step === 4 && (
          <Step4
            startMode={startMode}
            scheduledAt={scheduledAt}
            onChangeStartMode={setStartMode}
            onChangeScheduled={setScheduledAt}
          />
        )}
        {step === 5 && selectedCat && (
          <Step5
            category={selectedCat}
            title={title}
            description={description}
            maxParticipants={maxParticipants}
            duration={duration}
            rotationMode={rotationMode}
            guidanceMode={guidanceMode}
            selectedPhraseIds={selectedPhraseIds}
            phrases={phrases}
            startMode={startMode}
            scheduledAt={scheduledAt}
            audioMode={audioMode}
          />
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((Math.max(1, step - 1)) as Step)}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          data-testid="wizard-prev"
        >
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        {step < 5 ? (
          <button
            type="button"
            disabled={!canGoNext[step]}
            onClick={() => setStep((Math.min(5, step + 1)) as Step)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="wizard-next"
          >
            Continuer <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="wizard-submit"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}
            {submitting ? 'Création...' : 'Ouvrir le cercle'}
          </button>
        )}
      </div>
    </div>
  )
}

// ========== STEP 1 ==========
function Step1({ selected, onSelect }: { selected: CircleCategoryId | null; onSelect: (id: CircleCategoryId) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Quelle intention veux-tu rayonner ?</h2>
        <p className="mt-1 text-sm text-white/55">Le cœur du cercle — choisis la fréquence.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {CIRCLE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            data-testid={`wizard-cat-${c.id}`}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
              selected === c.id
                ? 'border-white/30 bg-white/[0.08]'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
            }`}
            style={selected === c.id ? { boxShadow: `0 0 0 1px ${c.color}80` } : undefined}
          >
            <span className="text-2xl" aria-hidden>{c.emoji}</span>
            <span className="text-[11px] font-medium text-white/85">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ========== STEP 2 ==========
function Step2(props: {
  title: string
  description: string
  maxParticipants: number
  customParticipants: string
  duration: number
  rotationMode: CircleRotationMode
  audioMode: 'mesh' | 'sfu'
  onChangeTitle: (v: string) => void
  onChangeDescription: (v: string) => void
  onChangeMax: (v: number) => void
  onChangeCustom: (v: string) => void
  onChangeDuration: (v: number) => void
  onChangeRotation: (v: CircleRotationMode) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Les paramètres du cercle</h2>
        <p className="mt-1 text-sm text-white/55">Taille, durée par personne, rotation.</p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium uppercase tracking-wider text-white/60" htmlFor="circle-title">
          Titre du cercle
        </label>
        <input
          id="circle-title"
          type="text"
          maxLength={120}
          value={props.title}
          onChange={(e) => props.onChangeTitle(e.target.value)}
          placeholder="Ex. Soir doux pour les âmes fatiguées"
          data-testid="wizard-title"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--cyan)]/60 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium uppercase tracking-wider text-white/60" htmlFor="circle-desc">
          Description <span className="text-white/30">(optionnel)</span>
        </label>
        <textarea
          id="circle-desc"
          maxLength={600}
          rows={3}
          value={props.description}
          onChange={(e) => props.onChangeDescription(e.target.value)}
          placeholder="Quelques mots pour donner envie de rejoindre…"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--cyan)]/60 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/60">
          <Users className="h-3.5 w-3.5" /> Participants max
        </label>
        <div className="flex flex-wrap gap-2">
          {PARTICIPANT_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => props.onChangeMax(n)}
              className={`rounded-xl border px-3 py-1.5 text-xs transition-all ${
                props.maxParticipants === n && !props.customParticipants
                  ? 'border-[var(--cyan)]/60 bg-[var(--cyan)]/10 text-[var(--cyan)]'
                  : 'border-white/10 text-white/60 hover:bg-white/5'
              }`}
            >
              {n}
            </button>
          ))}
          <input
            type="number"
            min={2}
            max={5000}
            value={props.customParticipants}
            onChange={(e) => props.onChangeCustom(e.target.value)}
            placeholder="Custom…"
            className="w-24 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[var(--cyan)]/60 focus:outline-none"
          />
        </div>
        <p className="text-[11px] text-white/40">
          Audio {props.audioMode === 'mesh' ? 'direct peer-to-peer (≤ 8 personnes)' : 'serveur relais scalable (> 8 personnes)'}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/60">
          <Clock className="h-3.5 w-3.5" /> Durée par personne
        </label>
        <div className="flex flex-wrap gap-2">
          {CIRCLE_DURATION_PRESETS_SEC.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => props.onChangeDuration(sec)}
              className={`rounded-xl border px-3 py-1.5 text-xs transition-all ${
                props.duration === sec
                  ? 'border-[var(--purple)]/60 bg-[var(--purple)]/10 text-[var(--purple)]'
                  : 'border-white/10 text-white/60 hover:bg-white/5'
              }`}
            >
              {sec / 60} min
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium uppercase tracking-wider text-white/60">Mode de rotation</label>
        <div className="grid grid-cols-3 gap-2">
          {CIRCLE_ROTATION_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => props.onChangeRotation(m.id as CircleRotationMode)}
              className={`rounded-xl border p-3 text-left text-xs transition-all ${
                props.rotationMode === m.id
                  ? 'border-white/30 bg-white/[0.06]'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <p className="font-medium text-white/90">{m.name}</p>
              <p className="mt-0.5 text-[11px] text-white/45">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ========== STEP 3 ==========
function Step3(props: {
  guidanceMode: CircleGuidanceMode
  phrases: Phrase[]
  phrasesLoading: boolean
  selectedPhraseIds: string[]
  onChangeGuidance: (m: CircleGuidanceMode) => void
  onTogglePhrase: (id: string) => void
}) {
  const needsPhrases = props.guidanceMode === 'voice' || props.guidanceMode === 'mental' || props.guidanceMode === 'light'
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Le mode de guidage</h2>
        <p className="mt-1 text-sm text-white/55">Comment vous allez vous synchroniser.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CIRCLE_GUIDANCE_MODES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => props.onChangeGuidance(g.id as CircleGuidanceMode)}
            data-testid={`wizard-guidance-${g.id}`}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
              props.guidanceMode === g.id
                ? 'border-white/30 bg-white/[0.06]'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            <span className="text-lg">{g.emoji}</span>
            <div>
              <p className="text-xs font-medium text-white/90">{g.name}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-white/40">{g.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {needsPhrases && (
        <div className="flex flex-col gap-3 border-t border-white/5 pt-5">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/60">
              <Radio className="h-3.5 w-3.5" /> Phrases conscientes
            </p>
            <p className="mt-1 text-[11px] text-white/40">
              Choisis 3 à 10 phrases qui seront affichées pendant la rotation. Si aucune choisie, une sélection aléatoire sera faite.
            </p>
          </div>

          {props.phrasesLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement des phrases…
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {props.phrases.map((p) => {
                const on = props.selectedPhraseIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => props.onTogglePhrase(p.id)}
                    data-testid={`phrase-${p.id}`}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      on
                        ? 'border-[var(--cyan)]/40 bg-[var(--cyan)]/10'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        on ? 'border-[var(--cyan)] bg-[var(--cyan)]' : 'border-white/20'
                      }`}
                    >
                      {on && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="text-sm text-white/85">« {p.text_fr} »</span>
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-[11px] text-white/40">
            {props.selectedPhraseIds.length} phrase{props.selectedPhraseIds.length > 1 ? 's' : ''} sélectionnée{props.selectedPhraseIds.length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

// ========== STEP 4 ==========
function Step4(props: {
  startMode: 'now' | 'scheduled'
  scheduledAt: string
  onChangeStartMode: (m: 'now' | 'scheduled') => void
  onChangeScheduled: (v: string) => void
}) {
  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 10)
  const minIso = minDate.toISOString().slice(0, 16)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Quand ouvrir le cercle ?</h2>
        <p className="mt-1 text-sm text-white/55">Maintenant ou à une heure précise.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => props.onChangeStartMode('now')}
          data-testid="start-now"
          className={`flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-all ${
            props.startMode === 'now'
              ? 'border-[var(--cyan)]/50 bg-[var(--cyan)]/10'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
        >
          <span className="text-2xl">⚡</span>
          <p className="font-medium text-white">Maintenant</p>
          <p className="text-xs text-white/55">Le cercle s&apos;ouvre immédiatement. Il démarre auto dès que c&apos;est complet.</p>
        </button>
        <button
          type="button"
          onClick={() => props.onChangeStartMode('scheduled')}
          data-testid="start-scheduled"
          className={`flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-all ${
            props.startMode === 'scheduled'
              ? 'border-[var(--purple)]/50 bg-[var(--purple)]/10'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
        >
          <span className="text-2xl">🕰️</span>
          <p className="font-medium text-white">Programmer</p>
          <p className="text-xs text-white/55">Date et heure précises. Les participants reçoivent un rappel 10 minutes avant.</p>
        </button>
      </div>

      {props.startMode === 'scheduled' && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/60" htmlFor="scheduled-at">
            <Calendar className="h-3.5 w-3.5" /> Date et heure
          </label>
          <input
            id="scheduled-at"
            type="datetime-local"
            min={minIso}
            value={props.scheduledAt}
            onChange={(e) => props.onChangeScheduled(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white focus:border-[var(--purple)]/60 focus:outline-none"
            data-testid="scheduled-input"
          />
          <p className="text-[11px] text-white/40">
            Fuseau local : {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </div>
      )}
    </div>
  )
}

// ========== STEP 5 — Récap ==========
function Step5(props: {
  category: (typeof CIRCLE_CATEGORIES)[number]
  title: string
  description: string
  maxParticipants: number
  duration: number
  rotationMode: CircleRotationMode
  guidanceMode: CircleGuidanceMode
  selectedPhraseIds: string[]
  phrases: Phrase[]
  startMode: 'now' | 'scheduled'
  scheduledAt: string
  audioMode: 'mesh' | 'sfu'
}) {
  const guidance = CIRCLE_GUIDANCE_MODES.find((g) => g.id === props.guidanceMode)
  const rotation = CIRCLE_ROTATION_MODES.find((r) => r.id === props.rotationMode)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Prêt à ouvrir ?</h2>
        <p className="mt-1 text-sm text-white/55">Vérifie les détails avant de créer le cercle.</p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ backgroundColor: `${props.category.color}25` }}
        >
          {props.category.emoji}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wider text-white/50">{props.category.name}</p>
          <p className="text-base font-medium text-white">{props.title}</p>
          {props.description && <p className="mt-0.5 text-xs text-white/50 line-clamp-2">{props.description}</p>}
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <RecapItem label="Participants max" value={`${props.maxParticipants}`} />
        <RecapItem label="Durée / personne" value={`${props.duration / 60} min`} />
        <RecapItem label="Rotation" value={rotation?.name ?? props.rotationMode} />
        <RecapItem label="Guidage" value={guidance?.name ?? props.guidanceMode} />
        <RecapItem label="Audio" value={props.audioMode === 'mesh' ? 'Direct (mesh)' : 'Relais (SFU)'} />
        <RecapItem
          label="Ouverture"
          value={
            props.startMode === 'now'
              ? 'Immédiate'
              : new Date(props.scheduledAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
          }
        />
      </dl>

      {props.selectedPhraseIds.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">
            Phrases sélectionnées ({props.selectedPhraseIds.length})
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-white/70">
            {props.selectedPhraseIds.slice(0, 4).map((id) => {
              const p = props.phrases.find((x) => x.id === id)
              if (!p) return null
              return <li key={id}>« {p.text_fr} »</li>
            })}
            {props.selectedPhraseIds.length > 4 && (
              <li className="text-white/40">… et {props.selectedPhraseIds.length - 4} autre{props.selectedPhraseIds.length - 4 > 1 ? 's' : ''}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function RecapItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <dt className="text-[11px] uppercase tracking-wider text-white/45">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-white/90">{value}</dd>
    </div>
  )
}
