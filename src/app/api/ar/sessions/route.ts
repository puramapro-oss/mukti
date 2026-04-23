// POST /api/ar/sessions — démarre une session AR (soin/manifestation/ceremony/training)
// GET  /api/ar/sessions — historique propre user (30 dernières)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createSession, listSessionHistory, resolveProfileId } from '@/lib/ar'
import { AR_SESSION_MODES, AR_SPECIES_SLUGS } from '@/lib/constants'
import type { ArSessionMode, ArSpeciesSlug } from '@/lib/constants'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const StartSchema = z.object({
  mode: z.enum([...AR_SESSION_MODES] as [ArSessionMode, ...ArSessionMode[]]),
  species_slug: z.enum([...AR_SPECIES_SLUGS] as [ArSpeciesSlug, ...ArSpeciesSlug[]]).optional(),
  beacon_slug: z
    .string()
    .regex(/^[a-z0-9_]{2,64}$/)
    .optional(),
  ceremony_id: z.string().uuid().optional(),
  fallback_imaginary: z.boolean().optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) {
    return NextResponse.json({ error: 'Connexion requise pour démarrer une session.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`ar:sessions:start:${profileId}:${ip}`, 30, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = StartSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 },
    )
  }

  const result = await createSession({
    user_id: profileId,
    mode: parsed.data.mode,
    species_slug: parsed.data.species_slug ?? null,
    beacon_slug: parsed.data.beacon_slug ?? null,
    ceremony_id: parsed.data.ceremony_id ?? null,
    fallback_imaginary: parsed.data.fallback_imaginary ?? false,
  })
  if (!result.ok) {
    return NextResponse.json({ error: 'Impossible de démarrer la session.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, session: result.session })
}

export async function GET() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }
  const sessions = await listSessionHistory(profileId, 30)
  return NextResponse.json({ ok: true, sessions })
}
