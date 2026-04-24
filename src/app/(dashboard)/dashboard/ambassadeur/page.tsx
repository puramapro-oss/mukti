import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { getMyAmbassadeurProfile, listTiersPublic } from '@/lib/ambassador'
import { getReferralStatsForUser } from '@/lib/referrals-v4'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Programme Ambassadeur — MUKTI',
  robots: { index: false, follow: false },
}

export default async function AmbassadeurHubPage() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) redirect('/login?next=/dashboard/ambassadeur')
  const [me, tiers, stats] = await Promise.all([
    getMyAmbassadeurProfile(),
    listTiersPublic(),
    getReferralStatsForUser(profileId),
  ])
  const currentTier = me ? tiers.find(t => t.slug === me.tier_slug) : null
  const currentTierIdx = currentTier ? tiers.findIndex(t => t.slug === currentTier.slug) : -1
  const nextTier = currentTierIdx >= 0 && currentTierIdx < tiers.length - 1 ? tiers[currentTierIdx + 1] : null

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-4xl font-bold mb-2">Programme Ambassadeur</h1>
          <p className="text-white/60">
            Partage MUKTI, gagne des commissions à vie, débloque des paliers.
          </p>
        </header>

        {!me || !me.approved_at ? (
          <section className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.08] to-cyan-500/[0.04] p-8">
            <h2 className="text-2xl font-semibold mb-3">Candidate comme ambassadeur</h2>
            <p className="text-white/70 mb-6">
              Tu as déjà parrainé {stats.active_referrals} personne{stats.active_referrals === 1 ? '' : 's'} active{stats.active_referrals === 1 ? '' : 's'}.
              Dès 10 conversions actives, tu es auto-approuvé·e en tier Bronze.
            </p>
            <Link
              href="/dashboard/ambassadeur/apply"
              data-testid="ambassadeur-apply-cta"
              className="inline-block rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-8 py-3 font-semibold"
            >
              Candidater maintenant
            </Link>
          </section>
        ) : (
          <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.04] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-emerald-400 text-sm font-medium uppercase tracking-wider mb-1">Ton tier actuel</div>
                <div className="text-3xl font-bold">{currentTier?.name_fr ?? me.tier_slug}</div>
                <div className="text-white/60 mt-1">{me.conversions_count} conversion{me.conversions_count === 1 ? '' : 's'} · {(me.total_earned_cents / 100).toFixed(2).replace('.', ',')}€ gagnés</div>
              </div>
              <div className="text-right">
                <div className="text-white/60 text-sm">Commission</div>
                <div className="text-3xl font-bold text-emerald-400">{currentTier?.commission_rate_pct}%</div>
              </div>
            </div>
            {nextTier && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-sm text-white/60 mb-2">
                  Prochain : <strong className="text-white">{nextTier.name_fr}</strong> à {nextTier.threshold_conversions} conversions
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-cyan-500"
                    style={{ width: `${Math.min(100, (me.conversions_count / nextTier.threshold_conversions) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="text-2xl font-semibold mb-4">Les 8 paliers</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {tiers.map(t => {
              const isMine = me?.tier_slug === t.slug
              const unlocked = stats.active_referrals >= t.threshold_conversions
              return (
                <div
                  key={t.slug}
                  data-testid={`tier-${t.slug}`}
                  className={`rounded-2xl border p-4 ${
                    isMine ? 'border-emerald-500 bg-emerald-500/[0.08]' :
                    unlocked ? 'border-violet-500/40 bg-violet-500/[0.04]' :
                    'border-white/10 bg-white/[0.03] opacity-60'
                  }`}
                >
                  <div className="text-xs uppercase tracking-wider text-white/50 mb-1">{t.name_en}</div>
                  <div className="text-xl font-bold mb-1">{t.name_fr}</div>
                  <div className="text-sm text-white/60">{t.threshold_conversions} conv · {t.commission_rate_pct}%</div>
                  {t.plan_granted && (
                    <div className="mt-2 text-xs text-emerald-400">+ Plan {t.plan_granted === 'main_annual' ? 'Annuel' : 'Essentiel'} offert</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <footer className="flex flex-wrap gap-3">
          <Link href="/dashboard/ambassadeur/leaderboard" className="rounded-full border border-white/20 px-5 py-2 text-sm hover:bg-white/[0.06]">
            Classement
          </Link>
          <Link href="/dashboard/referral" className="rounded-full border border-white/20 px-5 py-2 text-sm hover:bg-white/[0.06]">
            Mon lien de parrainage
          </Link>
        </footer>
      </div>
    </main>
  )
}
