import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { getAmbassadorLeaderboard } from '@/lib/ambassador'
import { createServiceClient } from '@/lib/supabase'
import { Trophy, Medal, Star } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Classement Ambassadeurs — MUKTI',
  robots: { index: false, follow: false },
}

export default async function LeaderboardPage() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) redirect('/login?next=/dashboard/ambassadeur/leaderboard')
  const leaderboard = await getAmbassadorLeaderboard(20)
  const admin = createServiceClient()
  const ids = leaderboard.map(l => l.user_id)
  let profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>()
  if (ids.length > 0) {
    const { data } = await admin.from('profiles').select('id, full_name, avatar_url').in('id', ids)
    profileMap = new Map(((data ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>).map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]))
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Classement ambassadeurs</h1>
        <p className="text-white/60 mb-8">Top 20 — mis à jour en temps réel.</p>

        {leaderboard.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white/50">Pas encore d&apos;ambassadeur approuvé. Sois le premier !</p>
          </div>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((l, i) => {
              const p = profileMap.get(l.user_id)
              const name = (p?.full_name ?? '').split(' ')[0] || 'Ambassadeur'
              const Icon = i === 0 ? Trophy : i === 1 ? Medal : i === 2 ? Star : null
              return (
                <li
                  key={l.user_id}
                  data-testid={`leaderboard-row-${i + 1}`}
                  className={`flex items-center gap-4 rounded-2xl border p-4 ${
                    i < 3 ? 'border-amber-500/30 bg-amber-500/[0.03]' : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className="w-10 text-center">
                    {Icon ? <Icon className={`h-6 w-6 mx-auto ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : 'text-amber-700'}`} />
                      : <span className="text-white/60 font-mono">{i + 1}</span>}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{name}</div>
                    <div className="text-sm text-white/60 uppercase tracking-wider">{l.tier_slug}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{l.conversions_count}</div>
                    <div className="text-xs text-white/50">conversions</div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </main>
  )
}
