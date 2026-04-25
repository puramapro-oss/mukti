'use client'

// MUKTI G8.6 — VIDA ANGEL : gros toggle ON/OFF + slider multiplier 1-5

import { useState, useTransition } from 'react'
import { Heart, AlertCircle, Check } from 'lucide-react'

interface Props {
  initialActive: boolean
  initialMultiplier: number
}

export default function VidaAngelClient({ initialActive, initialMultiplier }: Props) {
  const [active, setActive] = useState(initialActive)
  const [multiplier, setMultiplier] = useState(initialMultiplier)
  const [savedAt, setSavedAt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleActive() {
    const newValue = !active
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/admin/settings/vida_angel_active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Mise à jour impossible.')
        return
      }
      setActive(newValue)
      setSavedAt(Date.now())
    })
  }

  function saveMultiplier() {
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/admin/settings/vida_angel_multiplier', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: multiplier }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Mise à jour impossible.')
        return
      }
      setSavedAt(Date.now())
    })
  }

  const showSaved = savedAt && Date.now() - savedAt < 2500

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div
        className={`relative overflow-hidden rounded-3xl border p-8 transition ${
          active
            ? 'border-rose-400/50 bg-gradient-to-br from-rose-500/30 via-rose-500/10 to-rose-500/0 shadow-2xl shadow-rose-500/20'
            : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-wider text-white/55">État actuel</p>
            <p className={`text-3xl font-semibold ${active ? 'text-rose-100' : 'text-white/85'}`}>
              {active ? 'VIDA ANGEL actif' : 'VIDA ANGEL désactivé'}
            </p>
            <p className="mt-2 max-w-md text-sm text-white/65">
              {active
                ? `Toutes les récompenses utilisateurs sont multipliées ×${multiplier} jusqu'à désactivation manuelle.`
                : 'Les récompenses utilisateurs sont à leur valeur normale.'}
            </p>
          </div>
          <Heart
            className={`h-12 w-12 transition ${active ? 'fill-rose-400 text-rose-400 animate-pulse' : 'text-white/25'}`}
            aria-hidden="true"
          />
        </div>
        <button
          type="button"
          onClick={toggleActive}
          disabled={pending}
          aria-pressed={active}
          className={`mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold transition disabled:opacity-50 ${
            active
              ? 'bg-white/10 text-white hover:bg-white/15'
              : 'bg-rose-500 text-white hover:bg-rose-400'
          }`}
        >
          {pending ? 'Mise à jour…' : active ? 'Désactiver maintenant' : 'Activer maintenant'}
        </button>
        {showSaved ? (
          <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-300">
            <Check className="h-4 w-4" aria-hidden="true" />
            Appliqué en live
          </div>
        ) : null}
      </div>

      <aside className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div>
          <label htmlFor="multiplier" className="block text-sm font-medium text-white">
            Multiplicateur des récompenses
          </label>
          <p className="mt-1 text-xs text-white/55">
            ×{multiplier} appliqué à tous les wallets / points lors des écritures pendant que VIDA ANGEL est actif.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-center">
          <div className="text-4xl font-bold text-rose-200">×{multiplier}</div>
          <input
            id="multiplier"
            type="range"
            min="1"
            max="5"
            step="1"
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
            className="mt-3 w-full accent-rose-400"
            aria-valuemin={1}
            aria-valuemax={5}
            aria-valuenow={multiplier}
          />
          <div className="flex justify-between text-[10px] text-white/45">
            <span>×1</span>
            <span>×2</span>
            <span>×3</span>
            <span>×4</span>
            <span>×5</span>
          </div>
        </div>
        <button
          type="button"
          onClick={saveMultiplier}
          disabled={pending || multiplier === initialMultiplier}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-400 disabled:bg-white/10 disabled:text-white/40"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer le multiplicateur'}
        </button>
        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200" role="alert">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            {error}
          </div>
        ) : null}
      </aside>
    </div>
  )
}
