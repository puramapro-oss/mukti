// MUKTI G8.6 — GET / POST /api/admin/missions
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { listMissionsAdmin, createMission } from '@/lib/admin-missions'
import { MISSION_TYPES } from '@/lib/constants'

export const runtime = 'nodejs'

const MissionTypeEnum = z.enum(MISSION_TYPES)

const CreateBody = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9_-]+$/),
  title_fr: z.string().min(2).max(120),
  title_en: z.string().min(2).max(120),
  description_fr: z.string().max(500).nullable().optional(),
  description_en: z.string().max(500).nullable().optional(),
  type: MissionTypeEnum,
  category: z.string().max(60).nullable().optional(),
  reward_points: z.number().int().min(0).optional(),
  reward_amount_cents: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

export async function GET(req: Request) {
  const guard = await requireSuperAdmin(req, { route: 'admin-missions-list' })
  if (!guard.ok) return guard.response
  const missions = await listMissionsAdmin()
  return NextResponse.json({ missions })
}

export async function POST(req: Request) {
  const guard = await requireSuperAdmin(req, { route: 'admin-missions-create', max: 30, windowSec: 60 })
  if (!guard.ok) return guard.response
  const json = await req.json().catch(() => ({}))
  const parsed = CreateBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }
  const result = await createMission(parsed.data, { ip: guard.ip, userAgent: guard.userAgent })
  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? 'Erreur lors de la création.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, mission: result.mission })
}
