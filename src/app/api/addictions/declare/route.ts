// POST /api/addictions/declare
// Déclare une addiction pour l'utilisateur authentifié.
// Contraintes : 3 actives max (trigger DB + pré-check), 5/h par IP.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { declareAddictionForCurrentUser } from '@/lib/addictions'
import { ADDICTION_TYPES } from '@/lib/constants'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15

const ADDICTION_TYPE_IDS = ADDICTION_TYPES.map(t => t.id) as [string, ...string[]]

const BodySchema = z.object({
  type: z.enum(ADDICTION_TYPE_IDS),
  severity: z.number().int().min(1).max(5),
  frequency_daily: z.number().int().min(0).max(100).optional(),
  started_ago_months: z.number().int().min(0).max(600).optional(),
  triggers: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  goal: z.enum(['reduce', 'stop']).optional(),
  custom_label: z.string().trim().max(80).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise pour déclarer une libération.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`addictions:declare:${ip}`, 5, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides.' },
      { status: 400 },
    )
  }

  const result = await declareAddictionForCurrentUser({
    type: parsed.data.type as (typeof ADDICTION_TYPES)[number]['id'],
    severity: parsed.data.severity as 1 | 2 | 3 | 4 | 5,
    frequency_daily: parsed.data.frequency_daily,
    started_ago_months: parsed.data.started_ago_months,
    triggers: parsed.data.triggers,
    goal: parsed.data.goal,
    custom_label: parsed.data.custom_label,
  })

  if (result.error || !result.addiction) {
    const status = result.error?.includes('3 libérations') ? 409 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(
    {
      ok: true,
      addiction: result.addiction,
      message: 'Ta libération commence maintenant. Je prépare ton programme personnalisé.',
    },
    { status: 201 },
  )
}
