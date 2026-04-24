// MUKTI — G7 Cancel flow 3 étapes : pause_offer → anti_churn_offer → confirm
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { getActiveSubscription } from '@/lib/subscriptions'
import { cancelSubscriptionAtPeriodEnd, switchSubscriptionToAntiChurn } from '@/lib/stripe'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15

const BodySchema = z.object({
  step: z.enum(['pause_offer', 'anti_churn_offer', 'confirm']),
  action: z.enum(['accept', 'decline']),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`cancel-flow:${profileId}`, 20, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  const sub = await getActiveSubscription()
  if (!sub) return NextResponse.json({ error: 'Aucun abonnement actif.' }, { status: 404 })
  try {
    if (parsed.data.step === 'pause_offer' && parsed.data.action === 'decline') {
      return NextResponse.json({ ok: true, next: 'anti_churn_offer' })
    }
    if (parsed.data.step === 'anti_churn_offer' && parsed.data.action === 'accept') {
      await switchSubscriptionToAntiChurn(sub.stripe_subscription_id)
      return NextResponse.json({ ok: true, switched_to: 'anti_churn' })
    }
    if (parsed.data.step === 'anti_churn_offer' && parsed.data.action === 'decline') {
      return NextResponse.json({ ok: true, next: 'confirm' })
    }
    if (parsed.data.step === 'confirm' && parsed.data.action === 'accept') {
      await cancelSubscriptionAtPeriodEnd(sub.stripe_subscription_id)
      return NextResponse.json({ ok: true, canceled: true })
    }
    if (parsed.data.step === 'pause_offer' && parsed.data.action === 'accept') {
      return NextResponse.json({ ok: true, paused: false, note: 'Pause 1 mois à implémenter via Stripe.' })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
