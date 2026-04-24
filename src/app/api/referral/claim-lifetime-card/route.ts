// MUKTI — G7 Claim lifetime card (3+ filleuls actifs)
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { resolveProfileId } from '@/lib/ar'
import { checkLifetimeCardEligibility } from '@/lib/referrals-v4'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: Request) {
  void req
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`lifetime:${profileId}`, 5, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 })
  const admin = createServiceClient()
  const { data: profile } = await admin.from('profiles').select('lifetime_card_granted').eq('id', profileId).maybeSingle()
  if ((profile as { lifetime_card_granted: boolean } | null)?.lifetime_card_granted) {
    return NextResponse.json({ ok: true, already_granted: true })
  }
  const eligible = await checkLifetimeCardEligibility(profileId)
  return NextResponse.json({ ok: true, granted: eligible })
}
