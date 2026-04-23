// MUKTI — G4 AR Energy Mirror
// Server-side helpers : cérémonies Moment Z (listing, join/leave, auto-start/finish).
// Pattern G3 (circles) : Realtime postgres_changes côté client + CRON côté serveur.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import type { ArCeremonyStatus, ArSpeciesSlug } from './constants'

export interface ArCeremony {
  id: string
  slug: string | null
  title: string
  description: string | null
  intention_category: string
  scheduled_at: string
  duration_sec: number
  species_hint: ArSpeciesSlug | null
  beacon_slug: string | null
  max_participants: number
  creator_id: string | null
  is_system: boolean
  recurrence_rule: string | null
  status: ArCeremonyStatus
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export interface ArCeremonyParticipant {
  id: string
  ceremony_id: string
  user_id: string
  joined_at: string
  completed: boolean
  completed_at: string | null
  left_at: string | null
}

export interface ArCeremonyWithCount extends ArCeremony {
  participants_count: number
}

// ---------------------------------------------------------------------------
// LIST — upcoming + live + finished (récentes)
// ---------------------------------------------------------------------------
export async function listCeremonies(filter: 'upcoming' | 'live' | 'finished' | 'all' = 'all'): Promise<ArCeremonyWithCount[]> {
  const sb = createServiceClient()
  let query = sb.from('ar_ceremonies').select('*')
  if (filter === 'upcoming') query = query.eq('status', 'upcoming')
  else if (filter === 'live') query = query.eq('status', 'live')
  else if (filter === 'finished') query = query.eq('status', 'finished')
  else query = query.in('status', ['upcoming', 'live', 'finished'])
  query = query.order('scheduled_at', { ascending: true }).limit(50)
  const { data } = await query
  const ceremonies = (data as ArCeremony[] | null) ?? []
  if (ceremonies.length === 0) return []

  const ids = ceremonies.map((c) => c.id)
  const { data: counts } = await sb
    .from('ar_ceremony_participants')
    .select('ceremony_id')
    .in('ceremony_id', ids)
    .is('left_at', null)

  const countMap = new Map<string, number>()
  for (const r of (counts as { ceremony_id: string }[] | null) ?? []) {
    countMap.set(r.ceremony_id, (countMap.get(r.ceremony_id) ?? 0) + 1)
  }
  return ceremonies.map((c) => ({ ...c, participants_count: countMap.get(c.id) ?? 0 }))
}

export async function getCeremony(ceremonyId: string): Promise<ArCeremonyWithCount | null> {
  const sb = createServiceClient()
  const { data } = await sb.from('ar_ceremonies').select('*').eq('id', ceremonyId).maybeSingle()
  const c = data as ArCeremony | null
  if (!c) return null
  const { count } = await sb
    .from('ar_ceremony_participants')
    .select('*', { count: 'exact', head: true })
    .eq('ceremony_id', ceremonyId)
    .is('left_at', null)
  return { ...c, participants_count: count ?? 0 }
}

// ---------------------------------------------------------------------------
// JOIN / LEAVE — participation user
// ---------------------------------------------------------------------------
export async function joinCeremony(
  ceremonyId: string,
  userProfileId: string
): Promise<{ ok: true; participant: ArCeremonyParticipant } | { ok: false; error: string; code?: string }> {
  const sb = await createServerSupabaseClient()

  const { data: ceremony } = await sb
    .from('ar_ceremonies')
    .select('id, status, max_participants')
    .eq('id', ceremonyId)
    .maybeSingle()
  if (!ceremony) return { ok: false, error: 'Cérémonie introuvable.', code: 'not_found' }
  const c = ceremony as { id: string; status: ArCeremonyStatus; max_participants: number }
  if (c.status === 'finished' || c.status === 'cancelled') {
    return { ok: false, error: 'Cette cérémonie est terminée.', code: 'finished' }
  }

  const service = createServiceClient()
  const { count } = await service
    .from('ar_ceremony_participants')
    .select('*', { count: 'exact', head: true })
    .eq('ceremony_id', ceremonyId)
    .is('left_at', null)

  if ((count ?? 0) >= c.max_participants) {
    return { ok: false, error: 'Cérémonie complète.', code: 'full' }
  }

  const { data: existing } = await sb
    .from('ar_ceremony_participants')
    .select('*')
    .eq('ceremony_id', ceremonyId)
    .eq('user_id', userProfileId)
    .maybeSingle()

  if (existing) {
    const e = existing as ArCeremonyParticipant
    if (e.left_at) {
      const { data: updated, error: upErr } = await sb
        .from('ar_ceremony_participants')
        .update({ left_at: null, joined_at: new Date().toISOString() })
        .eq('id', e.id)
        .select('*')
        .single()
      if (upErr) return { ok: false, error: upErr.message, code: 'db_error' }
      return { ok: true, participant: updated as ArCeremonyParticipant }
    }
    return { ok: true, participant: e }
  }

  const { data, error } = await sb
    .from('ar_ceremony_participants')
    .insert({ ceremony_id: ceremonyId, user_id: userProfileId })
    .select('*')
    .single()
  if (error) return { ok: false, error: error.message, code: 'db_error' }
  return { ok: true, participant: data as ArCeremonyParticipant }
}

export async function leaveCeremony(
  ceremonyId: string,
  userProfileId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = await createServerSupabaseClient()
  const { error } = await sb
    .from('ar_ceremony_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('ceremony_id', ceremonyId)
    .eq('user_id', userProfileId)
    .is('left_at', null)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function markCeremonyCompleted(
  ceremonyId: string,
  userProfileId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = await createServerSupabaseClient()
  const { error } = await sb
    .from('ar_ceremony_participants')
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq('ceremony_id', ceremonyId)
    .eq('user_id', userProfileId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// LIFECYCLE — appelé par CRON ou serveur
// ---------------------------------------------------------------------------
// Passe à 'live' les cérémonies dont scheduled_at est atteint et status='upcoming'.
export async function autoStartCeremonies(): Promise<{ started: number }> {
  const sb = createServiceClient()
  const now = new Date().toISOString()
  const { data } = await sb
    .from('ar_ceremonies')
    .update({ status: 'live', started_at: now })
    .lte('scheduled_at', now)
    .eq('status', 'upcoming')
    .select('id')
  return { started: (data as { id: string }[] | null)?.length ?? 0 }
}

// Termine les cérémonies dont la durée est dépassée + reprogramme les récurrentes.
export async function autoFinishCeremonies(): Promise<{ finished: number; rescheduled: number }> {
  const sb = createServiceClient()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  const { data: live } = await sb
    .from('ar_ceremonies')
    .select('id, started_at, duration_sec, recurrence_rule, title, description, intention_category, species_hint, beacon_slug, max_participants, is_system')
    .eq('status', 'live')

  let finished = 0
  let rescheduled = 0

  for (const row of (live as (ArCeremony & { duration_sec: number })[] | null) ?? []) {
    if (!row.started_at) continue
    const expectedEnd = new Date(row.started_at).getTime() + row.duration_sec * 1000
    if (now < expectedEnd) continue

    await sb.from('ar_ceremonies').update({ status: 'finished', finished_at: nowIso }).eq('id', row.id)
    finished++

    if (row.recurrence_rule) {
      const next = nextOccurrence(row.recurrence_rule)
      if (next) {
        const existingSlug = row.slug ? `${row.slug}_${next.toISOString().slice(0, 10)}` : null
        const seedRow = {
          slug: existingSlug,
          title: row.title,
          description: row.description,
          intention_category: row.intention_category,
          scheduled_at: next.toISOString(),
          duration_sec: row.duration_sec,
          species_hint: row.species_hint,
          beacon_slug: row.beacon_slug,
          max_participants: row.max_participants,
          creator_id: null,
          is_system: row.is_system,
          recurrence_rule: row.recurrence_rule,
          status: 'upcoming' as const,
        }
        const { error: insErr } = await sb.from('ar_ceremonies').insert(seedRow)
        if (!insErr) rescheduled++
      }
    }
  }

  return { finished, rescheduled }
}

// Calcule la prochaine occurrence pour les 3 règles supportées.
// recurrence_rule ∈ { 'weekly_monday_06','weekly_wednesday_20','weekly_sunday_18' }
function nextOccurrence(rule: string): Date | null {
  const now = new Date()
  const targetByRule: Record<string, { dow: number; hour: number }> = {
    weekly_monday_06: { dow: 1, hour: 6 },
    weekly_wednesday_20: { dow: 3, hour: 20 },
    weekly_sunday_18: { dow: 0, hour: 18 },
  }
  const spec = targetByRule[rule]
  if (!spec) return null
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), spec.hour, 0, 0, 0))
  const currentDow = target.getUTCDay()
  let delta = (spec.dow - currentDow + 7) % 7
  if (delta === 0 && target.getTime() <= now.getTime()) delta = 7
  target.setUTCDate(target.getUTCDate() + delta)
  return target
}

// Compteur live (API lecture rapide)
export async function getParticipantsCount(ceremonyId: string): Promise<number> {
  const sb = createServiceClient()
  const { count } = await sb
    .from('ar_ceremony_participants')
    .select('*', { count: 'exact', head: true })
    .eq('ceremony_id', ceremonyId)
    .is('left_at', null)
  return count ?? 0
}
