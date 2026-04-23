// POST /api/reprogramming/end — termine une session reprogrammation
// Calcule duration_sec auto + persiste affirmations_played + count.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { endSession } from '@/lib/reprogramming'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 10

const EndSchema = z.object({
  session_id: z.string().uuid(),
  affirmations_played: z.array(z.string()).max(500),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour terminer la session.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`reprog:end:${user.id}:${ip}`, 60, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = EndSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await endSession({
    sessionId: parsed.data.session_id,
    affirmationsPlayed: parsed.data.affirmations_played,
  })

  if (result.error || !result.session) {
    return NextResponse.json(
      { error: result.error ?? 'Impossible de terminer la session.' },
      { status: result.error?.includes('authentifié') ? 401 : 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    duration_sec: result.session.duration_sec,
    affirmations_count: result.session.affirmations_count,
  })
}
