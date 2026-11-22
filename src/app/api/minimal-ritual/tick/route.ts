// POST /api/minimal-ritual/tick — valide une micro-habitude du jour (rate 60/h).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { tickHabit } from '@/lib/minimal-ritual'
import { MINIMAL_RITUAL_HABITS } from '@/lib/constants/core-events'
import { MINIMAL_RITUAL_PARTICIPATION_MODES } from '@/lib/constants/minimal-ritual'
import { DEFAULT_WELLBEING_TIME_ZONE } from '@/lib/wellbeing-date'

export const runtime = 'nodejs'
export const maxDuration = 10

const HabitEnum = z.enum(
  MINIMAL_RITUAL_HABITS.map(h => h.slug) as [string, ...string[]]
)

const TickSchema = z.object({
  habit_slug: HabitEnum,
  participation_mode: z.enum(MINIMAL_RITUAL_PARTICIPATION_MODES).default('standard'),
}).strict()

export async function POST(req: Request) {
  try {
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
        { error: 'Choisis une micro-habitude et un mode valides.' },
        { status: 400 }
      )
    }

    // The calendar day and owner are computed on the server. This UI uses Europe/Paris.
    const result = await tickHabit(parsed.data.habit_slug, parsed.data.participation_mode, DEFAULT_WELLBEING_TIME_ZONE)
    if (result.error) {
      return NextResponse.json(
        { recorded: false, ticked: false, already: false, error: result.error },
        { status: result.status, headers: { 'Cache-Control': 'private, no-store' } },
      )
    }
    const { status, ...payload } = result
    return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json(
      { recorded: false, ticked: false, already: false, error: 'Enregistrement non confirmé. Réessaie dans un instant.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}
