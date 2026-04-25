// MUKTI G8.6 — GET /api/admin/stats-live
import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { getStatsLive } from '@/lib/admin-stats'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: Request) {
  const guard = await requireSuperAdmin(req, { route: 'admin-stats-live', max: 60, windowSec: 60 })
  if (!guard.ok) return guard.response
  const stats = await getStatsLive()
  if (!stats) return NextResponse.json({ error: 'Statistiques indisponibles.' }, { status: 500 })
  return NextResponse.json({ stats })
}
