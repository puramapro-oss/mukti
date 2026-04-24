// MUKTI — G7 Stripe webhook
// Gère : checkout.session.completed | customer.subscription.* | invoice.payment_succeeded | account.updated
// Idempotence via mukti.processed_stripe_events (event_id UNIQUE)
// Split 50/10/40 + credit referrer V4 + credit concours pool + magic_moment

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, verifyWebhookSignature } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { upsertSubscriptionFromStripe } from '@/lib/subscriptions'
import { creditReferrerOnPayment, checkLifetimeCardEligibility } from '@/lib/referrals-v4'
import { upgradeTierIfEligible } from '@/lib/ambassador'
import { getCurrentContest, addToPool, ensureContest } from '@/lib/contests-karma'
import { recordMagicMoment } from '@/lib/wealth-engine'
import { CONTEST_PERIODS, WEALTH_SPLIT_PCT, PLAN_SLUGS, type PlanSlug } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 60

async function markProcessed(eventId: string, eventType: string): Promise<boolean> {
  const admin = createServiceClient()
  const { error } = await admin.from('processed_stripe_events').insert({
    event_id: eventId, event_type: eventType,
  })
  // duplicate key = déjà traité
  return !error
}

function resolvePlanSlug(sub: Stripe.Subscription): PlanSlug {
  const meta = sub.metadata?.plan_slug as string | undefined
  if (meta && (PLAN_SLUGS as readonly string[]).includes(meta)) return meta as PlanSlug
  const interval = sub.items.data[0]?.price.recurring?.interval
  return interval === 'year' ? 'main_annual' : 'main_monthly'
}

