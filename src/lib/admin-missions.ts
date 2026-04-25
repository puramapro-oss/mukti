// MUKTI G8.6 — CRUD admin missions + audit log automatique

import { createServiceClient } from './supabase'
import { isSuperAdminCurrentUser, logAdminAction } from './admin-settings'
import type { MissionType } from './constants'
import { MISSION_TYPES } from './constants'

export interface MissionRow {
  id: string
  slug: string
  title_fr: string
  title_en: string
  description_fr: string | null
  description_en: string | null
  type: MissionType
  category: string | null
  reward_points: number
  reward_amount_cents: number
  active: boolean
  sort_order: number
  created_by: string | null
  updated_at: string
  created_at: string
}

export interface MissionCreateInput {
  slug: string
  title_fr: string
  title_en: string
  description_fr?: string | null
  description_en?: string | null
  type: MissionType
  category?: string | null
  reward_points?: number
  reward_amount_cents?: number
  active?: boolean
  sort_order?: number
}

export interface MissionUpdateInput {
  title_fr?: string
  title_en?: string
  description_fr?: string | null
  description_en?: string | null
  type?: MissionType
  category?: string | null
  reward_points?: number
  reward_amount_cents?: number
  active?: boolean
  sort_order?: number
}

export function isMissionType(v: string): v is MissionType {
  return (MISSION_TYPES as readonly string[]).includes(v)
}

export async function listMissionsAdmin(): Promise<MissionRow[]> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return []
  const admin = createServiceClient()
  const { data } = await admin
    .from('missions')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  return (data ?? []) as MissionRow[]
}

export async function getMissionAdmin(id: string): Promise<MissionRow | null> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return null
  const admin = createServiceClient()
  const { data } = await admin.from('missions').select('*').eq('id', id).maybeSingle()
  return (data as MissionRow | null) ?? null
}

export async function createMission(input: MissionCreateInput, auditContext?: { ip?: string; userAgent?: string }): Promise<{ ok: boolean; mission?: MissionRow; reason?: string }> {
  const { ok, userId } = await isSuperAdminCurrentUser()
  if (!ok) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  if (!isMissionType(input.type)) return { ok: false, reason: 'Type de mission invalide.' }
  const admin = createServiceClient()
  const payload = {
    slug: input.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
    title_fr: input.title_fr.trim(),
    title_en: input.title_en.trim(),
    description_fr: input.description_fr?.trim() || null,
    description_en: input.description_en?.trim() || null,
    type: input.type,
    category: input.category?.trim() || null,
    reward_points: Math.max(0, Math.floor(input.reward_points ?? 0)),
    reward_amount_cents: Math.max(0, Math.floor(input.reward_amount_cents ?? 0)),
    active: input.active ?? true,
    sort_order: Math.floor(input.sort_order ?? 0),
    created_by: userId,
  }
  const { data, error } = await admin.from('missions').insert(payload).select('*').single()
  if (error) return { ok: false, reason: error.message }
  const row = data as MissionRow
  await logAdminAction({
    action: 'mission_create',
    target_table: 'missions',
    target_id: row.id,
    after_value: row,
    auditContext,
  })
  return { ok: true, mission: row }
}

export async function updateMission(id: string, input: MissionUpdateInput, auditContext?: { ip?: string; userAgent?: string }): Promise<{ ok: boolean; mission?: MissionRow; reason?: string }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  if (input.type && !isMissionType(input.type)) return { ok: false, reason: 'Type de mission invalide.' }
  const admin = createServiceClient()
  const before = await getMissionAdmin(id)
  if (!before) return { ok: false, reason: 'Mission introuvable.' }
  const patch: Record<string, unknown> = {}
  if (input.title_fr !== undefined) patch.title_fr = input.title_fr.trim()
  if (input.title_en !== undefined) patch.title_en = input.title_en.trim()
  if (input.description_fr !== undefined) patch.description_fr = input.description_fr?.trim() || null
  if (input.description_en !== undefined) patch.description_en = input.description_en?.trim() || null
  if (input.type !== undefined) patch.type = input.type
  if (input.category !== undefined) patch.category = input.category?.trim() || null
  if (input.reward_points !== undefined) patch.reward_points = Math.max(0, Math.floor(input.reward_points))
  if (input.reward_amount_cents !== undefined) patch.reward_amount_cents = Math.max(0, Math.floor(input.reward_amount_cents))
  if (input.active !== undefined) patch.active = input.active
  if (input.sort_order !== undefined) patch.sort_order = Math.floor(input.sort_order)
  if (Object.keys(patch).length === 0) return { ok: true, mission: before }
  const { data, error } = await admin.from('missions').update(patch).eq('id', id).select('*').single()
  if (error) return { ok: false, reason: error.message }
  const row = data as MissionRow
  await logAdminAction({
    action: 'mission_update',
    target_table: 'missions',
    target_id: id,
    before_value: before,
    after_value: row,
    auditContext,
  })
  return { ok: true, mission: row }
}

export async function deleteMission(id: string, auditContext?: { ip?: string; userAgent?: string }): Promise<{ ok: boolean; reason?: string }> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return { ok: false, reason: 'Accès réservé au super administrateur.' }
  const admin = createServiceClient()
  const before = await getMissionAdmin(id)
  if (!before) return { ok: false, reason: 'Mission introuvable.' }
  const { error } = await admin.from('missions').delete().eq('id', id)
  if (error) return { ok: false, reason: error.message }
  await logAdminAction({
    action: 'mission_delete',
    target_table: 'missions',
    target_id: id,
    before_value: before,
    auditContext,
  })
  return { ok: true }
}
