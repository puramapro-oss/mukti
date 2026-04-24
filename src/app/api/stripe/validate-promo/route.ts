// MUKTI — G7 Valide un code promo avant checkout
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const BodySchema = z.object({
  code: z.string().min(2).max(40),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`validate-promo:${user.id}`, 30, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Code invalide.' }, { status: 400 })
  const admin = createServiceClient()
  const { data } = await admin
    .from('promos')
    .select('code, label, discount_type, discount_value, duration, valid_until, active, max_redemptions, redemptions_count')
    .eq('code', parsed.data.code.toUpperCase())
    .eq('active', true)
    .maybeSingle()
  if (!data) return NextResponse.json({ error: 'Code promo inconnu ou expiré.' }, { status: 404 })
  const promo = data as {
    code: string; label: string; discount_type: string; discount_value: number;
    duration: string; valid_until: string | null; active: boolean;
    max_redemptions: number | null; redemptions_count: number;
  }
  if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
    return NextResponse.json({ error: 'Code promo expiré.' }, { status: 410 })
  }
  if (promo.max_redemptions && promo.redemptions_count >= promo.max_redemptions) {
    return NextResponse.json({ error: 'Code promo épuisé.' }, { status: 410 })
  }
  return NextResponse.json({
    ok: true,
    code: promo.code,
    label: promo.label,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    duration: promo.duration,
  })
}
