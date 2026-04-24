'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Loader2 } from 'lucide-react'
import type { AidantLien } from '@/lib/constants'

const LIENS: { value: AidantLien; label: string }[] = [
  { value: 'parent', label: 'Parent' },
  { value: 'conjoint', label: 'Conjoint·e' },
  { value: 'enfant', label: 'Enfant' },
  { value: 'ami', label: 'Ami·e proche' },
  { value: 'soignant', label: 'Soignant·e' },
  { value: 'autre', label: 'Autre lien' },
]

interface Props {
  initialLien?: AidantLien | null
  initialSituation?: string | null
  initialEnergy?: number | null
}

export function AidantOnboarding({ initialLien = null, initialSituation = null, initialEnergy = 50 }: Props) {
  const router = useRouter()
  const [lien, setLien] = useState<AidantLien | ''>(initialLien ?? '')
  const [situation, setSituation] = useState(initialSituation ?? '')
  const [energy, setEnergy] = useState(initialEnergy ?? 50)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!lien) {
      setErr('Choisis ton lien avec la personne accompagnée.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/accompagnants/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lien_avec_malade: lien, situation, energy_level: energy }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }))
        setErr(j.error ?? 'Une erreur est survenue.')
        return
      }
      setOk(true)
      router.refresh()
    } catch {
      setErr('Réseau interrompu. Réessaie dans un souffle.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={save}
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
      aria-labelledby="aidant-onboarding-title"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 p-3">
          <Heart className="h-5 w-5 text-pink-400" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h2 id="aidant-onboarding-title" className="text-lg font-semibold text-white">
            Qui accompagnes-tu ?
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Cet espace t'appartient. Tes réponses restent privées — elles nous aident à te proposer les bons appuis.
          </p>
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
          Ton lien
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {LIENS.map(l => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLien(l.value)}
              aria-pressed={lien === l.value}
              data-testid={`aidant-lien-${l.value}`}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                lien === l.value
                  ? 'border-pink-400/60 bg-pink-400/10 text-white'
                  : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/30 hover:text-white'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-6 block">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
          Ta situation (optionnel)
        </span>
        <textarea
          value={situation}
          onChange={e => setSituation(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="En quelques mots, ce que tu traverses en ce moment…"
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
          aria-label="Décris ta situation"
        />
      </label>

      <label className="mt-6 block">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
          Ton énergie aujourd'hui — {energy}/100
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={energy}
          onChange={e => setEnergy(parseInt(e.target.value, 10))}
          className="mt-3 w-full accent-pink-400"
          aria-label="Ton niveau d'énergie"
          data-testid="aidant-energy-slider"
        />
      </label>

      {err && (
        <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {err}
        </p>
      )}
      {ok && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          Enregistré. Ton espace est prêt.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !lien}
        data-testid="aidant-save-btn"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {loading ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}
