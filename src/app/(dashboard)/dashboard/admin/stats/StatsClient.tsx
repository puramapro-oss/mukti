'use client'

// MUKTI G8.6 — Stats live client : 6 big numbers + split + churn + top régions + refresh

import { useState, useTransition } from 'react'
import { RefreshCw, TrendingUp, Users, AlertTriangle, Globe, Banknote } from 'lucide-react'
import type { StatsLive } from '@/lib/admin-stats'

interface Props {
  initialStats: StatsLive
}

const COUNTRY_NAMES: Record<string, string> = {
  FR: 'France',
  US: 'États-Unis',
  GB: 'Royaume-Uni',
  ES: 'Espagne',
  DE: 'Allemagne',
  IT: 'Italie',
  PT: 'Portugal',
  CA: 'Canada',
  CH: 'Suisse',
  BE: 'Belgique',
  JP: 'Japon',
  CN: 'Chine',
  INT: 'International',
}

function formatEuros(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`
}

function formatEurosFraction(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

export default function StatsClient({ initialStats }: Props) {
  const [stats, setStats] = useState<StatsLive>(initialStats)
  const [pending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      const res = await fetch('/api/admin/stats-live', { cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as { stats: StatsLive }
        setStats(data.stats)
      }
    })
  }

  const totalCount = stats.top_countries.reduce((s, c) => s + c.count, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} aria-hidden="true" />
          Actualiser
        </button>
      </div>

      {/* CA Stripe brut */}
      <section aria-labelledby="ca-section">
        <h2 id="ca-section" className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-teal-300">
          <Banknote className="h-4 w-4" aria-hidden="true" />
          CA Stripe brut
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-teal-400/30 bg-teal-500/10 p-4">
            <p className="text-xs text-teal-200/80">Total all-time</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatEuros(stats.ca.total_cents)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-white/55">Ce mois</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatEuros(stats.ca.month_cents)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-white/55">Aujourd&apos;hui</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatEurosFraction(stats.ca.day_cents)}</p>
          </div>
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4">
            <p className="text-xs text-rose-200/70">Remboursements</p>
            <p className="mt-1 text-2xl font-semibold text-rose-200">{formatEuros(stats.ca.refunded_cents)}</p>
          </div>
        </div>
      </section>

      {/* Split 50/10/40 décomposé */}
      <section aria-labelledby="split-section">
        <h2 id="split-section" className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-violet-300">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
          Split 50/10/40 (Wealth Engine)
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
            <p className="text-xs text-violet-200/80">Pool utilisateurs (50%)</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatEuros(stats.split.pool_user_cents)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <p className="text-xs text-emerald-200/80">Association (10%)</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatEuros(stats.split.asso_cents)}</p>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
            <p className="text-xs text-amber-200/80">SASU PURAMA (40%)</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatEuros(stats.split.sasu_cents)}</p>
          </div>
        </div>
      </section>

      {/* Users */}
      <section aria-labelledby="users-section">
        <h2 id="users-section" className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-cyan-300">
          <Users className="h-4 w-4" aria-hidden="true" />
          Utilisateurs
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-white/55">Total</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatNumber(stats.users.total)}</p>
          </div>
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
            <p className="text-xs text-cyan-200/80">Premium actifs</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatNumber(stats.users.premium_active)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-white/55">30 derniers jours</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatNumber(stats.users.last_30d)}</p>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
            <p className="text-xs text-amber-200/80">Super admins</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatNumber(stats.users.super_admin)}</p>
          </div>
        </div>
      </section>

      {/* Churn + Top countries */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <section aria-labelledby="churn-section" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 id="churn-section" className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-rose-300">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Churn ce mois
          </h2>
          <div className="text-center">
            <p className="text-5xl font-bold text-rose-200">{stats.churn.rate_pct.toFixed(1)} %</p>
            <p className="mt-2 text-xs text-white/55">
              {stats.churn.canceled_this_month} résiliations / {stats.churn.active_start_of_month} actifs au début du mois
            </p>
          </div>
        </section>
        <section aria-labelledby="countries-section" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 id="countries-section" className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-sky-300">
            <Globe className="h-4 w-4" aria-hidden="true" />
            Top 5 régions
          </h2>
          {stats.top_countries.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/45">Aucune région détectée pour l&apos;instant.</p>
          ) : (
            <ul className="space-y-2">
              {stats.top_countries.map((c) => {
                const pct = totalCount > 0 ? (c.count / totalCount) * 100 : 0
                return (
                  <li key={c.code}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/85">
                        <span className="font-mono text-xs text-white/50">{c.code}</span>{' '}
                        <span className="ml-2">{COUNTRY_NAMES[c.code] ?? c.code}</span>
                      </span>
                      <span className="font-medium text-white/80">{formatNumber(c.count)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                      <div
                        className="h-full bg-sky-400/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
