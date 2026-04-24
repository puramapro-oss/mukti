import { NextResponse } from 'next/server'
import { getAmbassadorLeaderboard } from '@/lib/ambassador'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET() {
  const leaderboard = await getAmbassadorLeaderboard(20)
  const admin = createServiceClient()
  const ids = leaderboard.map(l => l.user_id)
  if (ids.length === 0) return NextResponse.json({ leaderboard: [] })
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', ids)
  const profileMap = new Map(((profiles ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>).map(p => [p.id, p]))
  return NextResponse.json({
    leaderboard: leaderboard.map((l, i) => {
      const p = profileMap.get(l.user_id)
      return {
        rank: i + 1,
        user_id: l.user_id,
        first_name: (p?.full_name ?? '').split(' ')[0] || 'Ambassadeur',
        avatar_url: p?.avatar_url ?? null,
        tier_slug: l.tier_slug,
        conversions_count: l.conversions_count,
      }
    }),
  })
}
