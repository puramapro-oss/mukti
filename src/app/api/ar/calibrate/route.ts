// POST /api/ar/calibrate — enregistre la calibration skeleton du user
// GET  /api/ar/calibrate — retourne la calibration actuelle (ou null)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCalibration, resolveProfileId, saveCalibration } from '@/lib/ar'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const CalibrationSchema = z.object({
  shoulder_width: z.number().positive().max(2),
  torso_length: z.number().positive().max(2),
  arm_span: z.number().positive().max(3),
  hip_width: z.number().positive().max(2),
  calibration_quality: z.enum(['low', 'medium', 'high']).optional(),
  calibration_frames: z.number().int().min(1).max(1000).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) {
    return NextResponse.json(
      { error: 'Connexion requise pour enregistrer la calibration.' },
      { status: 401 },
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`ar:calibrate:${profileId}:${ip}`, 10, 60)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = CalibrationSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Mesures de calibration invalides.' },
      { status: 400 },
    )
  }

  const result = await saveCalibration({
    user_id: profileId,
    shoulder_width: parsed.data.shoulder_width,
    torso_length: parsed.data.torso_length,
    arm_span: parsed.data.arm_span,
    hip_width: parsed.data.hip_width,
    calibration_quality: parsed.data.calibration_quality ?? 'medium',
    calibration_frames: parsed.data.calibration_frames ?? 30,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: 'Impossible d\'enregistrer la calibration. Réessaie.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, calibration: result.calibration })
}

export async function GET() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }
  const calibration = await getCalibration(profileId)
  return NextResponse.json({ ok: true, calibration })
}