async function resolveUserIdFromCustomer(customerId: string): Promise<string | null> {
  const admin = createServiceClient()
  const { data } = await admin.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const userId = (sub.metadata?.mukti_user_id as string | undefined) ?? await resolveUserIdFromCustomer(customerId)
  if (!userId) return
  // Fallback period values
  const item = sub.items.data[0]
  const getTs = (key: string): number | null => {
    const val = (sub as unknown as Record<string, number | null | undefined>)[key]
    return typeof val === 'number' ? val : null
  }
  await upsertSubscriptionFromStripe({
    userId,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    planSlug: resolvePlanSlug(sub),
    status: sub.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete',
    trialEnd: sub.trial_end ?? null,
    currentPeriodStart: (item && (item as unknown as { current_period_start?: number }).current_period_start) ?? getTs('current_period_start'),
    currentPeriodEnd: (item && (item as unknown as { current_period_end?: number }).current_period_end) ?? getTs('current_period_end'),
    cancelAt: sub.cancel_at ?? null,
    canceledAt: sub.canceled_at ?? null,
    promoCode: (sub.metadata?.promo_code as string | undefined) ?? null,
  })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const admin = createServiceClient()
  if (session.mode !== 'subscription') return
  if (!session.customer) return
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id
  // Attach customer_id on profile
  if (session.customer_email) {
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('email', session.customer_email)
  }
  // Attribute referral from metadata if present
  const referralCode = session.metadata?.referral_code as string | undefined
  const userId = (session.metadata?.mukti_user_id as string | undefined) ??
    await resolveUserIdFromCustomer(customerId)
  if (referralCode && userId) {
    const { data: referrer } = await admin.from('profiles').select('id').eq('referral_code', referralCode).maybeSingle()
    if (referrer) {
      await admin.from('referrals_v4').upsert({
        referrer_id: (referrer as { id: string }).id,
        referred_id: userId,
        cookie_hit_at: new Date().toISOString(),
        signup_at: new Date().toISOString(),
        status: 'pending',
      }, { onConflict: 'referrer_id,referred_id' })
      await admin.from('profiles').update({ referred_by: (referrer as { id: string }).id }).eq('id', userId)
    }
  }
  // Upsert subscription
  if (session.subscription) {
    const stripe = getStripe()
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
    const sub = await stripe.subscriptions.retrieve(subId)
    await handleSubscriptionUpsert(sub)
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const admin = createServiceClient()
  if (!invoice.id || !invoice.customer) return
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id
  const userId = await resolveUserIdFromCustomer(customerId)
  if (!userId) return
  const amount = invoice.amount_paid ?? invoice.total ?? 0
  if (amount <= 0) return
  // Idempotence on invoice-level : check existing by stripe_invoice_id
  const { data: existing } = await admin.from('payments').select('id, split_applied').eq('stripe_invoice_id', invoice.id).maybeSingle()
  if ((existing as { split_applied: boolean } | null)?.split_applied) return
  // Compute split
  const splitUser = Math.floor((amount * WEALTH_SPLIT_PCT.users_pool) / 100)
  const splitAsso = Math.floor((amount * WEALTH_SPLIT_PCT.asso_purama) / 100)
  const splitSasu = amount - splitUser - splitAsso
  // Insert payment (or update existing)
  const { data: inserted } = await admin.from('payments').upsert({
    user_id: userId,
    stripe_invoice_id: invoice.id,
    amount_cents: amount,
    currency: invoice.currency ?? 'eur',
    split_user_cents: splitUser,
    split_asso_cents: splitAsso,
    split_sasu_cents: splitSasu,
    split_applied: true,
    status: 'paid',
    paid_at: new Date().toISOString(),
  }, { onConflict: 'stripe_invoice_id' }).select('id').maybeSingle()
  const paymentId = (inserted as { id: string } | null)?.id
  // Check if first payment
  const { count: prevPayments } = await admin
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'paid')
    .neq('stripe_invoice_id', invoice.id)
  const isFirstPayment = (prevPayments ?? 0) === 0
  if (isFirstPayment) {
    await recordMagicMoment({ userId, kind: 'first_payment' })
  }
  // Credit referrer V4
  if (paymentId) {
    const credited = await creditReferrerOnPayment({
      referredUserId: userId,
      paymentAmountCents: amount,
      paymentId,
      isFirstPayment,
    })
    if (credited.credited) {
      const { data: refRow } = await admin
        .from('referrals_v4').select('referrer_id').eq('referred_id', userId).maybeSingle()
      if (refRow) {
        const referrerId = (refRow as { referrer_id: string }).referrer_id
        await checkLifetimeCardEligibility(referrerId)
        await upgradeTierIfEligible(referrerId)
        await recordMagicMoment({ userId: referrerId, kind: 'referral_success' })
      }
    }
  }
  // Feed weekly contest pool (6% CA)
  let weekly = await getCurrentContest('weekly')
  if (!weekly) {
    const now = new Date()
    const dow = now.getUTCDay()
    const start = new Date(now); start.setUTCDate(now.getUTCDate() - dow); start.setUTCHours(0, 0, 0, 0)
    const end = new Date(start); end.setUTCDate(start.getUTCDate() + 7)
    weekly = await ensureContest('weekly', start, end)
  }
  const weeklyCfg = CONTEST_PERIODS.find(p => p.id === 'weekly')!
  await addToPool(weekly.id, Math.floor((splitUser * weeklyCfg.pct_ca) / 50)) // 6% du CA = 12% du splitUser (50%)
  // Actually simpler : use splitUser * (weekly.pct_ca / users_pool_pct) ratio
}

async function handleConnectAccountUpdated(account: Stripe.Account) {
  const admin = createServiceClient()
  const userId = account.metadata?.mukti_user_id as string | undefined
  if (!userId) return
  await admin.from('stripe_connect_accounts').upsert({
    user_id: userId,
    stripe_account_id: account.id,
    onboarding_complete: account.details_submitted ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    charges_enabled: account.charges_enabled ?? false,
    kyc_status: account.details_submitted && account.payouts_enabled ? 'verified' : 'pending',
    country: account.country ?? 'FR',
  }, { onConflict: 'user_id' })
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Signature manquante.' }, { status: 400 })
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = verifyWebhookSignature(raw, sig)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Signature invalide.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  // Idempotence
  const fresh = await markProcessed(event.id, event.type)
  if (!fresh) return NextResponse.json({ received: true, idempotent: true })
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      case 'account.updated':
        await handleConnectAccountUpdated(event.data.object as Stripe.Account)
        break
      default:
        break
    }
    return NextResponse.json({ received: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur webhook.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
