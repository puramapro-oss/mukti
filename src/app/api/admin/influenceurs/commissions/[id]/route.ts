// MUKTI G8.6 — PUT /api/admin/influenceurs/commissions/[id] — manual status override
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { updateCommissionStatus } from '@/lib/admin-commissions'

export const runtime = 'nodejs'

const PutBody = z.object({
  status: z.enum(['pending', 'credited', 'paid']),
})

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(req, { route: 'admin-commission-update', max: 60, windowSec: 60 })
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  const json = await req.json().catch(() => ({}))
  const parsed = PutBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }
  const result = await updateCommissionStatus(id, parsed.data.status, { ip: guard.ip, userAgent: guard.userAgent })
  if (!result.ok) {
    const status = result.reason === 'Commission introuvable.' ? 404 : 500
    return NextResponse.json({ error: result.reason ?? 'Erreur.' }, { status })
  }
  return NextResponse.json({ ok: true })
}
