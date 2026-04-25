// MUKTI G8.6 — GET / PUT / DELETE /api/admin/missions/[id]
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { getMissionAdmin, updateMission, deleteMission } from '@/lib/admin-missions'
import { MISSION_TYPES } from '@/lib/constants'

export const runtime = 'nodejs'

const MissionTypeEnum = z.enum(MISSION_TYPES)

const PutBody = z.object({
  title_fr: z.string().min(2).max(120).optional(),
  title_en: z.string().min(2).max(120).optional(),
  description_fr: z.string().max(500).nullable().optional(),
  description_en: z.string().max(500).nullable().optional(),
  type: MissionTypeEnum.optional(),
  category: z.string().max(60).nullable().optional(),
  reward_points: z.number().int().min(0).optional(),
  reward_amount_cents: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(req, { route: 'admin-mission-get' })
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  const mission = await getMissionAdmin(id)
  if (!mission) return NextResponse.json({ error: 'Mission introuvable.' }, { status: 404 })
  return NextResponse.json({ mission })
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(req, { route: 'admin-mission-update', max: 60, windowSec: 60 })
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  const json = await req.json().catch(() => ({}))
  const parsed = PutBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }
  const result = await updateMission(id, parsed.data, { ip: guard.ip, userAgent: guard.userAgent })
  if (!result.ok) {
    const status = result.reason === 'Mission introuvable.' ? 404 : 500
    return NextResponse.json({ error: result.reason ?? 'Erreur.' }, { status })
  }
  return NextResponse.json({ ok: true, mission: result.mission })
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(req, { route: 'admin-mission-delete', max: 30, windowSec: 60 })
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  const result = await deleteMission(id, { ip: guard.ip, userAgent: guard.userAgent })
  if (!result.ok) {
    const status = result.reason === 'Mission introuvable.' ? 404 : 500
    return NextResponse.json({ error: result.reason ?? 'Erreur.' }, { status })
  }
  return NextResponse.json({ ok: true })
}
