// POST /api/exorcisme/complete — clôture la séance Exorcisme (idempotent).
// Rate 60/h. Ownership RLS. Renvoie { ok, stats }.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { completeExorcismeSession } from '@/lib/exorcisme'
import { EXORCISME_MAX_TEXT_LENGTH } from '@/lib/exorcisme-utils'

export const runtime = 'nodejs'
export const maxDuration = 10

const PhasesSchema = z
  .object({
    invocation: z.number().nonnegative().max(60_000).optional(),
    revelation: z.number().nonnegative().max(10 * 60_000).optional(),
    destruction: z.number().nonnegative().max(10 * 60_000).optional(),
    reprogrammation: z.number().nonnegative().max(60_000).optional(),
    scellement: z.number().nonnegative().max(60_000).optional(),
  })
  .optional()

const CompleteSchema = z.object({
  session_id: z.string().uuid(),
  outcome: z.enum(['completed', 'interrupted']),
  duration_sec: z.number().min(0).max(60 * 15),
  taps_destruction: z.number().int().min(0).max(99).optional(),
  phases_ms: PhasesSchema,
  sealed: z.boolean().optional(),
  affirmation_used: z.string().max(EXORCISME_MAX_TEXT_LENGTH * 4).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour enregistrer la séance.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`exorcisme:complete:${user.id}:${ip}`, 60, 3600)
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

  const result = await completeExorcismeSession(parsed.data)
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
