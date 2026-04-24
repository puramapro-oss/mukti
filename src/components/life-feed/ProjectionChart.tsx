'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

interface ProjectedImpact {
  rituals_count: number
  missions_count: number
  co2_saved_kg: number
  lives_touched_estimate: number
  donations_cents: number
  personal_growth_level: string
}

interface ProjectionResult {
  horizon_years: 5 | 10 | 20
  projected_impact: ProjectedImpact
  summary_fr: string
  summary_en: string
}

interface Props {
  hasHistory: boolean
}

const HORIZONS: Array<5 | 10 | 20> = [5, 10, 20]

export function ProjectionChart({ hasHistory }: Props) {
  const [horizon, setHorizon] = useState<5 | 10 | 20>(5)
  const [result, setResult] = useState<ProjectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function project(h: 5 | 10 | 20) {
    setHorizon(h)
    setErr(null)
    setLoading(true)
    try {
      const res = await fetch('/api/life-feed/projection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ horizon_years: h }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }))
        setErr(j.error ?? 'Projection impossible pour le moment.')
        return
      }
      const data = (await res.json()) as ProjectionResult
      setResult(data)
    } catch {
      setErr('Réseau indisponible. Réessaie dans un souffle.')
    } finally {
      setLoading(false)
    }
  }

  if (!hasHistory) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
        <Sparkles className="mx-auto h-7 w-7 text-white/40" aria-hidden="true" />
        <p className="mt-3 text-sm text-white/70">
          Commence par vivre quelques moments sur MUKTI pour que la projection ait un point d'ancrage.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-white/70">Projection sur</p>
        {HORIZONS.map(h => (
          <button
            key={h}
            type="button"
            onClick={() => void project(h)}
            data-testid={`projection-horizon-${h}`}
            aria-pressed={horizon === h && result !== null}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              horizon === h && result !== null
                ? 'border-purple-400/60 bg-purple-500/10 text-white'
                : 'border-white/15 bg-white/[0.02] text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            {h} ans
          </button>
        ))}
      </div>

      {loading && (
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Projection en cours…
        </p>
      )}

      {err && (
        <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {err}
        </p>
      )}

      {result && !loading && (
        <div className="mt-6" data-testid="projection-result">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">
            Dans {result.horizon_years} ans, si tu continues
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Rituels" value={result.projected_impact.rituals_count} />
            <Stat label="Missions accomplies" value={result.projected_impact.missions_count} />
            <Stat label="CO₂ évité" value={`${result.projected_impact.co2_saved_kg} kg`} />
            <Stat label="Vies touchées (estimation)" value={result.projected_impact.lives_touched_estimate} />
            <Stat
              label="Contributions redirigées"
              value={`${(result.projected_impact.donations_cents / 100).toFixed(0)}€`}
            />
            <Stat label="Niveau d'évolution" value={result.projected_impact.personal_growth_level} />
          </div>
          {result.summary_fr && (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm leading-relaxed text-white/80">
              {result.summary_fr}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}
