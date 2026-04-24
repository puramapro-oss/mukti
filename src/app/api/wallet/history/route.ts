import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`wallet-history:${profileId}`, 60, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  const [{ data: commissions }, { data: withdrawals }, { data: profile }] = await Promise.all([
    sb.from('commissions').select('amount_cents, type, status, credited_at').order('credited_at', { ascending: false }).limit(50),
    sb.from('withdrawals_karma').select('amount_cents, status, requested_at, completed_at').order('requested_at', { ascending: false }).limit(50),
    sb.from('profiles').select('wallet_balance_cents').eq('id', profileId).maybeSingle(),
  ])
  const balance = ((profile as { wallet_balance_cents: number } | null)?.wallet_balance_cents) ?? 0
  return NextResponse.json({
    balance_cents: balance,
    commissions: commissions ?? [],
    withdrawals: withdrawals ?? [],
  })
}
