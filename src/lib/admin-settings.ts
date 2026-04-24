// MUKTI G8.1 — Admin Settings + Audit Log + VIDA ANGEL toggle

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { resolveProfileId } from './ar'
import type { AdminSettingKey } from './constants'
import { VIDA_ANGEL_DEFAULT_MULTIPLIER } from './constants'

export async function isSuperAdminCurrentUser(): Promise<{ ok: boolean; userId: string | null }> {
  const sb = await createServerSupabaseClient()
  const userId = await resolveProfileId(sb)
  if (!userId) return { ok: false, userId: null }
  const { data } = await sb
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  const role = (data as { role: string } | null)?.role
  return { ok: role === 'super_admin', userId }
}

export async function getSetting<T = unknown>(key: AdminSettingKey): Promise<T | null> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('admin_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  const row = data as { value: T } | null
  return row?.value ?? null
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('admin_settings')
    .select('key, value')
  const rows = (data ?? []) as Array<{ key: string; value: unknown }>
  const out: Record<string, unknown> = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

export async function setSetting(params: {
  key: AdminSettingKey
  value: unknown
  description?: string
  auditContext?: { ip?: string; userAgent?: string }
}): Promise<{ ok: boolean; reason?: string }> {
  const { ok, userId } = await isSuperAdminCurrentUser()
  if (!ok || !userId) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  const admin = createServiceClient()
  const { data: before } = await admin
    .from('admin_settings')
    .select('value')
    .eq('key', params.key)
    .maybeSingle()
  await admin
    .from('admin_settings')
    .upsert({
      key: params.key,
      value: params.value as object,
      description: params.description,
      updated_by: userId,
    }, { onConflict: 'key' })
  await admin.from('admin_audit_log').insert({
    admin_user_id: userId,
    action: 'setting_update',
    target_table: 'admin_settings',
    target_id: params.key,
    before_value: (before as { value: unknown } | null)?.value ?? null,
    after_value: params.value as object,
    ip_address: params.auditContext?.ip ?? null,
    user_agent: params.auditContext?.userAgent ?? null,
  })
  return { ok: true }
}

export async function isVidaAngelActive(): Promise<boolean> {
  const v = await getSetting<boolean>('vida_angel_active')
  return v === true
}

export async function getVidaAngelMultiplier(): Promise<number> {
  const v = await getSetting<number>('vida_angel_multiplier')
  return typeof v === 'number' && v > 0 ? v : VIDA_ANGEL_DEFAULT_MULTIPLIER
}

export async function applyVidaAngelMultiplier(amount_cents: number): Promise<{ amount_cents: number; multiplier: number; vida_angel: boolean }> {
  const active = await isVidaAngelActive()
  if (!active) return { amount_cents, multiplier: 1, vida_angel: false }
  const mult = await getVidaAngelMultiplier()
  return { amount_cents: Math.round(amount_cents * mult), multiplier: mult, vida_angel: true }
}

export async function listAuditLog(limit = 100): Promise<Array<{ id: string; action: string; target_table: string | null; target_id: string | null; before_value: unknown; after_value: unknown; created_at: string }>> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return []
  const admin = createServiceClient()
  const { data } = await admin
    .from('admin_audit_log')
    .select('id, action, target_table, target_id, before_value, after_value, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as Array<{ id: string; action: string; target_table: string | null; target_id: string | null; before_value: unknown; after_value: unknown; created_at: string }>
}
