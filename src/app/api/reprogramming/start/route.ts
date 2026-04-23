// POST /api/reprogramming/start — démarre une session reprogrammation (night|day)
// Retourne { session_id, affirmations } où affirmations = 50 items mixés system+custom.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { startSession, isValidMode, isValidNatureSound } from '@/lib/reprogramming'
import { REPROG_CATEGORIES, NATURE_SOUNDS } from '@/lib/constants'
import type { NatureSound } from '@/lib/constants'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 10

const StartSchema = z.object({
  mode: z.string().refine(isValidMode, { message: 'Mode invalide (night ou day).' }),
  category: z.enum(
    (REPROG_CATEGORIES.map((c) => c.id) as unknown) as [string, ...string[]]
  ),
  nature_sound: z
    .enum(
      (NATURE_SOUNDS.map((s) => s.id) as unknown) as [NatureSound, ...NatureSound[]]
    )
    .optional(),
  volume_profile: z.enum(['adaptive', 'fixed']).optional(),
  voice_guidance: z.boolean().optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour démarrer la reprogrammation.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`reprog:start:${user.id}:${ip}`, 30, 3600)
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

  if (parsed.data.nature_sound && !isValidNatureSound(parsed.data.nature_sound)) {
    return NextResponse.json({ error: 'Son nature invalide.' }, { status: 400 })
  }

  const result = await startSession({
    mode: parsed.data.mode as 'night' | 'day',
    category: parsed.data.category as Parameters<typeof startSession>[0]['category'],
    nature_sound: parsed.data.nature_sound,
    volume_profile: parsed.data.volume_profile,
    voice_guidance: parsed.data.voice_guidance,
  })

  if (result.error || !result.session) {
    return NextResponse.json(
      { error: result.error ?? 'Impossible de démarrer la session.' },
      { status: result.error?.includes('authentifié') ? 401 : 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    session_id: result.session.id,
    started_at: result.session.started_at,
    affirmations: result.affirmations.map((a) => ({
      id: a.id,
      text_fr: a.text_fr,
      text_en: a.text_en,
      source: a.source,
    })),
  })
}
