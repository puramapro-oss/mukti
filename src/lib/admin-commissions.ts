// MUKTI G8.6 — Admin commissions ambassadeurs (KARMA G7) — list + status override

import { createServiceClient } from './supabase'
import { isSuperAdminCurrentUser, logAdminAction } from './admin-settings'

export type CommissionStatus = 'pending' | 'credited' | 'paid'
export type CommissionType = 'n1_abo' | 'recurring' | 'ambassador'

export interface CommissionRow {
  id: string
  user_id: string
  amount_cents: number
  type: CommissionType
  source_payment_id: string | null
  status: CommissionStatus
  credited_at: string | null
  paid_at: string | null
  created_at: string
}

export interface CommissionRowEnriched extends CommissionRow {
  user_email: string | null
  user_full_name: string | null
}

export interface CommissionFilters {
  status?: CommissionStatus
  type?: CommissionType
  user_id?: string
  limit?: number
  offset?: number
}

export async function listCommissionsAdmin(filters: CommissionFilters = {}): Promise<{ rows: CommissionRowEnriched[]; total: number; sum_cents: number }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { rows: [], total: 0, sum_cents: 0 }
  const admin = createServiceClient()
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const offset = Math.max(filters.offset ?? 0, 0)
  let query = admin
    .from('commissions')
    .select('id, user_id, amount_cents, type, source_payment_id, status, credited_at, paid_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.user_id) query = query.eq('user_id', filters.user_id)
  const { data, count } = await query
  const rows = (data ?? []) as CommissionRow[]
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))
  const profiles = userIds.length
    ? await admin.from('profiles').select('id, email, full_name').in('id', userIds)
    : { data: [] as Array<{ id: string; email: string | null; full_name: string | null }> }
  const profileMap = new Map<string, { email: string | null; full_name: string | null }>()
  for (const p of (profiles.data ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>) {
    profileMap.set(p.id, { email: p.email, full_name: p.full_name })
  }
  const enriched = rows.map((r) => {
    const p = profileMap.get(r.user_id)
    return {
      ...r,
      user_email: p?.email ?? null,
      user_full_name: p?.full_name ?? null,
    } as CommissionRowEnriched
  })
  // Compute total sum_cents pour la même requête (sans pagination)
  let sumQuery = admin.from('commissions').select('amount_cents')
  if (filters.status) sumQuery = sumQuery.eq('status', filters.status)
  if (filters.type) sumQuery = sumQuery.eq('type', filters.type)
  if (filters.user_id) sumQuery = sumQuery.eq('user_id', filters.user_id)
  const { data: sumRows } = await sumQuery
  const sum_cents = ((sumRows ?? []) as Array<{ amount_cents: number }>).reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  return { rows: enriched, total: count ?? 0, sum_cents }
}

export async function updateCommissionStatus(id: string, newStatus: CommissionStatus, auditContext?: { ip?: string; userAgent?: string }): Promise<{ ok: boolean; reason?: string }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  const admin = createServiceClient()
  const { data: before } = await admin.from('commissions').select('*').eq('id', id).maybeSingle()
  if (!before) return { ok: false, reason: 'Commission introuvable.' }
  const patch: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'credited' && !(before as CommissionRow).credited_at) patch.credited_at = new Date().toISOString()
  if (newStatus === 'paid' && !(before as CommissionRow).paid_at) patch.paid_at = new Date().toISOString()
  const { data: after, error } = await admin.from('commissions').update(patch).eq('id', id).select('*').single()
  if (error) return { ok: false, reason: error.message }
  await logAdminAction({
    action: 'commission_status_update',
    target_table: 'commissions',
    target_id: id,
    before_value: before,
    after_value: after,
    auditContext,
  })
  return { ok: true }
}
