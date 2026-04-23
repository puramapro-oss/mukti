// POST /api/circles — création d'un cercle d'intention
// GET  /api/circles?category=&status=open — liste cercles + participant_count

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createCircle, listOpenCircles, type CircleStatus } from '@/lib/circles'
import {
  CIRCLE_CATEGORIES,
  CIRCLE_GUIDANCE_MODES,
  CIRCLE_ROTATION_MODES,
  type CircleCategoryId,
  type CircleGuidanceMode,
  type CircleRotationMode,
} from '@/lib/constants'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15

const CATEGORY_IDS = CIRCLE_CATEGORIES.map((c) => c.id) as [string, ...string[]]
const GUIDANCE_IDS = CIRCLE_GUIDANCE_MODES.map((g) => g.id) as [string, ...string[]]
const ROTATION_IDS = CIRCLE_ROTATION_MODES.map((r) => r.id) as [string, ...string[]]

const CreateBodySchema = z.object({
  category: z.enum(CATEGORY_IDS),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(600).optional(),
  max_participants: z.number().int().min(2).max(5000),
  duration_per_person_sec: z.number().int().min(60).max(900).optional(),
  rotation_mode: z.enum(ROTATION_IDS).optional(),
  guidance_mode: z.enum(GUIDANCE_IDS).optional(),
  selected_phrase_ids: z.array(z.string().uuid()).max(30).optional(),
  recording_enabled: z.boolean().optional(),
  auto_start_when_full: z.boolean().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise pour créer un cercle.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`circles:create:${ip}`, 10, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = CreateBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides.' },
      { status: 400 },
    )
  }

  try {
    const circle = await createCircle({
      category: parsed.data.category as CircleCategoryId,
      title: parsed.data.title,
      description: parsed.data.description,
      max_participants: parsed.data.max_participants,
      duration_per_person_sec: parsed.data.duration_per_person_sec,
      rotation_mode: parsed.data.rotation_mode as CircleRotationMode | undefined,
      guidance_mode: parsed.data.guidance_mode as CircleGuidanceMode | undefined,
      selected_phrase_ids: parsed.data.selected_phrase_ids,
      recording_enabled: parsed.data.recording_enabled,
      auto_start_when_full: parsed.data.auto_start_when_full,
      scheduled_at: parsed.data.scheduled_at ?? null,
    })
    return NextResponse.json(
      {
        ok: true,
        circle,
        message: 'Ton cercle est ouvert. Les âmes compatibles vont le rejoindre.',
      },
      { status: 201 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur création cercle.'
    return NextResponse.json({ error: humanizeError(msg) }, { status: 400 })
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const categoryParam = url.searchParams.get('category')
  const statusParam = url.searchParams.get('status')
  const limitParam = url.searchParams.get('limit')

  const category = categoryParam && CATEGORY_IDS.includes(categoryParam as (typeof CATEGORY_IDS)[number])
    ? (categoryParam as CircleCategoryId)
    : undefined

  const statuses = statusParam
    ? (statusParam.split(',').filter((s) => ['open', 'live', 'finished', 'cancelled'].includes(s)) as CircleStatus[])
    : (['open', 'live'] as CircleStatus[])

  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50)) : 50

  try {
    const list = await listOpenCircles({ category, status: statuses, limit })
    return NextResponse.json({ ok: true, circles: list })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur chargement cercles.'
    return NextResponse.json({ error: humanizeError(msg) }, { status: 500 })
  }
}

function humanizeError(msg: string): string {
  if (msg.includes('MUKTI_NOT_AUTHENTICATED')) return 'Connecte-toi pour continuer.'
  if (msg.includes('MUKTI_CIRCLE_FULL')) return 'Ce cercle est complet. Essaie-en un autre ou crée le tien.'
  if (msg.includes('MUKTI_CIRCLE_NOT_FOUND')) return 'Ce cercle n\'existe plus.'
  return 'Une erreur est survenue. Réessaie dans un instant.'
}
