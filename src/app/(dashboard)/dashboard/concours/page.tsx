import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { getCurrentContest, getUpcomingContest } from '@/lib/contests-karma'
import { CONTEST_PERIODS } from '@/lib/constants'
import { Trophy, Calendar, Coins } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Concours KARMA — MUKTI',
  robots: { index: false, follow: false },
}

export default async function ConcoursHubPage() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) redirect('/login?next=/dashboard/concours')
  const entries = await Promise.all(
    CONTEST_PERIODS.map(async p => {
      const [cur, next] = await Promise.all([getCurrentContest(p.id), getUpcomingContest(p.id)])
      return { cfg: p, current: cur, next }
    }),
  )
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-4xl font-bold mb-2">Concours KARMA</h1>
          <p className="text-white/60">
            50% du CA Purama redistribué en concours transparents. Règlements horodatés blockchain.
          </p>
        </header>

        <div className="grid sm:grid-cols-3 gap-4">
          {entries.map(({ cfg, current, next }) => {
            const activeContest = current ?? next
            const isLive = !!current
            const pool = activeContest ? (activeContest.pool_cents / 100).toFixed(2).replace('.', ',') : '0,00'
            return (
              <Link
                key={cfg.id}
                href={`/dashboard/concours/${cfg.id}`}
                data-testid={`concours-card-${cfg.id}`}
                className="group rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-6 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <Trophy className="h-6 w-6 text-amber-400" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/60'
                  }`}>
                    {isLive ? 'EN COURS' : 'À VENIR'}
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">{cfg.label_fr}</h3>
                <p className="text-white/60 text-sm mb-4">{cfg.pct_ca}% du CA · {cfg.winners} gagnants</p>
                <div className="flex items-baseline gap-1">
                  <Coins className="h-4 w-4 text-amber-400" />
                  <span className="text-3xl font-bold">{pool}€</span>
                </div>
                {activeContest && (
                  <div className="mt-3 text-xs text-white/50 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {isLive
                      ? `Jusqu'au ${new Date(activeContest.end_at).toLocaleDateString('fr-FR')}`
                      : `Démarre ${new Date(activeContest.start_at).toLocaleDateString('fr-FR')}`}
                  </div>
                )}
              </Link>
            )
          })}
        </div>

        <section className="rounded-3xl border border-violet-500/20 bg-violet-500/[0.04] p-6">
          <h2 className="text-lg font-semibold mb-2">Comment ça marche ?</h2>
          <ul className="space-y-1 text-white/70 text-sm">
            <li>• Chaque paiement Stripe alimente automatiquement la cagnotte (50% du CA redistribué).</li>
            <li>• Hebdo : top 10 du score (parrainage, streak, événements…).</li>
            <li>• Mensuel : 10 gagnants tirés au hasard parmi les actifs (Mulberry32, seed vérifiable).</li>
            <li>• Annuel : gros lot en fin d&apos;année.</li>
            <li>• Chaque règlement est horodaté sur la blockchain Bitcoin via OpenTimestamps.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
