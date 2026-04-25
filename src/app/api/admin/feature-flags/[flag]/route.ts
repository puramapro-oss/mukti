// MUKTI G8.6 — PUT /api/admin/feature-flags/[flag]
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { setFeatureFlag } from '@/lib/admin-settings'

export const runtime = 'nodejs'

const PutBody = z.object({
  value: z.boolean(),
})

const FLAG_KEY_RE = /^[a-z][a-z0-9_]{1,40}$/

export async function PUT(req: Request, ctx: { params: Promise<{ flag: string }> }) {
  const guard = await requireSuperAdmin(req, { route: 'admin-flag-update', max: 60, windowSec: 60 })
  if (!guard.ok) return guard.response
  const { flag } = await ctx.params
  if (!FLAG_KEY_RE.test(flag)) {
    return NextResponse.json({ error: 'Identifiant de flag invalide.' }, { status: 400 })
  }
  const json = await req.json().catch(() => ({}))
  const parsed = PutBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Valeur booléenne requise.' }, { status: 400 })
  }
  const result = await setFeatureFlag(flag, parsed.data.value, { ip: guard.ip, userAgent: guard.userAgent })
  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? 'Erreur.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, flag, value: parsed.data.value })
}
