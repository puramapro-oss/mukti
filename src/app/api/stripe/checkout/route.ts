import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { createCheckoutSession } from '@/lib/stripe'
import { APP_URL } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 15

const BodySchema = z.object({
  interval: z.enum(['monthly', 'yearly']),
  referral_code: z.string().max(40).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, stripe_customer_id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })

  if (profile.role === 'super_admin') {
    return NextResponse.json({ error: 'Tu as déjà accès illimité (super admin).' }, { status: 400 })
  }

  try {
    const session = await createCheckoutSession({
      customerId: profile.stripe_customer_id ?? undefined,
      customerEmail: profile.email ?? user.email ?? undefined,
      plan: 'premium',
      interval: parsed.data.interval,
      successUrl: `${APP_URL}/dashboard?welcome=premium`,
      cancelUrl: `${APP_URL}/pricing`,
      referralCode: parsed.data.referral_code,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur Stripe'
    return NextResponse.json({ error: 'Stripe indisponible : ' + msg }, { status: 502 })
  }
}
