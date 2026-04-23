// POST /api/streak/checkin
// Check-in quotidien d'une addiction. Idempotent sous 20h. Peut débloquer palier wallet.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkinDaily } from '@/lib/streaks'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 20

const BodySchema = z.object({
  addiction_id: z.string().uuid('ID addiction invalide.'),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`streak:checkin:${ip}:${user.id}`, 10, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Trop de check-ins — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides.' },
      { status: 400 },
    )
  }

  const { data: addiction } = await sb
    .from('addictions')
    .select('id, status')
    .eq('id', parsed.data.addiction_id)
    .maybeSingle()

  if (!addiction) {
    return NextResponse.json({ error: 'Addiction introuvable.' }, { status: 404 })
  }
  if (addiction.status !== 'active') {
    return NextResponse.json(
      { error: 'Cette addiction n\'est pas active — réactive-la avant de faire un check-in.' },
      { status: 409 },
    )
  }

  const result = await checkinDaily(parsed.data.addiction_id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    streak: result.streak,
    incremented: result.incremented,
    milestone_granted: result.milestone_granted,
    message: result.milestone_granted
      ? `🎉 Palier ${result.milestone_granted} atteint — ta prime arrive dans ton wallet !`
      : result.incremented
        ? `Bravo. Jour ${result.streak?.current_days} de libération.`
        : 'Tu as déjà checké aujourd\'hui. Reviens demain 🌱',
  })
}
