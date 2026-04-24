// MUKTI — G6 C.O.R.E. Events helpers
// CRUD events + sessions + participants + phase advancement (Moment Z T-60 → T+15).
// Architecture 3 couches : timeline realtime + LiveKit broadcast + AR local.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import {
  CORE_FORMATS,
  CORE_CATEGORIES,
  CORE_PHASES,
  CORE_SESSION_KINDS,
  CORE_COMMUNITY_TRUST_MIN,
  type CoreFormat,
  type CoreCategory,
  type CorePhase,
  type CoreSessionKind,
  type CoreProtocolId,
} from './constants'
import { defaultProtocolForFormat } from './core-protocols'

export interface CoreEvent {
  id: string
  format: CoreFormat
  category: CoreCategory
  severity: number
  title_fr: string
  title_en: string
  intention_fr: string
  intention_en: string
  region: string | null
  moment_z_at: string
  ar_protocol_id: string | null
  source: 'community' | 'world_radar' | 'super_admin'
  confidence: number | null
  status: 'draft' | 'scheduled' | 'live' | 'finished' | 'rejected'
  created_by: string | null
  ai_pack: Record<string, unknown> | null
  auto_published: boolean
  moderated_at: string | null
  moderated_by: string | null
  participants_count: number
  created_at: string
  updated_at: string
}

export interface CoreEventSession {
  id: string
  event_id: string
  kind: CoreSessionKind
  current_phase: CorePhase | 'finished'
  phase_started_at: string
  scheduled_at: string
  finished_at: string | null
  protocol_id: string | null
  created_at: string
  updated_at: string
}

export interface CoreEventParticipant {
  event_id: string
  user_id: string
  joined_at: string
  left_at: string | null
  ar_synced: boolean
  pulse_count: number
}

export interface CreateEventInput {
  format: CoreFormat
  category: CoreCategory
  severity: number
  title_fr: string
  title_en: string
  intention_fr: string
  intention_en: string
  region?: string | null
  moment_z_at: string
  ar_protocol_id?: CoreProtocolId | null
}

export function isCoreFormat(v: string): v is CoreFormat {
  return (CORE_FORMATS as readonly { id: string }[]).some(f => f.id === v)
}
export function isCoreCategory(v: string): v is CoreCategory {
  return (CORE_CATEGORIES as readonly { id: string }[]).some(c => c.id === v)
}

/** Create a community-led event. Requires trust_score ≥ CORE_COMMUNITY_TRUST_MIN. */
export async function createEventCommunity(input: CreateEventInput): Promise<{
  event: CoreEvent | null
  error: string | null
}> {
  if (!isCoreFormat(input.format)) {
    return { event: null, error: 'Format invalide.' }
  }
  if (!isCoreCategory(input.category)) {
    return { event: null, error: 'Catégorie invalide.' }
  }
  if (!Number.isInteger(input.severity) || input.severity < 1 || input.severity > 5) {
    return { event: null, error: 'La gravité doit être entre 1 et 5.' }
  }
  if (input.title_fr.trim().length < 4 || input.title_fr.length > 140) {
    return { event: null, error: 'Titre FR entre 4 et 140 caractères.' }
  }
  if (input.intention_fr.trim().length < 3 || input.intention_fr.length > 80) {
    return { event: null, error: 'Intention FR entre 3 et 80 caractères.' }
  }
  const zAt = new Date(input.moment_z_at).getTime()
  if (Number.isNaN(zAt)) {
    return { event: null, error: 'Date du Moment Z invalide.' }
  }
  if (zAt < Date.now() + 10 * 60 * 1000) {
    return { event: null, error: 'Le Moment Z doit être au moins 10 min dans le futur.' }
  }

  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { event: null, error: 'Profil introuvable.' }

  // Trust gate
  const sb = createServiceClient()
  const { data: trust } = await sb
    .schema('mukti')
    .from('trust_scores')
    .select('score')
    .eq('user_id', profileId)
    .maybeSingle()
  const score = (trust as { score: number } | null)?.score ?? 50
  if (score < CORE_COMMUNITY_TRUST_MIN) {
    return {
      event: null,
      error: `Trust score insuffisant (${score}/${CORE_COMMUNITY_TRUST_MIN}). Continue à pratiquer pour débloquer la création d'événements.`,
    }
  }

  const protocolId = input.ar_protocol_id ?? defaultProtocolForFormat(input.format)

  const { data, error } = await sb
    .schema('mukti')
    .from('core_events')
    .insert({
      format: input.format,
      category: input.category,
      severity: input.severity,
      title_fr: input.title_fr.trim(),
      title_en: input.title_en.trim(),
      intention_fr: input.intention_fr.trim(),
      intention_en: input.intention_en.trim(),
      region: input.region?.trim() ?? null,
      moment_z_at: new Date(zAt).toISOString(),
      ar_protocol_id: protocolId,
      source: 'community',
      confidence: 1.0,
      status: 'scheduled',
      created_by: profileId,
      auto_published: true,
    })
    .select('*')
    .single()
  if (error || !data) {
    return { event: null, error: "Impossible de créer l'événement." }
  }

  // Create 3 trilogy sessions
  await createTrilogySessions(data.id as string, new Date(zAt), protocolId)

  return { event: data as CoreEvent, error: null }
}

