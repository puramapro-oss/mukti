// MUKTI G8.6 — GET /api/admin/settings (all)
import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { getAllSettings } from '@/lib/admin-settings'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const guard = await requireSuperAdmin(req, { route: 'admin-settings-list' })
  if (!guard.ok) return guard.response
  const settings = await getAllSettings()
  return NextResponse.json({ settings })
}
