'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, CircleCheck, Loader2 } from 'lucide-react'
import {
  CIRCLE_CATEGORIES,
  CIRCLE_MESH_MAX_PARTICIPANTS,
  type CircleCategoryId,
  type CircleGuidanceMode,
  type CircleRotationMode,
} from '@/lib/constants'
import type { Phrase, Step } from './wizard-steps/types'
import Step1 from './wizard-steps/Step1'
import Step2 from './wizard-steps/Step2'
import Step3 from './wizard-steps/Step3'
import Step4 from './wizard-steps/Step4'
import Step5 from './wizard-steps/Step5'

interface WizardProps {
  initialCategory?: CircleCategoryId
}

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
    queueMicrotask(() => setPhrasesLoading(true))
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
    queueMicrotask(() => setSelectedPhraseIds([]))
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
