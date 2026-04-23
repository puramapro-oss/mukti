// PATCH /api/aurora/session/[id]/complete
// Complète une session AURORA + met à jour aurora_streaks.
// Auth SSR + Zod. Retourne { ok, level_reached, streak_days }.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { dbCompleteSession, resolveProfileIdAurora } from '@/lib/aurora'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const PHASE_NAMES = ['armement', 'double_sigh', 'resonance_core', 'omega_lock', 'glide_out'] as const

const CompleteSchema = z.object({
  phases_completed: z
    .array(
      z.object({
        phase: z.enum(PHASE_NAMES),
        duration_sec: z.number().min(0).max(1800),
        breaths_counted: z.number().int().min(0).max(500),
        coherence: z.number().min(0).max(1).nullable(),
      })
    )
    .min(1)
    .max(5),
  coherence_score: z.number().min(0).max(1),
  stopped_reason: z.enum([
    'user_stop',
    'dizzy',
    'glide_out_complete',
    'timeout',
    'error',
  ]),
  total_duration_sec: z.number().min(0).max(1800),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  }

  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileIdAurora(sb)
  if (!profileId) {
    return NextResponse.json(
      { error: 'Connexion requise pour compléter la session.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`aurora:complete:${profileId}:${ip}`, 60, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = CompleteSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await dbCompleteSession({
    session_id: id,
    user_id: profileId,
    phases_completed: parsed.data.phases_completed,
    coherence_score: parsed.data.coherence_score,
    stopped_reason: parsed.data.stopped_reason,
    total_duration_sec: parsed.data.total_duration_sec,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? 'Impossible de compléter la session.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    level_reached: result.level_reached,
    streak_days: result.streak_days,
  })
}
