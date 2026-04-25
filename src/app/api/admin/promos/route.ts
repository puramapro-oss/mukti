// MUKTI G8.6 — GET / POST /api/admin/promos
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { listPromos, createPromo } from '@/lib/admin-promos'

export const runtime = 'nodejs'

const CreateBody = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Za-z0-9_\-]+$/),
  label: z.string().min(2).max(120),
  discount_type: z.enum(['percent', 'amount']),
  discount_value: z.number().int().positive(),
  duration: z.enum(['once', 'forever', 'repeating']),
  duration_in_months: z.number().int().positive().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  max_redemptions: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
})

export async function GET(req: Request) {
  const guard = await requireSuperAdmin(req, { route: 'admin-promos-list' })
  if (!guard.ok) return guard.response
  const promos = await listPromos()
  return NextResponse.json({ promos })
}

export async function POST(req: Request) {
  const guard = await requireSuperAdmin(req, { route: 'admin-promos-create', max: 30, windowSec: 60 })
  if (!guard.ok) return guard.response
  const json = await req.json().catch(() => ({}))
  const parsed = CreateBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }
  const result = await createPromo(parsed.data, { ip: guard.ip, userAgent: guard.userAgent })
  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? 'Erreur lors de la création.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, promo: result.promo })
}
