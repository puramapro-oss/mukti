'use client'

// MUKTI G8.6 — Editor 3 prix avec preview live + audit auto via PUT settings

import { useState, useTransition } from 'react'
import { Save, AlertCircle, Check } from 'lucide-react'

interface Props {
  initialMonthly: number
  initialAnnual: number
  initialAntiChurn: number
}

interface FieldDef {
  key: 'pricing_main_monthly_cents' | 'pricing_main_annual_cents' | 'pricing_anti_churn_cents'
  label: string
  description: string
}

const FIELDS: ReadonlyArray<FieldDef> = [
  {
    key: 'pricing_main_monthly_cents',
    label: 'Abonnement mensuel',
    description: 'Plan principal — facturé chaque mois.',
  },
  {
    key: 'pricing_main_annual_cents',
    label: 'Abonnement annuel',
    description: '-33% vs mensuel ×12. Facturé une fois par an.',
  },
  {
    key: 'pricing_anti_churn_cents',
    label: 'Anti-churn (à vie)',
    description: 'Offre rétention au moment de la résiliation.',
  },
]

function formatEuros(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export default function PricingEditor({ initialMonthly, initialAnnual, initialAntiChurn }: Props) {
  const [values, setValues] = useState<Record<FieldDef['key'], number>>({
    pricing_main_monthly_cents: initialMonthly,
    pricing_main_annual_cents: initialAnnual,
    pricing_anti_churn_cents: initialAntiChurn,
  })
  const initial: Record<FieldDef['key'], number> = {
    pricing_main_monthly_cents: initialMonthly,
    pricing_main_annual_cents: initialAnnual,
    pricing_anti_churn_cents: initialAntiChurn,
  }
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState<FieldDef['key'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleChange(key: FieldDef['key'], raw: string) {
    const cents = Math.max(0, Math.round(Number(raw) * 100))
    if (Number.isNaN(cents)) return
    setValues((prev) => ({ ...prev, [key]: cents }))
    setSaved(null)
    setError(null)
  }

  function handleSave(key: FieldDef['key']) {
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: values[key] }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Impossible d\'enregistrer.')
        return
      }
      initial[key] = values[key]
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {FIELDS.map((f) => {
        const cents = values[f.key]
        const eurosString = (cents / 100).toFixed(2)
        const dirty = cents !== initial[f.key]
        return (
          <div
            key={f.key}
            className="space-y-3 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-violet-500/0 p-5"
          >
            <div className="space-y-1">
              <label htmlFor={`price-${f.key}`} className="block text-sm font-medium text-white">
                {f.label}
              </label>
              <p className="text-xs text-white/55">{f.description}</p>
            </div>
            <div className="relative">
              <input
                id={`price-${f.key}`}
                type="number"
                step="0.01"
                min="0"
                value={eurosString}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 pr-10 text-base font-medium text-white outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20"
                aria-label={`Prix ${f.label} en euros`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/50">€</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Aperçu : <span className="font-medium text-white/85">{formatEuros(cents)}</span></span>
              <span className="text-white/35">{cents} c</span>
            </div>
            <button
              type="button"
              onClick={() => handleSave(f.key)}
              disabled={pending || !dirty}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
            >
              {saved === f.key ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Enregistré
                </>
              ) : pending ? (
                'Enregistrement…'
              ) : (
                <>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Appliquer en live
                </>
              )}
            </button>
          </div>
        )
      })}
      {error ? (
        <div className="md:col-span-3 flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}
    </div>
  )
}
