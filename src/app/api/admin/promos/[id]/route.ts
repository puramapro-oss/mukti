// MUKTI G8.6 — GET / PUT / DELETE /api/admin/promos/[id]
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { getPromo, updatePromo, deletePromo } from '@/lib/admin-promos'

export const runtime = 'nodejs'

const PutBody = z.object({
  label: z.string().min(2).max(120).optional(),
  discount_type: z.enum(['percent', 'amount']).optional(),
  discount_value: z.number().int().positive().optional(),
  duration: z.enum(['once', 'forever', 'repeating']).optional(),
  duration_in_months: z.number().int().positive().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  max_redemptions: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
})

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(req, { route: 'admin-promo-get' })
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  const promo = await getPromo(id)
  if (!promo) return NextResponse.json({ error: 'Code promo introuvable.' }, { status: 404 })
  return NextResponse.json({ promo })
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(req, { route: 'admin-promo-update', max: 60, windowSec: 60 })
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  const json = await req.json().catch(() => ({}))
  const parsed = PutBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }
  const result = await updatePromo(id, parsed.data, { ip: guard.ip, userAgent: guard.userAgent })
  if (!result.ok) {
    const status = result.reason === 'Code promo introuvable.' ? 404 : 500
    return NextResponse.json({ error: result.reason ?? 'Erreur.' }, { status })
  }
  return NextResponse.json({ ok: true, promo: result.promo })
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(req, { route: 'admin-promo-delete', max: 30, windowSec: 60 })
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  const result = await deletePromo(id, { ip: guard.ip, userAgent: guard.userAgent })
  if (!result.ok) {
    const status = result.reason === 'Code promo introuvable.' ? 404 : 500
    return NextResponse.json({ error: result.reason ?? 'Erreur.' }, { status })
  }
  return NextResponse.json({ ok: true })
}
