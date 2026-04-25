// MUKTI G8.6 — GET /api/admin/audit
import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { listAuditLog } from '@/lib/admin-settings'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const guard = await requireSuperAdmin(req, { route: 'admin-audit-list' })
  if (!guard.ok) return guard.response
  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50'), 1), 200)
  const offset = Math.max(Number(url.searchParams.get('offset') ?? '0'), 0)
  const action = url.searchParams.get('action') ?? undefined
  const target_table = url.searchParams.get('target_table') ?? undefined
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined
  const result = await listAuditLog({ limit, offset, action, target_table, from, to })
  return NextResponse.json(result)
}
