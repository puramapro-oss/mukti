// POST /api/rituel-7s/complete — clôture une session Rituel 7 Secondes
// Rate 120/h. Renvoie streak mis à jour.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { completeRituel7sSession, RITUEL_7S_MAX_DURATION_SEC } from '@/lib/rituel-7s'

export const runtime = 'nodejs'
export const maxDuration = 10

const CompleteSchema = z.object({
  session_id: z.string().uuid({ message: 'Session invalide.' }),
  outcome: z.enum(['completed', 'interrupted']),
  duration_sec: z.number().min(0).max(RITUEL_7S_MAX_DURATION_SEC),
  phase_durations_ms: z.array(z.number().min(0).max(10000)).max(4).optional(),
  haptic_used: z.boolean().optional(),
  audio_used: z.boolean().optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour enregistrer le rituel.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`rituel7s:complete:${user.id}:${ip}`, 120, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Pose-toi un instant — réessaie dans ${rl.retryAfterSec}s.` },
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

  const result = await completeRituel7sSession(parsed.data)
  if ('error' in result) {
    const status = result.error.includes('Connexion')
      ? 401
      : result.error.includes('introuvable')
      ? 404
      : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result, { status: 200 })
}
