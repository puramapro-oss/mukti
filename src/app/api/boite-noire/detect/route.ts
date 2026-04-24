// POST /api/boite-noire/detect — détecte le schéma via Claude Haiku 4.5 (batch).
// Rate 10/h (cost-protect). Minimum 5 entries requis.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { detectPatterns } from '@/lib/boite-noire'

export const runtime = 'nodejs'
export const maxDuration = 30

const DetectSchema = z.object({
  addiction_id: z.string().uuid(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour révéler ton schéma.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`boite-noire:detect:${user.id}:${ip}`, 10, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `La détection est en pause — réessaie dans ${rl.retryAfterSec}s.`,
      },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = DetectSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await detectPatterns({ addictionId: parsed.data.addiction_id })
  if (result.error) {
    const status = result.error.includes('authentifié')
      ? 401
      : result.error.includes('5 entrées')
        ? 400
        : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ insight: result.insight }, { status: 200 })
}
