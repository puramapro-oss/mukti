// POST /api/exorcisme/affirmation — génère affirmation contextuelle via Haiku 4.5 (+ fallback).
// Rate 10/h (cost-protect Anthropic). Persiste dans sensor_data de la session.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { generateReprogAffirmation } from '@/lib/exorcisme'
import { EXORCISME_MAX_TEXT_LENGTH } from '@/lib/exorcisme-utils'

export const runtime = 'nodejs'
export const maxDuration = 30

const Schema = z.object({
  session_id: z.string().uuid(),
  possession_text: z.string().min(1).max(EXORCISME_MAX_TEXT_LENGTH * 2),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour générer l\'affirmation.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`exorcisme:affirmation:${user.id}:${ip}`, 10, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Le générateur est en pause — réessaie dans ${rl.retryAfterSec}s.`,
      },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = Schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await generateReprogAffirmation(parsed.data)
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
