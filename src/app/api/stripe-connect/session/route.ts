// MUKTI — G7 Stripe Connect Embedded : AccountSession
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { resolveProfileId } from '@/lib/ar'
import { createExpressAccount, createAccountSession, retrieveAccount } from '@/lib/stripe-connect'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 20

export async function POST(req: Request) {
  void req
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`connect:${profileId}`, 30, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 })
  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', profileId)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })
  const p = profile as { email: string | null; full_name: string | null }
  if (!p.email) return NextResponse.json({ error: 'Email requis pour KYC.' }, { status: 400 })
  // Ensure account exists
  const { data: existing } = await admin
    .from('stripe_connect_accounts')
    .select('stripe_account_id, onboarding_complete, payouts_enabled, kyc_status')
    .eq('user_id', profileId)
    .maybeSingle()
  let accountId = (existing as { stripe_account_id: string } | null)?.stripe_account_id ?? null
  if (!accountId) {
    try {
      const account = await createExpressAccount({ email: p.email, country: 'FR', userId: profileId })
      accountId = account.id
      await admin.from('stripe_connect_accounts').upsert({
        user_id: profileId, stripe_account_id: accountId, onboarding_complete: false,
        kyc_status: 'pending', payouts_enabled: false, charges_enabled: false, country: 'FR',
      }, { onConflict: 'user_id' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Stripe Connect indisponible.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } else {
    // Refresh status
    try {
      const remote = await retrieveAccount(accountId)
      await admin.from('stripe_connect_accounts').update({
        onboarding_complete: remote.details_submitted ?? false,
        payouts_enabled: remote.payouts_enabled ?? false,
        charges_enabled: remote.charges_enabled ?? false,
        kyc_status: remote.details_submitted && remote.payouts_enabled ? 'verified' : 'pending',
      }).eq('user_id', profileId)
    } catch { /* non bloquant */ }
  }
  try {
    const session = await createAccountSession({ accountId })
    return NextResponse.json({
      ok: true,
      client_secret: session.client_secret,
      account_id: accountId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stripe Connect indisponible.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
