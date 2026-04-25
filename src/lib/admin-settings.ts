// MUKTI G8.1 + G8.6 — Admin Settings + Audit Log + VIDA ANGEL + Feature Flags + Wording Bank

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { resolveProfileId } from './ar'
import type { AdminSettingKey, WordingBankSection } from './constants'
import { VIDA_ANGEL_DEFAULT_MULTIPLIER, FEATURE_FLAGS_DEFAULT } from './constants'

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

export interface AuditLogRow {
  id: string
  admin_user_id: string | null
  action: string
  target_table: string | null
  target_id: string | null
  before_value: unknown
  after_value: unknown
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditLogFilters {
  action?: string
  target_table?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export async function listAuditLog(filters: AuditLogFilters = {}): Promise<{ rows: AuditLogRow[]; total: number }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { rows: [], total: 0 }
  const admin = createServiceClient()
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const offset = Math.max(filters.offset ?? 0, 0)
  let query = admin
    .from('admin_audit_log')
    .select('id, admin_user_id, action, target_table, target_id, before_value, after_value, ip_address, user_agent, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.target_table) query = query.eq('target_table', filters.target_table)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lte('created_at', filters.to)
  const { data, count } = await query
  return {
    rows: (data ?? []) as AuditLogRow[],
    total: count ?? 0,
  }
}

// ============================================================================
// FEATURE FLAGS — stockés sous admin_settings.feature_flags (JSONB)
// ============================================================================

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const stored = await getSetting<Record<string, boolean>>('feature_flags')
  return { ...FEATURE_FLAGS_DEFAULT, ...(stored ?? {}) }
}

export async function getFeatureFlag(flagKey: string): Promise<boolean> {
  const all = await getFeatureFlags()
  return all[flagKey] === true
}

export async function setFeatureFlag(flagKey: string, value: boolean, auditContext?: { ip?: string; userAgent?: string }): Promise<{ ok: boolean; reason?: string }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  const current = (await getSetting<Record<string, boolean>>('feature_flags')) ?? {}
  const next = { ...current, [flagKey]: value }
  return setSetting({ key: 'feature_flags', value: next, auditContext })
}

// ============================================================================
// WORDING BANK — 6 sections structurées (greetings/errors/success/cta/faq/meta)
// ============================================================================

export type WordingBank = Record<WordingBankSection, Record<string, string>>

const WORDING_BANK_EMPTY: WordingBank = {
  greetings: {},
  errors: {},
  success: {},
  cta: {},
  faq: {},
  meta: {},
}

export async function getWordingBank(): Promise<WordingBank> {
  const stored = await getSetting<Partial<WordingBank>>('wording_bank')
  return { ...WORDING_BANK_EMPTY, ...(stored ?? {}) }
}

export async function setWordingBankSection(section: WordingBankSection, entries: Record<string, string>, auditContext?: { ip?: string; userAgent?: string }): Promise<{ ok: boolean; reason?: string }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  const current = await getWordingBank()
  const next: WordingBank = { ...current, [section]: entries }
  return setSetting({ key: 'wording_bank', value: next, auditContext })
}

export async function setWordingBankRaw(value: WordingBank, auditContext?: { ip?: string; userAgent?: string }): Promise<{ ok: boolean; reason?: string }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  return setSetting({ key: 'wording_bank', value, auditContext })
}

// ============================================================================
// LOG ACTION — utilisé par CRUDs admin (promos/missions/commissions) pour tracer
// ============================================================================

export async function logAdminAction(params: {
  action: string
  target_table?: string
  target_id?: string
  before_value?: unknown
  after_value?: unknown
  auditContext?: { ip?: string; userAgent?: string }
}): Promise<void> {
  const { ok, userId } = await isSuperAdminCurrentUser()
  if (!ok || !userId) return
  const admin = createServiceClient()
  await admin.from('admin_audit_log').insert({
    admin_user_id: userId,
    action: params.action,
    target_table: params.target_table ?? null,
    target_id: params.target_id ?? null,
    before_value: (params.before_value ?? null) as object | null,
    after_value: (params.after_value ?? null) as object | null,
    ip_address: params.auditContext?.ip ?? null,
    user_agent: params.auditContext?.userAgent ?? null,
  })
}
