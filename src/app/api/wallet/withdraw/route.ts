// MUKTI — G7 Retrait wallet via Stripe Connect Transfer (min 5€)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { resolveProfileId } from '@/lib/ar'
import { createTransferToConnectedAccount } from '@/lib/stripe-connect'
import { WALLET_MIN_WITHDRAWAL_CENTS } from '@/lib/constants'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

const BodySchema = z.object({
  amount_cents: z.number().int().min(WALLET_MIN_WITHDRAWAL_CENTS),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`withdraw:${profileId}`, 3, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Montant invalide (min 5€).' }, { status: 400 })
  const admin = createServiceClient()
  const [{ data: profile }, { data: connect }] = await Promise.all([
    admin.from('profiles').select('wallet_balance_cents').eq('id', profileId).maybeSingle(),
    admin.from('stripe_connect_accounts').select('stripe_account_id, payouts_enabled, kyc_status').eq('user_id', profileId).maybeSingle(),
  ])
  const balance = ((profile as { wallet_balance_cents: number } | null)?.wallet_balance_cents) ?? 0
  if (balance < parsed.data.amount_cents) {
    return NextResponse.json({ error: 'Solde insuffisant.' }, { status: 400 })
  }
  const c = connect as { stripe_account_id: string; payouts_enabled: boolean; kyc_status: string } | null
  if (!c || !c.payouts_enabled || c.kyc_status !== 'verified') {
    return NextResponse.json({ error: 'KYC incomplet. Termine l\'onboarding Connect d\'abord.' }, { status: 400 })
  }
  // Insert pending withdrawal
  const { data: withdrawal } = await admin.from('withdrawals_karma').insert({
    user_id: profileId,
    amount_cents: parsed.data.amount_cents,
    status: 'processing',
  }).select('id').maybeSingle()
  const withdrawalId = (withdrawal as { id: string } | null)?.id
  try {
    const transfer = await createTransferToConnectedAccount({
      destinationAccountId: c.stripe_account_id,
      amountCents: parsed.data.amount_cents,
      description: `MUKTI withdrawal — user ${profileId}`,
      metadata: { mukti_user_id: profileId, withdrawal_id: withdrawalId ?? '' },
    })
    await admin.from('profiles').update({ wallet_balance_cents: balance - parsed.data.amount_cents }).eq('id', profileId)
    if (withdrawalId) {
      await admin.from('withdrawals_karma').update({
        status: 'completed',
        stripe_transfer_id: transfer.id,
        completed_at: new Date().toISOString(),
      }).eq('id', withdrawalId)
    }
    return NextResponse.json({ ok: true, transfer_id: transfer.id, amount_cents: parsed.data.amount_cents })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur Stripe Transfer.'
    if (withdrawalId) {
      await admin.from('withdrawals_karma').update({
        status: 'failed', error_message: msg,
      }).eq('id', withdrawalId)
    }
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
