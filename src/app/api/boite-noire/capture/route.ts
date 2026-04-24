// POST /api/boite-noire/capture — enregistre un déclencheur dans la Boîte Noire.
// Rate 60/h. Ownership addiction_id → profileId via captureEntry().

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { captureEntry } from '@/lib/boite-noire'
import { BOITE_NOIRE_LOCATIONS, BOITE_NOIRE_WHO } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 10

const LocationEnum = z.enum(
  BOITE_NOIRE_LOCATIONS.map(l => l.id) as [string, ...string[]]
)
const WhoEnum = z.enum(BOITE_NOIRE_WHO.map(w => w.id) as [string, ...string[]])

const CaptureSchema = z.object({
  addiction_id: z.string().uuid(),
  location_hint: LocationEnum.nullable().optional(),
  who_context: WhoEnum.nullable().optional(),
  what_trigger: z.string().min(2).max(500),
  emotion: z.string().max(30).nullable().optional(),
  intensity: z.number().int().min(1).max(10),
  resisted: z.boolean().optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour capturer ton déclencheur.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`boite-noire:capture:${user.id}:${ip}`, 60, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Respire — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = CaptureSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await captureEntry({
    addiction_id: parsed.data.addiction_id,
    location_hint: (parsed.data.location_hint ?? null) as
      | (typeof BOITE_NOIRE_LOCATIONS)[number]['id']
      | null,
    who_context: (parsed.data.who_context ?? null) as
      | (typeof BOITE_NOIRE_WHO)[number]['id']
      | null,
    what_trigger: parsed.data.what_trigger,
    emotion: parsed.data.emotion ?? null,
    intensity: parsed.data.intensity,
    resisted: parsed.data.resisted ?? false,
  })

  if (result.error) {
    const status = result.error.includes('authentifié')
      ? 401
      : result.error.includes('introuvable')
        ? 404
        : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ entry: result.entry }, { status: 201 })
}
