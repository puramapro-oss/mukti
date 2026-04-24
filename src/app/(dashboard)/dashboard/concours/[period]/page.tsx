import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentContest, getUpcomingContest, computeWeeklyRanking } from '@/lib/contests-karma'
import { CONTEST_PERIODS, type ContestPeriod } from '@/lib/constants'
import { Trophy, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Concours détail — MUKTI',
  robots: { index: false, follow: false },
}

interface PageProps { params: Promise<{ period: string }> }

export default async function ConcoursDetailPage({ params }: PageProps) {
  const { period: rawPeriod } = await params
  const cfg = CONTEST_PERIODS.find(p => p.id === rawPeriod)
  if (!cfg) notFound()
  const period = cfg.id as ContestPeriod
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) redirect(`/login?next=/dashboard/concours/${period}`)
  const [current, upcoming] = await Promise.all([getCurrentContest(period), getUpcomingContest(period)])
  const admin = createServiceClient()
  // Historique 5 derniers
  const { data: history } = await admin
    .from('contests_karma')
    .select('id, start_at, end_at, pool_cents, rules_pdf_url, ots_proof_url, status, closed_at')
    .eq('period', period)
    .eq('status', 'paid')
    .order('closed_at', { ascending: false })
    .limit(5)
  const historyRows = (history ?? []) as Array<{
    id: string; start_at: string; end_at: string; pool_cents: number;
    rules_pdf_url: string | null; ots_proof_url: string | null; status: string; closed_at: string | null;
  }>
  let liveRanking: Array<{ user_id: string; score: number }> = []
  if (current && period === 'weekly') {
    liveRanking = await computeWeeklyRanking(current.id, 10)
  }
  // Noms des leaders
  let profileMap = new Map<string, string>()
  if (liveRanking.length > 0) {
    const ids = liveRanking.map(r => r.user_id)
    const { data } = await admin.from('profiles').select('id, full_name').in('id', ids)
    profileMap = new Map(((data ?? []) as Array<{ id: string; full_name: string | null }>).map(p => [
      p.id, (p.full_name ?? '').split(' ')[0] || 'Membre',
    ]))
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/dashboard/concours" className="text-violet-400 text-sm hover:text-violet-300">← Retour concours</Link>
        <header>
          <h1 className="text-4xl font-bold mb-2">Concours {cfg.label_fr}</h1>
          <p className="text-white/60">{cfg.pct_ca}% du CA · {cfg.winners} gagnants</p>
        </header>

        {current ? (
          <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.04] p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-emerald-400 text-sm font-medium uppercase mb-1">EN COURS</div>
                <div className="text-4xl font-bold">{(current.pool_cents / 100).toFixed(2).replace('.', ',')}€</div>
                <div className="text-white/60 text-sm mt-1">
                  Jusqu&apos;au {new Date(current.end_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </div>
              </div>
              <Trophy className="h-10 w-10 text-amber-400" />
            </div>
          </section>
        ) : upcoming ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-white/60 text-sm uppercase mb-1">À VENIR</div>
            <div className="text-2xl font-bold">{new Date(upcoming.start_at).toLocaleDateString('fr-FR')}</div>
            <div className="text-white/60 mt-1">Cagnotte : {(upcoming.pool_cents / 100).toFixed(2).replace('.', ',')}€</div>
          </section>
        ) : null}

        {liveRanking.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Top 10 live</h2>
            <ol className="space-y-2">
              {liveRanking.map((r, i) => (
                <li
                  key={r.user_id}
                  className={`flex items-center justify-between rounded-xl border p-3 ${
                    i < 3 ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-white/60 w-8">{i + 1}</span>
                    <span className="font-medium">{profileMap.get(r.user_id) ?? 'Membre'}</span>
                  </div>
                  <span className="font-bold">{r.score} pts</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {historyRows.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Historique</h2>
            <ul className="space-y-3">
              {historyRows.map(h => (
                <li key={h.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold">
                        {new Date(h.start_at).toLocaleDateString('fr-FR')} — {new Date(h.end_at).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-white/60 text-sm">Cagnotte : {(h.pool_cents / 100).toFixed(2).replace('.', ',')}€</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {h.rules_pdf_url && (
                      <a href={h.rules_pdf_url} target="_blank" rel="noopener"
                        data-testid="rules-pdf-link"
                        className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 hover:bg-white/[0.06]">
                        Règlement PDF <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {h.ots_proof_url && (
                      <a href={h.ots_proof_url} target="_blank" rel="noopener"
                        data-testid="ots-proof-link"
                        className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-3 py-1 text-amber-300 hover:bg-amber-500/[0.15]">
                        Proof OTS Bitcoin <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
