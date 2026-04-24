// POST /api/minimal-ritual/tick — valide une micro-habitude du jour (rate 60/h).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { tickHabit } from '@/lib/minimal-ritual'
import { MINIMAL_RITUAL_HABITS } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 10

const HabitEnum = z.enum(
  MINIMAL_RITUAL_HABITS.map(h => h.slug) as [string, ...string[]]
)

const TickSchema = z.object({
  habit_slug: HabitEnum,
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour valider ta micro-habitude.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`minimal:tick:${user.id}:${ip}`, 60, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = TickSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Habitude invalide.' },
      { status: 400 }
    )
  }

  const result = await tickHabit(parsed.data.habit_slug)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ticked: result.ticked, already: result.already })
}
