// POST /api/ar/sessions/[id]/complete — clôture une session AR (durée + intensité)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { completeSession, resolveProfileId } from '@/lib/ar'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const CompleteSchema = z.object({
  duration_sec: z.number().int().min(0).max(7200),
  intensity_1_5: z.number().int().min(1).max(5).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Session introuvable.' }, { status: 400 })
  }

  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`ar:sessions:complete:${profileId}:${ip}`, 60, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = CompleteSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides.' },
      { status: 400 },
    )
  }

  const result = await completeSession({
    session_id: id,
    user_id: profileId,
    duration_sec: parsed.data.duration_sec,
    intensity_1_5: parsed.data.intensity_1_5 ?? null,
    metadata: parsed.data.metadata ?? {},
  })

  if (!result.ok) {
    return NextResponse.json({ error: 'Impossible de clôturer la session.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, session: result.session })
}
