// POST /api/boucle-urgence/complete — clôture une session Boucle Urgence (idempotent)
// Rate 60/h. Ownership RLS. Renvoie { ok, stats }.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { completeBoucleUrgenceSession } from '@/lib/boucle-urgence'
import { BOUCLE_URGENCE_MAX_DURATION_SEC } from '@/lib/boucle-urgence-utils'

export const runtime = 'nodejs'
export const maxDuration = 10

const CompleteSchema = z.object({
  session_id: z.string().uuid(),
  outcome: z.enum(['completed', 'interrupted']),
  duration_sec: z.number().min(0).max(BOUCLE_URGENCE_MAX_DURATION_SEC + 5),
  haptic_used: z.boolean().optional(),
  words_shown: z.number().int().min(0).max(999).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour enregistrer la boucle.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`boucle-urgence:complete:${user.id}:${ip}`, 60, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Respire — réessaie dans ${rl.retryAfterSec}s.` },
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

  const result = await completeBoucleUrgenceSession(parsed.data)
  if ('error' in result) {
    const status = result.error.includes('Connexion')
      ? 401
      : result.error.includes('introuvable') || result.error.includes('invalide')
        ? 404
        : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result, { status: 200 })
}
