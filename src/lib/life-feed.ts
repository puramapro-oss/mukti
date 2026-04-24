// MUKTI G8.1 — Fil de Vie (timeline perso + carte monde agrégée + projection)

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { resolveProfileId } from './ar'
import type { LifeFeedKind, ProjectionHorizon } from './constants'

export interface LifeFeedEntry {
  id: string
  user_id: string
  kind: LifeFeedKind
  label_fr: string
  label_en: string | null
  value_cents: number | null
  country_code: string | null
  geo_lat: number | null
  geo_lng: number | null
  source_table: string | null
  source_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

export async function recordLifeFeedEntry(params: {
  userId: string
  kind: LifeFeedKind
  label_fr: string
  label_en?: string
  value_cents?: number
  country_code?: string
  geo_lat?: number
  geo_lng?: number
  source_table?: string
  source_id?: string
  payload?: Record<string, unknown>
}): Promise<void> {
  const admin = createServiceClient()
  await admin.from('life_feed_entries').insert({
    user_id: params.userId,
    kind: params.kind,
    label_fr: params.label_fr,
    label_en: params.label_en ?? null,
    value_cents: params.value_cents ?? null,
    country_code: params.country_code ?? null,
    geo_lat: params.geo_lat ?? null,
    geo_lng: params.geo_lng ?? null,
    source_table: params.source_table ?? null,
    source_id: params.source_id ?? null,
    payload: params.payload ?? {},
  })
}

export async function getMyTimeline(limit = 50, cursor?: string): Promise<{ entries: LifeFeedEntry[]; nextCursor: string | null }> {
  const sb = await createServerSupabaseClient()
  const userId = await resolveProfileId(sb)
  if (!userId) return { entries: [], nextCursor: null }
  let q = sb
    .from('life_feed_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (cursor) q = q.lt('created_at', cursor)
  const { data } = await q
  const rows = (data ?? []) as LifeFeedEntry[]
  const hasMore = rows.length > limit
  const entries = hasMore ? rows.slice(0, limit) : rows
  return {
    entries,
    nextCursor: hasMore && entries.length > 0 ? entries[entries.length - 1]!.created_at : null,
  }
}

export interface CountryAggregate {
  country_code: string
  count: number
  total_value_cents: number
}

export async function getWorldImpactAggregated(): Promise<CountryAggregate[]> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('life_feed_entries')
    .select('country_code, value_cents')
    .not('country_code', 'is', null)
  const rows = (data ?? []) as Array<{ country_code: string; value_cents: number | null }>
  const map = new Map<string, { count: number; total: number }>()
  for (const r of rows) {
    const cur = map.get(r.country_code) ?? { count: 0, total: 0 }
    cur.count++
    cur.total += r.value_cents ?? 0
    map.set(r.country_code, cur)
  }
  return Array.from(map.entries()).map(([cc, v]) => ({
    country_code: cc,
    count: v.count,
    total_value_cents: v.total,
  }))
}

export interface MyStats {
  total_entries: number
  total_value_cents: number
  by_kind: Record<string, number>
  first_entry_at: string | null
  last_entry_at: string | null
}

export async function getMyStats(): Promise<MyStats> {
  const sb = await createServerSupabaseClient()
  const userId = await resolveProfileId(sb)
  if (!userId) {
    return { total_entries: 0, total_value_cents: 0, by_kind: {}, first_entry_at: null, last_entry_at: null }
  }
  const { data } = await sb
    .from('life_feed_entries')
    .select('kind, value_cents, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  const rows = (data ?? []) as Array<{ kind: string; value_cents: number | null; created_at: string }>
  const by_kind: Record<string, number> = {}
  let total_value_cents = 0
  for (const r of rows) {
    by_kind[r.kind] = (by_kind[r.kind] ?? 0) + 1
    total_value_cents += r.value_cents ?? 0
  }
  return {
    total_entries: rows.length,
    total_value_cents,
    by_kind,
    first_entry_at: rows.length > 0 ? rows[0]!.created_at : null,
    last_entry_at: rows.length > 0 ? rows[rows.length - 1]!.created_at : null,
  }
}

export interface ProjectionResult {
  horizon_years: ProjectionHorizon
  projected_impact: {
    rituals_count: number
    missions_count: number
    co2_saved_kg: number
    lives_touched_estimate: number
    donations_cents: number
    personal_growth_level: string
  }
  summary_fr: string
  summary_en: string
  generated_at: string
}

export async function computeProjectionFromStats(stats: MyStats, horizon: ProjectionHorizon): Promise<ProjectionResult['projected_impact']> {
  const entries = stats.total_entries
  if (entries === 0) {
    return {
      rituals_count: 0,
      missions_count: 0,
      co2_saved_kg: 0,
      lives_touched_estimate: 0,
      donations_cents: 0,
      personal_growth_level: 'Graine',
    }
  }
  const firstDate = stats.first_entry_at ? new Date(stats.first_entry_at).getTime() : Date.now()
  const now = Date.now()
  const daysActive = Math.max(1, Math.floor((now - firstDate) / (1000 * 60 * 60 * 24)))
  const entriesPerDay = entries / daysActive
  const horizonDays = horizon * 365
  const projectedEntries = Math.round(entriesPerDay * horizonDays)
  const ritualsShare = (stats.by_kind['ritual_7s'] ?? 0) + (stats.by_kind['rituel_hebdo_participated'] ?? 0) + (stats.by_kind['aurora_session'] ?? 0)
  const missionsShare = stats.by_kind['mission_completed'] ?? 0
  const factor = projectedEntries / Math.max(1, entries)
  return {
    rituals_count: Math.round(ritualsShare * factor),
    missions_count: Math.round(missionsShare * factor),
    co2_saved_kg: Math.round(missionsShare * factor * 0.5),
    lives_touched_estimate: Math.round(projectedEntries * 0.1),
    donations_cents: Math.round(stats.total_value_cents * factor * 0.1),
    personal_growth_level: horizon >= 20 ? 'Polaris' : horizon >= 10 ? 'Étoile' : 'Lumen',
  }
}

export async function saveProjection(horizon: ProjectionHorizon, projectedImpact: ProjectionResult['projected_impact'], summaryFr: string, summaryEn: string): Promise<{ ok: boolean; id?: string }> {
  const sb = await createServerSupabaseClient()
  const userId = await resolveProfileId(sb)
  if (!userId) return { ok: false }
  const { data } = await sb
    .from('life_feed_projections')
    .insert({
      user_id: userId,
      horizon_years: horizon,
      projected_impact: projectedImpact,
      summary_fr: summaryFr,
      summary_en: summaryEn,
    })
    .select('id')
    .maybeSingle()
  return { ok: true, id: (data as { id: string } | null)?.id }
}
