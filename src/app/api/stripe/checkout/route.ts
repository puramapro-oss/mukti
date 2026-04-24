// MUKTI — G7 Checkout : 3 plans Stripe + promo codes + referral
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { ensureCustomer, createSubscriptionCheckoutV7 } from '@/lib/stripe'
import { APP_URL, PLAN_SLUGS } from '@/lib/constants'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15

const BodySchema = z.object({
  plan_slug: z.enum(PLAN_SLUGS),
  promo_code: z.string().min(2).max(40).optional().nullable(),
  referral_code: z.string().min(2).max(40).optional().nullable(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`stripe:checkout:${user.id}`, 10, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives. Réessaie plus tard.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }
  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, full_name, stripe_customer_id, role, current_plan_slug')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })
  const p = profile as { id: string; email: string | null; full_name: string | null; stripe_customer_id: string | null; role: string; current_plan_slug: string | null }
  if (p.role === 'super_admin') {
    return NextResponse.json({ error: 'Tu as déjà un accès illimité (super admin).' }, { status: 400 })
  }
  if (parsed.data.plan_slug === 'anti_churn' && !p.current_plan_slug) {
    return NextResponse.json({ error: 'Le plan anti-churn n\'est proposé qu\'au moment de la résiliation.' }, { status: 400 })
  }
  try {
    const customerId = await ensureCustomer({
      userId: p.id,
      email: p.email ?? user.email ?? '',
      fullName: p.full_name,
      existingCustomerId: p.stripe_customer_id,
    })
    if (customerId !== p.stripe_customer_id) {
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', p.id)
    }
    const session = await createSubscriptionCheckoutV7({
      planSlug: parsed.data.plan_slug,
      customerId,
      successUrl: `${APP_URL}/confirmation?plan=${parsed.data.plan_slug}`,
      cancelUrl: `${APP_URL}/pricing`,
      promoCode: parsed.data.promo_code ?? null,
      referralCode: parsed.data.referral_code ?? null,
      userId: p.id,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur Stripe'
    return NextResponse.json({ error: 'Paiement indisponible : ' + msg }, { status: 502 })
  }
}
