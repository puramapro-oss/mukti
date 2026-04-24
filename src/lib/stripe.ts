import Stripe from 'stripe'

let _stripe: Stripe | null = null
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    })
  }
  return _stripe
}

export const VIDA_AIDE_STRIPE_PLANS = {
  premium: {
    monthly_cents: 999,
    yearly_cents: 8390, // -30%
    first_month_discount_percent: 10,
    label: 'MUKTI Premium',
    trial_days: 14,
  },
} as const

export type VidaAidePlanId = keyof typeof VIDA_AIDE_STRIPE_PLANS

export async function createCheckoutSession(params: {
  customerId?: string
  customerEmail?: string
  plan: VidaAidePlanId
  interval: 'monthly' | 'yearly'
  successUrl: string
  cancelUrl: string
  referralCode?: string
  trialDays?: number
}) {
  const stripe = getStripe()
  const planCfg = VIDA_AIDE_STRIPE_PLANS[params.plan]
  const amount = params.interval === 'monthly' ? planCfg.monthly_cents : planCfg.yearly_cents

  return stripe.checkout.sessions.create({
    customer: params.customerId,
    customer_email: params.customerId ? undefined : params.customerEmail,
    mode: 'subscription',
    payment_method_types: ['card', 'paypal', 'link'],
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: planCfg.label,
            description:
              "Récupère TOUT l'argent que tu laisses sur la table — aides sociales, optimisation fiscale, droits oubliés. MUKTI fait les démarches pour toi.",
          },
          recurring: { interval: params.interval === 'monthly' ? 'month' : 'year' },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: params.trialDays ?? planCfg.trial_days,
      metadata: {
        plan: params.plan,
        interval: params.interval,
        ...(params.referralCode ? { referral_code: params.referralCode } : {}),
      },
    },
    metadata: {
      plan: params.plan,
      interval: params.interval,
      ...(params.referralCode ? { referral_code: params.referralCode } : {}),
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  })
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  const stripe = getStripe()
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}

// ============================================================
// G7 — Économie KARMA : 3 plans officiels + anti-churn
// ============================================================
import { PLANS_STRIPE, type PlanSlug } from './constants'

export async function ensureCustomer(params: {
  userId: string
  email: string
  fullName?: string | null
  existingCustomerId?: string | null
}): Promise<string> {
  const stripe = getStripe()
  if (params.existingCustomerId) {
    try {
      const c = await stripe.customers.retrieve(params.existingCustomerId)
      if (!c.deleted) return params.existingCustomerId
    } catch { /* fallthrough */ }
  }
  const created = await stripe.customers.create({
    email: params.email,
    name: params.fullName ?? undefined,
    metadata: { mukti_user_id: params.userId },
  })
  return created.id
}

export async function createSubscriptionCheckoutV7(params: {
  planSlug: PlanSlug
  customerId: string
  successUrl: string
  cancelUrl: string
  promoCode?: string | null
  referralCode?: string | null
  userId: string
}) {
  const stripe = getStripe()
  const cfg = PLANS_STRIPE[params.planSlug]
  const isTrial = cfg.trial_days > 0
  return stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: 'subscription',
    payment_method_types: ['card', 'paypal', 'link'],
    allow_promotion_codes: !params.promoCode,
    discounts: params.promoCode ? [{ coupon: params.promoCode }] : undefined,
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: cfg.label_fr },
        recurring: { interval: cfg.interval },
        unit_amount: cfg.price_cents,
      },
      quantity: 1,
    }],
    subscription_data: {
      trial_period_days: isTrial ? cfg.trial_days : undefined,
      metadata: {
        plan_slug: params.planSlug,
        mukti_user_id: params.userId,
        ...(params.referralCode ? { referral_code: params.referralCode } : {}),
      },
    },
    metadata: {
      plan_slug: params.planSlug,
      mukti_user_id: params.userId,
      ...(params.promoCode ? { promo_code: params.promoCode } : {}),
      ...(params.referralCode ? { referral_code: params.referralCode } : {}),
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  })
}

export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string) {
  const stripe = getStripe()
  return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
}

export async function switchSubscriptionToAntiChurn(subscriptionId: string) {
  const stripe = getStripe()
  const cfg = PLANS_STRIPE.anti_churn
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const itemId = sub.items.data[0]?.id
  if (!itemId) throw new Error('Subscription item introuvable.')
  return stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: itemId,
      price_data: {
        currency: 'eur',
        product: sub.items.data[0]!.price.product as string,
        recurring: { interval: cfg.interval },
        unit_amount: cfg.price_cents,
      },
    }],
    cancel_at_period_end: false,
    metadata: { ...(sub.metadata ?? {}), plan_slug: 'anti_churn', anti_churn_at: String(Date.now()) },
    proration_behavior: 'none',
  })
}

export async function listCustomerInvoices(customerId: string, limit = 24) {
  const stripe = getStripe()
  const res = await stripe.invoices.list({ customer: customerId, limit })
  return res.data
}

export function verifyWebhookSignature(rawBody: string, sig: string) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET absent.')
  return stripe.webhooks.constructEvent(rawBody, sig, secret)
}
