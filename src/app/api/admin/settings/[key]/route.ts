// MUKTI G8.6 — GET/PUT /api/admin/settings/[key]
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { getSetting, setSetting } from '@/lib/admin-settings'
import { ADMIN_SETTING_KEYS, type AdminSettingKey } from '@/lib/constants'

export const runtime = 'nodejs'

function isAdminSettingKey(v: string): v is AdminSettingKey {
  return (ADMIN_SETTING_KEYS as readonly string[]).includes(v)
}

const PutBody = z.object({
  value: z.unknown(),
})

export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const guard = await requireSuperAdmin(req, { route: 'admin-settings-get' })
  if (!guard.ok) return guard.response
  const { key } = await ctx.params
  if (!isAdminSettingKey(key)) {
    return NextResponse.json({ error: 'Clé de paramètre inconnue.' }, { status: 400 })
  }
  const value = await getSetting(key)
  return NextResponse.json({ key, value })
}

export async function PUT(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const guard = await requireSuperAdmin(req, { route: 'admin-settings-put', max: 60, windowSec: 60 })
  if (!guard.ok) return guard.response
  const { key } = await ctx.params
  if (!isAdminSettingKey(key)) {
    return NextResponse.json({ error: 'Clé de paramètre inconnue.' }, { status: 400 })
  }
  const json = await req.json().catch(() => ({}))
  const parsed = PutBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Valeur invalide.' }, { status: 400 })
  }
  const result = await setSetting({
    key,
    value: parsed.data.value,
    auditContext: { ip: guard.ip, userAgent: guard.userAgent },
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? 'Erreur lors de la mise à jour.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, key, value: parsed.data.value })
}
