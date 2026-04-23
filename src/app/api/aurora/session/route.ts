// POST /api/aurora/session — démarre une session AURORA OMEGA
// Auth SSR + Zod + rate-limit. Retourne { ok, session_id }.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { dbCreateSession, isValidVariant, resolveProfileIdAurora } from '@/lib/aurora'
import { AURORA_POWER_SWITCHES } from '@/lib/constants'
import type { AuroraVariant, AuroraPowerSwitch } from '@/lib/constants'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const StartSchema = z.object({
  variant: z
    .string()
    .refine(isValidVariant, { message: 'Variante invalide (calm/focus/sleep/ignite).' }),
  voice_guidance: z.boolean().optional(),
  power_switch: z
    .enum(
      (AURORA_POWER_SWITCHES.map((p) => p.id) as unknown) as [AuroraPowerSwitch, ...AuroraPowerSwitch[]]
    )
    .optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileIdAurora(sb)
  if (!profileId) {
    return NextResponse.json(
      { error: 'Connexion requise pour démarrer AURORA.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`aurora:start:${profileId}:${ip}`, 20, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
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

  const { id, error } = await dbCreateSession({
    user_id: profileId,
    variant: parsed.data.variant as AuroraVariant,
    voice_guidance: parsed.data.voice_guidance ?? false,
    power_switch: parsed.data.power_switch ?? 'core',
  })

  if (error || !id) {
    return NextResponse.json(
      { error: error ?? 'Impossible de démarrer la session.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, session_id: id })
}
