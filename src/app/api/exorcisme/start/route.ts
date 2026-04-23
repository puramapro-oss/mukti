// POST /api/exorcisme/start — démarre une séance Exorcisme.
// Rate 20/h (séance lourde, pas besoin d'en cumuler). Renvoie { session_id, possession_text }.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { startExorcismeSession } from '@/lib/exorcisme'
import {
  EXORCISME_MIN_TEXT_LENGTH,
  EXORCISME_MAX_TEXT_LENGTH,
} from '@/lib/exorcisme-utils'

export const runtime = 'nodejs'
export const maxDuration = 10

const StartSchema = z.object({
  possession_text: z
    .string()
    .min(EXORCISME_MIN_TEXT_LENGTH)
    .max(EXORCISME_MAX_TEXT_LENGTH * 2), // tolérance input, clamp côté server
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour démarrer la séance.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`exorcisme:start:${user.id}:${ip}`, 20, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Une séance à la fois — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = StartSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Nomme ce qui te possède.' },
      { status: 400 }
    )
  }

  const result = await startExorcismeSession({ possession_text: parsed.data.possession_text })
  if ('error' in result) {
    const status = result.error.includes('Connexion') ? 401 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result, { status: 201 })
}
