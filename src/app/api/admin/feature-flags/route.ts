// MUKTI G8.6 — GET /api/admin/feature-flags (all flags)
import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { getFeatureFlags } from '@/lib/admin-settings'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const guard = await requireSuperAdmin(req, { route: 'admin-flags-list' })
  if (!guard.ok) return guard.response
  const flags = await getFeatureFlags()
  return NextResponse.json({ flags })
}
