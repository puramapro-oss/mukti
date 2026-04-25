'use client'

// MUKTI G8.6 — Feature flags : toggles + add custom flag

import { useState, useTransition } from 'react'
import { Plus, AlertCircle, Check, ToggleLeft, ToggleRight } from 'lucide-react'

interface Props {
  initialFlags: Record<string, boolean>
}

const FLAG_KEY_RE = /^[a-z][a-z0-9_]{1,40}$/

const FLAG_LABELS: Record<string, string> = {
  ar_mirror: 'AR Energy Mirror',
  aurora: 'AURORA OMEGA respiration',
  core_events: 'C.O.R.E. événements mondiaux',
  fil_de_vie: 'Fil de Vie',
  rituel_hebdo: 'Rituel hebdomadaire',
  cercles: 'Cercles d\'intention',
  liberation: 'Libération addictions',
  accompagnants: 'Espace accompagnants',
  aide_ia: 'Q&R IA',
}

export default function FeatureFlagsClient({ initialFlags }: Props) {
  const [flags, setFlags] = useState<Record<string, boolean>>(initialFlags)
  const [newFlagKey, setNewFlagKey] = useState('')
  const [newFlagError, setNewFlagError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedFlag, setSavedFlag] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(flagKey: string) {
    const newValue = !flags[flagKey]
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/feature-flags/${flagKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Mise à jour impossible.')
        return
      }
      setFlags((prev) => ({ ...prev, [flagKey]: newValue }))
      setSavedFlag(flagKey)
      setTimeout(() => setSavedFlag(null), 1500)
    })
  }

  function addFlag() {
    setNewFlagError(null)
    const key = newFlagKey.trim().toLowerCase()
    if (!FLAG_KEY_RE.test(key)) {
      setNewFlagError('Identifiant invalide (lettres minuscules, chiffres, underscore — 2 à 40 caractères).')
      return
    }
    if (flags[key] !== undefined) {
      setNewFlagError('Ce flag existe déjà.')
      return
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/feature-flags/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: false }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setNewFlagError((j as { error?: string }).error ?? 'Création impossible.')
        return
      }
      setFlags((prev) => ({ ...prev, [key]: false }))
      setNewFlagKey('')
    })
  }

  const orderedKeys = Object.keys(flags).sort()

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {orderedKeys.map((key) => {
          const isOn = flags[key] === true
          return (
            <li
              key={key}
              className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition ${
                isOn
                  ? 'border-indigo-400/30 bg-indigo-500/10'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">{FLAG_LABELS[key] ?? key}</p>
                  {savedFlag === key ? (
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" aria-hidden="true" />
                  ) : null}
                </div>
                <p className="font-mono text-[10px] text-white/45">{key}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(key)}
                disabled={pending}
                role="switch"
                aria-checked={isOn}
                aria-label={`${isOn ? 'Désactiver' : 'Activer'} ${FLAG_LABELS[key] ?? key}`}
                className="flex-shrink-0 transition disabled:opacity-50"
              >
                {isOn ? (
                  <ToggleRight className="h-9 w-9 text-indigo-300" aria-hidden="true" />
                ) : (
                  <ToggleLeft className="h-9 w-9 text-white/40" aria-hidden="true" />
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="mb-3 text-sm font-medium text-white">Ajouter un flag personnalisé</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="new-flag" className="block text-xs text-white/55">
              Identifiant (snake_case)
            </label>
            <input
              id="new-flag"
              type="text"
              value={newFlagKey}
              onChange={(e) => setNewFlagKey(e.target.value)}
              placeholder="ex. beta_holographic"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-indigo-400/60"
              aria-describedby={newFlagError ? 'new-flag-error' : undefined}
            />
          </div>
          <button
            type="button"
            onClick={addFlag}
            disabled={pending || !newFlagKey.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:bg-white/10 disabled:text-white/40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter
          </button>
        </div>
        {newFlagError ? (
          <p id="new-flag-error" className="mt-2 text-xs text-rose-300" role="alert">
            {newFlagError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
