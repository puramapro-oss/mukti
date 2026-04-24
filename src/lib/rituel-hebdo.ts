// MUKTI G8.1 — Rituel Hebdo Tournant 7 semaines
// Rotation déterministe : semaine ISO → thème (modulo 7)

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { resolveProfileId } from './ar'
import { RITUEL_THEMES, RITUEL_THEMES_COUNT, type RituelTheme } from './constants'

// ISO week number from Date (Monday-start)
export function getIsoWeekString(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`
}

// Total ISO weeks elapsed since anchor 2026-W01 → deterministic theme rotation
export function weekIndexFromIso(weekIso: string): number {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekIso)
  if (!match) return 0
  const year = parseInt(match[1]!, 10)
  const week = parseInt(match[2]!, 10)
  // Anchor : année 2026 semaine 1 → index 0
  const anchorYear = 2026
  return Math.max(0, (year - anchorYear) * 52 + (week - 1))
}

export function themeForWeek(weekIso: string): RituelTheme {
  const idx = weekIndexFromIso(weekIso)
  return RITUEL_THEMES[idx % RITUEL_THEMES_COUNT]!.slug
}

export function themeMetadata(slug: RituelTheme): (typeof RITUEL_THEMES)[number] {
  return RITUEL_THEMES.find(t => t.slug === slug) ?? RITUEL_THEMES[0]!
}

// Starts Monday 00:00 UTC, ends Sunday 23:59:59 UTC
export function weekBoundaries(weekIso: string): { starts_at: Date; ends_at: Date } {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekIso)
  if (!match) {
    const now = new Date()
    return { starts_at: now, ends_at: new Date(now.getTime() + 7 * 86400000) }
  }
  const year = parseInt(match[1]!, 10)
  const week = parseInt(match[2]!, 10)
  // ISO week 1 = week containing jan 4
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000)
  const starts_at = new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000)
  const ends_at = new Date(starts_at.getTime() + 7 * 86400000 - 1000)
  return { starts_at, ends_at }
}

export interface RituelWeek {
  id: string
  week_iso: string
  theme_slug: RituelTheme
  starts_at: string
  ends_at: string
  participants_count: number
  total_minutes: number
}

export async function ensureCurrentWeek(): Promise<RituelWeek> {
  const admin = createServiceClient()
  const weekIso = getIsoWeekString()
  const { data: existing } = await admin
    .from('rituel_hebdo_weeks')
    .select('*')
    .eq('week_iso', weekIso)
    .maybeSingle()
  if (existing) return existing as RituelWeek
  const theme = themeForWeek(weekIso)
  const { starts_at, ends_at } = weekBoundaries(weekIso)
  const { data } = await admin
    .from('rituel_hebdo_weeks')
    .upsert({
      week_iso: weekIso,
      theme_slug: theme,
      starts_at: starts_at.toISOString(),
      ends_at: ends_at.toISOString(),
      participants_count: 0,
      total_minutes: 0,
    }, { onConflict: 'week_iso' })
    .select('*')
    .maybeSingle()
  return data as RituelWeek
}

export async function ensureNextWeek(): Promise<RituelWeek> {
  const admin = createServiceClient()
  const today = new Date()
  const nextMonday = new Date(today.getTime() + 7 * 86400000)
  const weekIso = getIsoWeekString(nextMonday)
  const { data: existing } = await admin
    .from('rituel_hebdo_weeks')
    .select('*')
    .eq('week_iso', weekIso)
    .maybeSingle()
  if (existing) return existing as RituelWeek
  const theme = themeForWeek(weekIso)
  const { starts_at, ends_at } = weekBoundaries(weekIso)
  const { data } = await admin
    .from('rituel_hebdo_weeks')
    .upsert({
      week_iso: weekIso,
      theme_slug: theme,
      starts_at: starts_at.toISOString(),
      ends_at: ends_at.toISOString(),
      participants_count: 0,
      total_minutes: 0,
    }, { onConflict: 'week_iso' })
    .select('*')
    .maybeSingle()
  return data as RituelWeek
}

export async function joinRituelCurrentWeek(params: {
  minutes_practiced: number
  intention_text?: string
  shared?: boolean
}): Promise<{ ok: boolean; week_iso?: string }> {
  const sb = await createServerSupabaseClient()
  const userId = await resolveProfileId(sb)
  if (!userId) return { ok: false }
  const week = await ensureCurrentWeek()
  const admin = createServiceClient()
  await admin
    .from('rituel_hebdo_participations')
    .upsert({
      user_id: userId,
      week_iso: week.week_iso,
      minutes_practiced: params.minutes_practiced,
      intention_text: params.intention_text ?? null,
      shared: params.shared ?? false,
    }, { onConflict: 'user_id,week_iso' })
  // Update aggregates
  const { data: aggData } = await admin
    .from('rituel_hebdo_participations')
    .select('minutes_practiced')
    .eq('week_iso', week.week_iso)
  const rows = (aggData ?? []) as Array<{ minutes_practiced: number }>
  const total_minutes = rows.reduce((a, r) => a + (r.minutes_practiced ?? 0), 0)
  await admin
    .from('rituel_hebdo_weeks')
    .update({
      participants_count: rows.length,
      total_minutes,
    })
    .eq('week_iso', week.week_iso)
  return { ok: true, week_iso: week.week_iso }
}

export async function getMyRituelHistory(limit = 10): Promise<Array<{ week_iso: string; theme_slug: RituelTheme; minutes_practiced: number; intention_text: string | null; created_at: string }>> {
  const sb = await createServerSupabaseClient()
  const userId = await resolveProfileId(sb)
  if (!userId) return []
  const { data } = await sb
    .from('rituel_hebdo_participations')
    .select('week_iso, minutes_practiced, intention_text, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = (data ?? []) as Array<{ week_iso: string; minutes_practiced: number; intention_text: string | null; created_at: string }>
  return rows.map(r => ({
    ...r,
    theme_slug: themeForWeek(r.week_iso),
  }))
}
