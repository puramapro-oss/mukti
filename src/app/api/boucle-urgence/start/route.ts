// POST /api/boucle-urgence/start — démarre une session Boucle Urgence Invisible
// Rate 60/h. Renvoie { session_id }.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { startBoucleUrgenceSession } from '@/lib/boucle-urgence'
import {
  BOUCLE_URGENCE_MIN_DURATION_SEC,
  BOUCLE_URGENCE_MAX_DURATION_SEC,
} from '@/lib/boucle-urgence-utils'

export const runtime = 'nodejs'
export const maxDuration = 10

const StartSchema = z.object({
  trigger: z.enum(['page', 'shortcut']),
  duration_sec: z
    .number()
    .int()
    .min(BOUCLE_URGENCE_MIN_DURATION_SEC)
    .max(BOUCLE_URGENCE_MAX_DURATION_SEC),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour activer le camouflage.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`boucle-urgence:start:${user.id}:${ip}`, 60, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Pose-toi un instant — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = StartSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await startBoucleUrgenceSession({
    trigger: parsed.data.trigger,
    duration_sec_target: parsed.data.duration_sec,
  })
  if ('error' in result) {
    const status = result.error.includes('Connexion') ? 401 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result, { status: 201 })
}
