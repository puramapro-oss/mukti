// POST /api/ar/training/step — enregistre une étape de formation (soin|manifestation 1-5)
// GET  /api/ar/training/step — retourne la progression actuelle du user

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { getTrainingProgress, markTrainingStep } from '@/lib/ar-training'
import { AR_TRAINING_MODES, type ArTrainingMode } from '@/lib/constants'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const StepSchema = z.object({
  mode: z.enum([...AR_TRAINING_MODES] as [ArTrainingMode, ...ArTrainingMode[]]),
  step: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) {
    return NextResponse.json({ error: 'Connexion requise pour sauvegarder ta progression.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`ar:training:step:${profileId}:${ip}`, 20, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = StepSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Étape invalide.' },
      { status: 400 },
    )
  }

  const result = await markTrainingStep(profileId, parsed.data.mode, parsed.data.step)
  if (!result.ok) {
    return NextResponse.json({ error: 'Impossible d\'enregistrer ta progression.' }, { status: 500 })
  }
  const progress = await getTrainingProgress(profileId)
  return NextResponse.json({ ok: true, progress })
}

export async function GET() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }
  const progress = await getTrainingProgress(profileId)
  return NextResponse.json({ ok: true, progress })
}
