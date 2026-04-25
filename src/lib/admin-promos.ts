// MUKTI G8.6 — CRUD admin promos KARMA G7 + audit log automatique

import { createServiceClient } from './supabase'
import { isSuperAdminCurrentUser, logAdminAction } from './admin-settings'

export interface PromoRow {
  id: string
  code: string
  label: string
  discount_type: 'percent' | 'amount'
  discount_value: number
  duration: 'once' | 'forever' | 'repeating'
  duration_in_months: number | null
  valid_until: string | null
  max_redemptions: number | null
  redemptions_count: number
  stripe_coupon_id: string | null
  active: boolean
  created_at: string
}

export interface PromoCreateInput {
  code: string
  label: string
  discount_type: 'percent' | 'amount'
  discount_value: number
  duration: 'once' | 'forever' | 'repeating'
  duration_in_months?: number | null
  valid_until?: string | null
  max_redemptions?: number | null
  active?: boolean
}

export interface PromoUpdateInput {
  label?: string
  discount_type?: 'percent' | 'amount'
  discount_value?: number
  duration?: 'once' | 'forever' | 'repeating'
  duration_in_months?: number | null
  valid_until?: string | null
  max_redemptions?: number | null
  active?: boolean
}

export async function listPromos(): Promise<PromoRow[]> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return []
  const admin = createServiceClient()
  const { data } = await admin
    .from('promos')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as PromoRow[]
}

export async function getPromo(id: string): Promise<PromoRow | null> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return null
  const admin = createServiceClient()
  const { data } = await admin.from('promos').select('*').eq('id', id).maybeSingle()
  return (data as PromoRow | null) ?? null
}

export async function createPromo(input: PromoCreateInput, auditContext?: { ip?: string; userAgent?: string }): Promise<{ ok: boolean; promo?: PromoRow; reason?: string }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  const admin = createServiceClient()
  const payload = {
    code: input.code.trim().toUpperCase(),
    label: input.label.trim(),
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    duration: input.duration,
    duration_in_months: input.duration === 'repeating' ? (input.duration_in_months ?? 1) : null,
    valid_until: input.valid_until ?? null,
    max_redemptions: input.max_redemptions ?? null,
    active: input.active ?? true,
  }
  const { data, error } = await admin.from('promos').insert(payload).select('*').single()
  if (error) return { ok: false, reason: error.message }
  const row = data as PromoRow
  await logAdminAction({
    action: 'promo_create',
    target_table: 'promos',
    target_id: row.id,
    after_value: row,
    auditContext,
  })
  return { ok: true, promo: row }
}

export async function updatePromo(id: string, input: PromoUpdateInput, auditContext?: { ip?: string; userAgent?: string }): Promise<{ ok: boolean; promo?: PromoRow; reason?: string }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  const admin = createServiceClient()
  const before = await getPromo(id)
  if (!before) return { ok: false, reason: 'Code promo introuvable.' }
  const patch: Record<string, unknown> = {}
  if (input.label !== undefined) patch.label = input.label.trim()
  if (input.discount_type !== undefined) patch.discount_type = input.discount_type
  if (input.discount_value !== undefined) patch.discount_value = input.discount_value
  if (input.duration !== undefined) patch.duration = input.duration
  if (input.duration_in_months !== undefined) patch.duration_in_months = input.duration_in_months
  if (input.valid_until !== undefined) patch.valid_until = input.valid_until
  if (input.max_redemptions !== undefined) patch.max_redemptions = input.max_redemptions
  if (input.active !== undefined) patch.active = input.active
  if (Object.keys(patch).length === 0) return { ok: true, promo: before }
  const { data, error } = await admin.from('promos').update(patch).eq('id', id).select('*').single()
  if (error) return { ok: false, reason: error.message }
  const row = data as PromoRow
  await logAdminAction({
    action: 'promo_update',
    target_table: 'promos',
    target_id: id,
    before_value: before,
    after_value: row,
    auditContext,
  })
  return { ok: true, promo: row }
}

export async function deletePromo(id: string, auditContext?: { ip?: string; userAgent?: string }): Promise<{ ok: boolean; reason?: string }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  const admin = createServiceClient()
  const before = await getPromo(id)
  if (!before) return { ok: false, reason: 'Code promo introuvable.' }
  const { error } = await admin.from('promos').delete().eq('id', id)
  if (error) return { ok: false, reason: error.message }
  await logAdminAction({
    action: 'promo_delete',
    target_table: 'promos',
    target_id: id,
    before_value: before,
    auditContext,
  })
  return { ok: true }
}
