// MUKTI G8.6 — GET /api/admin/influenceurs/commissions
import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { listCommissionsAdmin, type CommissionStatus, type CommissionType } from '@/lib/admin-commissions'

export const runtime = 'nodejs'

const STATUS_VALUES: ReadonlyArray<CommissionStatus> = ['pending', 'credited', 'paid']
const TYPE_VALUES: ReadonlyArray<CommissionType> = ['n1_abo', 'recurring', 'ambassador']

export async function GET(req: Request) {
  const guard = await requireSuperAdmin(req, { route: 'admin-commissions-list' })
  if (!guard.ok) return guard.response
  const url = new URL(req.url)
  const statusRaw = url.searchParams.get('status')
  const typeRaw = url.searchParams.get('type')
  const userId = url.searchParams.get('user_id') ?? undefined
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50'), 1), 200)
  const offset = Math.max(Number(url.searchParams.get('offset') ?? '0'), 0)
  const status = statusRaw && (STATUS_VALUES as ReadonlyArray<string>).includes(statusRaw) ? (statusRaw as CommissionStatus) : undefined
  const type = typeRaw && (TYPE_VALUES as ReadonlyArray<string>).includes(typeRaw) ? (typeRaw as CommissionType) : undefined
  const result = await listCommissionsAdmin({ status, type, user_id: userId, limit, offset })
  return NextResponse.json(result)
}
