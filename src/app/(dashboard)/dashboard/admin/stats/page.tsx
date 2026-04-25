// MUKTI G8.6 — Sous-page admin Stats live : CA + split + churn + top régions

import { getStatsLive } from '@/lib/admin-stats'
import StatsClient from './StatsClient'

export const dynamic = 'force-dynamic'

export default async function AdminStatsPage() {
  const stats = await getStatsLive()
  return (
    <div className="space-y-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold text-white">Stats live</h1>
          <p className="text-sm text-white/60">
            CA Stripe brut + split 50/10/40 décomposé + churn + top régions. Données calculées en temps réel à
            chaque chargement (cache désactivé).
          </p>
        </div>
        {stats ? (
          <p className="text-xs text-white/40">
            Généré : {new Date(stats.generated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        ) : null}
      </header>
      {stats ? <StatsClient initialStats={stats} /> : <p className="text-sm text-rose-300">Statistiques indisponibles.</p>}
    </div>
  )
}