/** Create 3 trilogy sessions (now / 24h / 7d) for an event. */
export async function createTrilogySessions(
  eventId: string,
  momentZ: Date,
  protocolId: CoreProtocolId
): Promise<void> {
  const sb = createServiceClient()
  const rows = CORE_SESSION_KINDS.map(k => ({
    event_id: eventId,
    kind: k.id,
    current_phase: 'pre' as const,
    scheduled_at: new Date(momentZ.getTime() + k.offset_hours * 3600 * 1000).toISOString(),
    protocol_id: protocolId,
  }))
  await sb.schema('mukti').from('core_event_sessions').insert(rows)
}

/** List events filtered by format/status/region. */
export async function listEvents(filters?: {
  format?: CoreFormat
  status?: CoreEvent['status']
  limit?: number
}): Promise<CoreEvent[]> {
  const sb = createServiceClient()
  let q = sb
    .schema('mukti')
    .from('core_events')
    .select('*')
    .in('status', ['scheduled', 'live', 'finished'])
    .order('moment_z_at', { ascending: true })
  if (filters?.format) q = q.eq('format', filters.format)
  if (filters?.status) q = q.eq('status', filters.status)
  const limit = Math.max(1, Math.min(100, filters?.limit ?? 30))
  q = q.limit(limit)
  const { data } = await q
  return (data ?? []) as CoreEvent[]
}

export async function getEventById(eventId: string): Promise<CoreEvent | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .schema('mukti')
    .from('core_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()
  return data as CoreEvent | null
}

export async function getEventSessions(eventId: string): Promise<CoreEventSession[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .schema('mukti')
    .from('core_event_sessions')
    .select('*')
    .eq('event_id', eventId)
    .order('scheduled_at', { ascending: true })
  return (data ?? []) as CoreEventSession[]
}

/** Join an event (idempotent). Returns participant row. */
export async function joinEvent(eventId: string): Promise<{
  participant: CoreEventParticipant | null
  error: string | null
}> {
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { participant: null, error: 'Profil introuvable.' }

  const sb = createServiceClient()
  const event = await getEventById(eventId)
  if (!event) return { participant: null, error: 'Événement introuvable.' }
  if (!['scheduled', 'live'].includes(event.status)) {
    return { participant: null, error: 'Cet événement n\'est pas ouvert à l\'inscription.' }
  }

  const { data, error } = await sb
    .schema('mukti')
    .from('core_event_participants')
    .upsert(
      {
        event_id: eventId,
        user_id: profileId,
        joined_at: new Date().toISOString(),
        left_at: null,
      },
      { onConflict: 'event_id,user_id' }
    )
    .select('*')
    .single()
  if (error || !data) return { participant: null, error: 'Impossible de rejoindre.' }
  return { participant: data as CoreEventParticipant, error: null }
}

export async function leaveEvent(eventId: string): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { ok: false, error: 'Profil introuvable.' }

  const sb = createServiceClient()
  const { error } = await sb
    .schema('mukti')
    .from('core_event_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('user_id', profileId)
  if (error) return { ok: false, error: 'Impossible de quitter.' }
  return { ok: true, error: null }
}

/** Current phase based on moment_z_at offset. */
export function computeCurrentPhase(momentZ: Date, now: Date = new Date()): CorePhase | 'finished' {
  const offsetMin = (now.getTime() - momentZ.getTime()) / 60000
  for (let i = CORE_PHASES.length - 1; i >= 0; i--) {
    const p = CORE_PHASES[i]!
    if (offsetMin >= p.offset_min) {
      if (i === CORE_PHASES.length - 1 && offsetMin > p.offset_min + p.duration_min) {
        return 'finished'
      }
      return p.id
    }
  }
  return 'pre'
}

/** Tick phases for all live events (called by CRON). */
export async function advanceAllLiveEvents(): Promise<{ updated: number; finished: number }> {
  const sb = createServiceClient()
  const { data: events } = await sb
    .schema('mukti')
    .from('core_events')
    .select('id, moment_z_at, status')
    .in('status', ['scheduled', 'live'])
  const list = (events ?? []) as { id: string; moment_z_at: string; status: string }[]
  let updated = 0
  let finished = 0
  const now = new Date()
  for (const ev of list) {
    const momentZ = new Date(ev.moment_z_at)
    const phase = computeCurrentPhase(momentZ, now)
    if (phase === 'finished') {
      await sb.schema('mukti').from('core_events').update({ status: 'finished' }).eq('id', ev.id)
      finished += 1
    } else if (ev.status === 'scheduled' && phase !== 'pre') {
      await sb.schema('mukti').from('core_events').update({ status: 'live' }).eq('id', ev.id)
      updated += 1
    }
    // Update per-session phase
    await sb
      .schema('mukti')
      .from('core_event_sessions')
      .update({ current_phase: phase === 'finished' ? 'finished' : phase, phase_started_at: now.toISOString() })
      .eq('event_id', ev.id)
      .eq('kind', 'now')
  }
  return { updated, finished }
}

// Helper
async function resolveProfileId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}
