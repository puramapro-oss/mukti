// MUKTI — G7 Subscriptions lifecycle (DB mirror of Stripe truth)

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { resolveProfileId } from './ar'
import type { PlanSlug } from './constants'

export interface MuktiSubscription {
  id: string
  user_id: string
  stripe_subscription_id: string
  stripe_customer_id: string
  plan_slug: PlanSlug
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'
  trial_end: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at: string | null
  canceled_at: string | null
  promo_code: string | null
}

export async function getActiveSubscription(): Promise<MuktiSubscription | null> {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return null
  const { data } = await sb
    .from('subscriptions')
    .select('*')
    .eq('user_id', profileId)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as unknown as MuktiSubscription | null) ?? null
}

export async function getSubscriptionByStripeId(stripeSubId: string): Promise<MuktiSubscription | null> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle()
  return (data as unknown as MuktiSubscription | null) ?? null
}

export async function upsertSubscriptionFromStripe(params: {
  userId: string
  stripeSubscriptionId: string
  stripeCustomerId: string
  planSlug: PlanSlug
  status: MuktiSubscription['status']
  trialEnd: number | null
  currentPeriodStart: number | null
  currentPeriodEnd: number | null
  cancelAt: number | null
  canceledAt: number | null
  promoCode: string | null
}): Promise<void> {
  const admin = createServiceClient()
  const row = {
    user_id: params.userId,
    stripe_subscription_id: params.stripeSubscriptionId,
    stripe_customer_id: params.stripeCustomerId,
    plan_slug: params.planSlug,
    status: params.status,
    trial_end: params.trialEnd ? new Date(params.trialEnd * 1000).toISOString() : null,
    current_period_start: params.currentPeriodStart
      ? new Date(params.currentPeriodStart * 1000).toISOString() : null,
    current_period_end: params.currentPeriodEnd
      ? new Date(params.currentPeriodEnd * 1000).toISOString() : null,
    cancel_at: params.cancelAt ? new Date(params.cancelAt * 1000).toISOString() : null,
    canceled_at: params.canceledAt ? new Date(params.canceledAt * 1000).toISOString() : null,
    promo_code: params.promoCode,
  }
  await admin.from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' })
  // Sync profile.current_plan_slug + stripe_customer_id + stripe_subscription_id
  await admin.from('profiles').update({
    current_plan_slug: params.planSlug,
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    subscription_status: params.status,
  }).eq('id', params.userId)
}

export function computeNextCancelStep(
  currentStep: 'initial' | 'pause_offer' | 'anti_churn_offer',
): 'pause_offer' | 'anti_churn_offer' | 'confirm' {
  if (currentStep === 'initial') return 'pause_offer'
  if (currentStep === 'pause_offer') return 'anti_churn_offer'
  return 'confirm'
}
