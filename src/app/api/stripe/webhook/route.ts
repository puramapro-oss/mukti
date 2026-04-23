import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const service = createServiceClient()
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const item = sub.items.data[0]
  const interval = item?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'

  const { data: profile } = await service
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (!profile) return

  const isActive = sub.status === 'active' || sub.status === 'trialing'

  await service
    .from('profiles')
    .update({
      subscription_plan: isActive ? 'premium' : 'free',
      stripe_subscription_id: sub.id,
      subscription_interval: interval,
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    })
    .eq('id', profile.id)

  await service.from('payments').insert({
    user_id: profile.id,
    stripe_payment_id: sub.id,
    amount: (item?.price.unit_amount ?? 0) / 100,
    currency: item?.price.currency ?? 'eur',
    type: 'subscription',
    status: isActive ? 'succeeded' : 'pending',
    metadata: { sub_status: sub.status, interval },
  })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const service = createServiceClient()
  const stripe = getStripe()

  if (session.mode === 'subscription') {
    if (session.customer && session.customer_email) {
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id
      await service.from('profiles').update({ stripe_customer_id: customerId }).eq('email', session.customer_email)
    }
    if (session.subscription) {
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      const sub = await stripe.subscriptions.retrieve(subId)
      await handleSubscriptionUpsert(sub)
    }
  }

  // Referral commission attribution
  if (session.metadata?.referral_code) {
    const code = session.metadata.referral_code
    const { data: referrer } = await service
      .from('profiles')
      .select('id, wallet_balance')
      .eq('referral_code', code)
      .maybeSingle()
    if (referrer && session.amount_total) {
      // 50% premier paiement
      const commissionEur = (session.amount_total / 100) * 0.5
      const newBalance = Number(referrer.wallet_balance ?? 0) + commissionEur
      await service.from('profiles').update({ wallet_balance: newBalance }).eq('id', referrer.id)
      await service.from('wallet_transactions').insert({
        user_id: referrer.id,
        amount: commissionEur,
        type: 'referral',
        description: `Commission parrainage 50% (${code})`,
      })
      await service.from('notifications').insert({
        user_id: referrer.id,
        type: 'referral',
        title: '🎉 Commission parrainage reçue !',
        body: `Tu viens de gagner ${commissionEur.toFixed(2).replace('.', ',')} € grâce à un filleul.`,
        icon: '💰',
        action_url: '/dashboard/wallet',
      })
    }
  }
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 400 })

  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Bad signature'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpsert(event.data.object)
        break
      default:
        break
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Webhook handler error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
