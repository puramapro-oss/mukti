// POST /api/alt-reality/project — génère une projection "toi libéré dans X jours" (rate 5/h coût Pollinations).
// GET /api/alt-reality/project — liste 10 dernières projections.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createProjection, listProjections } from '@/lib/alt-reality'
import { ALT_REALITY_HORIZONS, type AltRealityHorizon } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 30

const HORIZON_VALUES = ALT_REALITY_HORIZONS.map(h => h.days) as [number, ...number[]]

const ProjectSchema = z.object({
  horizon: z.number().refine(v => (HORIZON_VALUES as readonly number[]).includes(v), {
    message: 'Horizon invalide (7, 30, 90 ou 365 jours).',
  }),
  addiction_id: z.string().uuid().nullable().optional(),
  mood_before: z.number().int().min(1).max(10).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour voir ta version libérée.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`alt-reality:project:${user.id}:${ip}`, 5, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = ProjectSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await createProjection({
    horizon: parsed.data.horizon as AltRealityHorizon,
    addiction_id: parsed.data.addiction_id ?? null,
    mood_before: parsed.data.mood_before,
  })
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ session: result.session }, { status: 201 })
}

export async function GET(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }
  const ip = getClientIp(req)
  const rl = rateLimit(`alt-reality:get:${user.id}:${ip}`, 60, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }
  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? '10')
  const sessions = await listProjections(Number.isFinite(limit) ? limit : 10)
  return NextResponse.json({ sessions })
}
