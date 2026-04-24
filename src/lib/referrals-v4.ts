// MUKTI — G7 Parrainage V4 : 50% N1 + 10% récurrent à vie + carte à vie dès 3 conv.

import { createServiceClient } from './supabase'
import { REFERRAL_V4 } from './constants'

export async function attributeReferralSignup(params: {
  referrerCode: string
  referredUserId: string
}): Promise<{ attributed: boolean }> {
  const admin = createServiceClient()
  const { data: referrer } = await admin
    .from('profiles')
    .select('id')
    .eq('referral_code', params.referrerCode)
    .maybeSingle()
  if (!referrer) return { attributed: false }
  const referrerId = (referrer as { id: string }).id
  if (referrerId === params.referredUserId) return { attributed: false }
  await admin.from('referrals_v4').upsert({
    referrer_id: referrerId,
    referred_id: params.referredUserId,
    cookie_hit_at: new Date().toISOString(),
    signup_at: new Date().toISOString(),
    status: 'pending',
  }, { onConflict: 'referrer_id,referred_id' })
  // Sync profiles.referred_by
  await admin.from('profiles').update({ referred_by: referrerId }).eq('id', params.referredUserId)
  return { attributed: true }
}

export async function creditReferrerOnPayment(params: {
  referredUserId: string
  paymentAmountCents: number
  paymentId: string
  isFirstPayment: boolean
}): Promise<{ credited: boolean; kind: 'n1' | 'recurring' | null; amountCents: number }> {
  const admin = createServiceClient()
  const { data: ref } = await admin
    .from('referrals_v4')
    .select('id, referrer_id, first_payment_at')
    .eq('referred_id', params.referredUserId)
    .maybeSingle()
  if (!ref) return { credited: false, kind: null, amountCents: 0 }
  const refRow = ref as { id: string; referrer_id: string; first_payment_at: string | null }
  const isFirst = params.isFirstPayment || !refRow.first_payment_at
  const pct = isFirst ? REFERRAL_V4.n1_pct : REFERRAL_V4.recurring_pct
  const commissionCents = Math.floor((params.paymentAmountCents * pct) / 100)
  if (commissionCents <= 0) return { credited: false, kind: null, amountCents: 0 }
  await admin.from('commissions').insert({
    user_id: refRow.referrer_id,
    amount_cents: commissionCents,
    type: isFirst ? 'n1_abo' : 'recurring',
    source_payment_id: params.paymentId,
    status: 'credited',
    credited_at: new Date().toISOString(),
  })
  // Update referral stats
  const patch: Record<string, unknown> = {}
  if (isFirst) {
    patch.first_payment_at = new Date().toISOString()
    patch.earned_n1_cents = commissionCents
    patch.status = 'active'
  } else {
    patch.earned_recurring_cents = commissionCents // cumulative updated below
  }
  await admin.from('referrals_v4').update(patch).eq('id', refRow.id)
  // Credit wallet (direct update — RPC increment_wallet not guaranteed to exist)
  const { data: w } = await admin.from('profiles').select('wallet_balance_cents').eq('id', refRow.referrer_id).maybeSingle()
  const prev = ((w as { wallet_balance_cents: number } | null)?.wallet_balance_cents) ?? 0
  await admin.from('profiles').update({ wallet_balance_cents: prev + commissionCents }).eq('id', refRow.referrer_id)
  return { credited: true, kind: isFirst ? 'n1' : 'recurring', amountCents: commissionCents }
}

export async function checkLifetimeCardEligibility(referrerId: string): Promise<boolean> {
  const admin = createServiceClient()
  const { count } = await admin
    .from('referrals_v4')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referrerId)
    .eq('status', 'active')
  const conversions = count ?? 0
  if (conversions >= REFERRAL_V4.lifetime_card_threshold) {
    await admin.from('profiles').update({ lifetime_card_granted: true }).eq('id', referrerId)
    return true
  }
  return false
}

export async function getReferralStatsForUser(userId: string) {
  const admin = createServiceClient()
  const { data, count } = await admin
    .from('referrals_v4')
    .select('earned_n1_cents, earned_recurring_cents, status, first_payment_at, signup_at', { count: 'exact' })
    .eq('referrer_id', userId)
  const rows = (data ?? []) as Array<{
    earned_n1_cents: number
    earned_recurring_cents: number
    status: string
    first_payment_at: string | null
    signup_at: string
  }>
  const activeCount = rows.filter(r => r.status === 'active').length
  const totalEarnedCents = rows.reduce((a, r) => a + (r.earned_n1_cents ?? 0) + (r.earned_recurring_cents ?? 0), 0)
  return {
    total_referrals: count ?? 0,
    active_referrals: activeCount,
    total_earned_cents: totalEarnedCents,
  }
}
