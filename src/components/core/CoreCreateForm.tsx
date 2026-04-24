'use client'

// MUKTI — CoreCreateForm : wizard 1-step community-led event creation.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CORE_FORMATS,
  CORE_CATEGORIES,
  CORE_PROTOCOLS_CATALOG,
  type CoreFormat,
  type CoreCategory,
  type CoreProtocolId,
} from '@/lib/constants'

export default function CoreCreateForm() {
  const [format, setFormat] = useState<CoreFormat>('human')
  const [category, setCategory] = useState<CoreCategory>('collective_healing')
  const [severity, setSeverity] = useState(3)
  const [titleFr, setTitleFr] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [intentionFr, setIntentionFr] = useState('')
  const [intentionEn, setIntentionEn] = useState('')
  const [region, setRegion] = useState('')
  const [momentZ, setMomentZ] = useState(defaultMomentZ())
  const [protocolId, setProtocolId] = useState<CoreProtocolId>('coherence_10min')

  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (titleFr.trim().length < 4 || intentionFr.trim().length < 3) {
      toast.error('Titre et intention sont requis.')
      return
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/core/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format,
            category,
            severity,
            title_fr: titleFr.trim(),
            title_en: (titleEn.trim() || titleFr.trim()),
            intention_fr: intentionFr.trim(),
            intention_en: (intentionEn.trim() || intentionFr.trim()).toUpperCase(),
            region: region.trim() || null,
            moment_z_at: new Date(momentZ).toISOString(),
            ar_protocol_id: protocolId,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? 'Création impossible.')
          return
        }
        toast.success('Événement créé — il est visible dans C.O.R.E.')
        router.push(`/dashboard/core/${json.event.id}`)
      } catch {
        toast.error('Connexion interrompue.')
      }
    })
  }

  return (
    <form
      onSubmit={submit}
      data-testid="core-create-form"
      className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
    >
      <div>
        <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
          Format
        </label>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CORE_FORMATS.map(f => (
            <button
              type="button"
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${
                format === f.id
                  ? 'border-[#7c3aed] bg-[#7c3aed]/10 text-white'
                  : 'border-white/10 bg-white/[0.02] text-white/75 hover:border-white/25'
              }`}
            >
              <span className="mr-2 text-base">{f.emoji}</span>
              {f.name}
              <div className="mt-1 text-[11px] text-white/50">{f.tagline_fr}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
          Catégorie
        </label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as CoreCategory)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#7c3aed]"
        >
          {CORE_CATEGORIES.map(c => (
            <option key={c.id} value={c.id} className="bg-[#0A0A0F]">
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            Titre FR (4-140c)
          </label>
          <input
            type="text"
            maxLength={140}
            value={titleFr}
            onChange={e => setTitleFr(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#7c3aed]"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            Title EN (optionnel)
          </label>
          <input
            type="text"
            maxLength={140}
            value={titleEn}
            onChange={e => setTitleEn(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#7c3aed]"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            Intention FR (UN mot)
          </label>
          <input
            type="text"
            maxLength={80}
            value={intentionFr}
            onChange={e => setIntentionFr(e.target.value)}
            placeholder="APAISEMENT"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#7c3aed]"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            Intention EN
          </label>
          <input
            type="text"
            maxLength={80}
            value={intentionEn}
            onChange={e => setIntentionEn(e.target.value)}
            placeholder="CALM"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#7c3aed]"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            Région (optionnel)
          </label>
          <input
            type="text"
            maxLength={120}
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="France, Pacifique, mondial..."
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#7c3aed]"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            Moment Z
          </label>
          <input
            type="datetime-local"
            value={momentZ}
            onChange={e => setMomentZ(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#7c3aed]"
            required
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
          Gravité : {severity}/5
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={severity}
          onChange={e => setSeverity(Number(e.target.value))}
          className="mt-2 w-full accent-[#7c3aed]"
        />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
          Protocole AR
        </label>
        <select
          value={protocolId}
          onChange={e => setProtocolId(e.target.value as CoreProtocolId)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#7c3aed]"
        >
          {CORE_PROTOCOLS_CATALOG.map(p => (
            <option key={p.id} value={p.id} className="bg-[#0A0A0F]">
              {p.emoji} {p.id.replace(/_/g, ' ')} · {p.duration_sec / 60} min · {p.variant}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        data-testid="core-create-submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#06b6d4] px-6 py-3 text-sm font-medium text-white shadow-[0_8px_40px_-12px_rgba(124,58,237,0.6)] transition-shadow hover:shadow-[0_8px_40px_-6px_rgba(124,58,237,0.8)] disabled:opacity-50"
      >
        {pending ? 'Création…' : 'Créer l\'événement'}
      </button>
    </form>
  )
}

function defaultMomentZ(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000)
  d.setMinutes(0, 0, 0)
  return d.toISOString().slice(0, 16)
}
