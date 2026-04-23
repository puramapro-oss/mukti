// POST /api/rituel-7s/start — démarre une session Rituel 7 Secondes
// Rate 120/h (micro-rituel fréquent OK). Renvoie { session_id, affirmation_text }.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { startRituel7sSession } from '@/lib/rituel-7s'

export const runtime = 'nodejs'
export const maxDuration = 10

const StartSchema = z.object({
  trigger: z.enum(['button', 'shortcut', 'page']),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour lancer le rituel.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`rituel7s:start:${user.id}:${ip}`, 120, 3600)
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

  const result = await startRituel7sSession({ trigger: parsed.data.trigger })
  if ('error' in result) {
    const status = result.error.includes('Connexion') ? 401 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result, { status: 201 })
}
