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
