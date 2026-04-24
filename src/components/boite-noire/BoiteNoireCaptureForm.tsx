'use client'

// MUKTI — G5.8 BoiteNoireCaptureForm
// Form controlled : chips lieu (6) · chips contexte (6) · textarea trigger · slider intensity · toggle résisté.

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Zap, CheckCircle2, XCircle } from 'lucide-react'
import { BOITE_NOIRE_LOCATIONS, BOITE_NOIRE_WHO } from '@/lib/constants'
import type {
  BoiteNoireLocation,
  BoiteNoireWho,
} from '@/lib/constants'

interface Props {
  addictionId: string
  addictionName: string
  onCaptured?: () => void
}

const MIN_TRIGGER = 2
const MAX_TRIGGER = 500
const MAX_EMOTION = 30

export default function BoiteNoireCaptureForm({
  addictionId,
  addictionName,
  onCaptured,
}: Props) {
  const [location, setLocation] = useState<BoiteNoireLocation | null>(null)
  const [who, setWho] = useState<BoiteNoireWho | null>(null)
  const [trigger, setTrigger] = useState('')
  const [emotion, setEmotion] = useState('')
  const [intensity, setIntensity] = useState(5)
  const [resisted, setResisted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const canSubmit = trigger.trim().length >= MIN_TRIGGER && !isPending

  function reset() {
    setLocation(null)
    setWho(null)
    setTrigger('')
    setEmotion('')
    setIntensity(5)
    setResisted(false)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    startTransition(async () => {
      try {
        const resp = await fetch('/api/boite-noire/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            addiction_id: addictionId,
            location_hint: location,
            who_context: who,
            what_trigger: trigger.trim(),
            emotion: emotion.trim() || null,
            intensity,
            resisted,
          }),
        })
        if (!resp.ok) {
          const { error } = await resp.json().catch(() => ({ error: null }))
          toast.error(error ?? 'Impossible d\'enregistrer — réessaie.')
          return
        }
        toast.success(
          resisted
            ? 'Noté. Tu as résisté — c\'est une victoire.'
            : 'Noté. Aucun jugement — c\'est une donnée.',
          { duration: 3500 }
        )
        reset()
        onCaptured?.()
      } catch {
        toast.error('Connexion perdue — réessaie.')
      }
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl sm:p-6"
      data-testid="boite-noire-capture-form"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50">
        <Zap className="h-3.5 w-3.5 text-[#7C3AED]" />
        <span>Capture · {addictionName}</span>
      </div>
      <p className="mt-2 text-sm text-white/60">
        Pas pour te juger. Pour voir ton schéma.
      </p>

      {/* LIEU */}
      <fieldset className="mt-6">
        <legend className="text-xs font-medium uppercase tracking-widest text-white/45">
          Où ?
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {BOITE_NOIRE_LOCATIONS.map(l => {
            const active = location === l.id
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLocation(active ? null : l.id)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  active
                    ? 'border-[#7C3AED]/60 bg-[#7C3AED]/20 text-[#C4B5FD]'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'
                }`}
              >
                <span className="mr-1">{l.emoji}</span>
                {l.name}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* CONTEXTE SOCIAL */}
      <fieldset className="mt-6">
        <legend className="text-xs font-medium uppercase tracking-widest text-white/45">
          Avec qui ?
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {BOITE_NOIRE_WHO.map(w => {
            const active = who === w.id
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setWho(active ? null : w.id)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  active
                    ? 'border-[#7C3AED]/60 bg-[#7C3AED]/20 text-[#C4B5FD]'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'
                }`}
              >
                <span className="mr-1">{w.emoji}</span>
                {w.name}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* DÉCLENCHEUR */}
      <label className="mt-6 block">
        <span className="text-xs font-medium uppercase tracking-widest text-white/45">
          Quoi a déclenché ? <span className="text-rose-400">*</span>
        </span>
        <textarea
          value={trigger}
          onChange={e => setTrigger(e.target.value.slice(0, MAX_TRIGGER))}
          maxLength={MAX_TRIGGER}
          rows={3}
          placeholder="Ex : fin de journée stressante, odeur du bar en passant"
          className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-white/30 focus:border-[#7C3AED]/60 focus:outline-none"
          required
          minLength={MIN_TRIGGER}
        />
        <div className="mt-1 flex justify-end text-[10px] uppercase tracking-widest text-white/35">
          {trigger.length}/{MAX_TRIGGER}
        </div>
      </label>

      {/* ÉMOTION */}
      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-widest text-white/45">
          Émotion (optionnel)
        </span>
        <input
          value={emotion}
          onChange={e => setEmotion(e.target.value.slice(0, MAX_EMOTION))}
          maxLength={MAX_EMOTION}
          placeholder="tristesse, ennui, colère…"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#7C3AED]/60 focus:outline-none"
        />
      </label>

      {/* INTENSITÉ */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-white/45">
            Intensité
          </span>
          <span className="font-mono text-xl text-white">{intensity}</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={intensity}
          onChange={e => setIntensity(Number(e.target.value))}
          className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/[0.06] accent-[#7C3AED]"
          aria-label="Intensité de l'envie"
        />
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-white/35">
          <span>léger</span>
          <span>intense</span>
        </div>
      </div>

      {/* RÉSISTÉ / CÉDÉ */}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setResisted(true)}
          aria-pressed={resisted}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
            resisted
              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
              : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'
          }`}
        >
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          J&apos;ai résisté
        </button>
        <button
          type="button"
          onClick={() => setResisted(false)}
          aria-pressed={!resisted}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
            !resisted
              ? 'border-white/25 bg-white/[0.08] text-white/80'
              : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'
          }`}
        >
          <XCircle className="mr-2 inline h-4 w-4" />
          J&apos;ai cédé
        </button>
      </div>

      {/* SUBMIT */}
      <button
        type="submit"
        disabled={!canSubmit}
        data-testid="boite-noire-submit"
        className="mt-6 w-full rounded-full border border-[#7C3AED]/50 bg-gradient-to-r from-[#7C3AED]/30 to-[#A855F7]/30 px-6 py-3 text-sm font-medium text-white shadow-[0_0_30px_rgba(124,58,237,0.2)] transition-all hover:from-[#7C3AED]/50 hover:to-[#A855F7]/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? 'Enregistrement…' : 'Capturer'}
      </button>
    </form>
  )
}
