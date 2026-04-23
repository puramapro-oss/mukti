// MUKTI — Reprogrammation subconscient (G5)
// Mode Nuit + Mode Journée — affirmations conscientes choisies par catégorie,
// son nature opt-in, volume adaptatif ramp 30min, notifs 2h (Journée).

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { listForSession, type Affirmation } from './affirmations-bank'
import {
  REPROG_CATEGORIES,
  NATURE_SOUNDS,
  REPROG_DAY_REMINDER_HOURS,
  REPROG_NIGHT_VOLUME_RAMP_MIN,
  type ReprogCategory,
  type NatureSound,
} from './constants'

export type ReprogMode = 'night' | 'day'
export type VolumeProfile = 'adaptive' | 'fixed'

export interface ReprogrammingSession {
  id: string
  user_id: string
  mode: ReprogMode
  category: ReprogCategory
  started_at: string
  ended_at: string | null
  duration_sec: number | null
  affirmations_played: string[]
  affirmations_count: number
  nature_sound: NatureSound
  volume_profile: VolumeProfile
  voice_guidance: boolean
  created_at: string
}

export interface StartSessionInput {
  mode: ReprogMode
  category: ReprogCategory
  nature_sound?: NatureSound
  volume_profile?: VolumeProfile
  voice_guidance?: boolean
}

export interface SessionStartResult {
  session: ReprogrammingSession | null
  affirmations: Affirmation[]
  error: string | null
}

/** Validation helpers. */
export function isValidMode(v: string): v is ReprogMode {
  return v === 'night' || v === 'day'
}
export function isValidNatureSound(v: string): v is NatureSound {
  return (NATURE_SOUNDS as readonly { id: string }[]).some(s => s.id === v)
}

/**
 * Démarre une session de reprogrammation.
 * Nuit : par défaut silence + voice_guidance=false + ramp volume 30min (client-side).
 * Journée : 1 slot parmi REPROG_DAY_REMINDER_HOURS, peut tourner en fond.
 */
export async function startSession(
  input: StartSessionInput
): Promise<SessionStartResult> {
  if (!isValidMode(input.mode)) {
    return { session: null, affirmations: [], error: 'Mode invalide (night ou day).' }
  }
  if (!(REPROG_CATEGORIES as readonly { id: string }[]).some(c => c.id === input.category)) {
    return { session: null, affirmations: [], error: 'Catégorie invalide.' }
  }
  const natureSound = input.nature_sound ?? 'silence'
  if (!isValidNatureSound(natureSound)) {
    return { session: null, affirmations: [], error: 'Son nature invalide.' }
  }

  const supabase = await createServerSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return { session: null, affirmations: [], error: 'Non authentifié — reconnecte-toi.' }
  }
  const profileId = await resolveProfileId(supabase)
  if (!profileId) {
    return { session: null, affirmations: [], error: 'Profil introuvable.' }
  }

  // Tire 50 affirmations shuffled (system + custom mix)
  let pool: Affirmation[]
  try {
    pool = await listForSession({ userId: profileId, category: input.category, limit: 50 })
  } catch {
    return { session: null, affirmations: [], error: 'Impossible de charger la banque d\'affirmations.' }
  }
  if (pool.length === 0) {
    return {
      session: null,
      affirmations: [],
      error: 'Aucune affirmation disponible pour cette catégorie — réessaie plus tard.',
    }
  }

  const sb = createServiceClient()
  const { data, error } = await sb
    .schema('mukti')
    .from('reprogramming_sessions')
    .insert({
      user_id: profileId,
      mode: input.mode,
      category: input.category,
      nature_sound: natureSound,
      volume_profile: input.volume_profile ?? 'adaptive',
      voice_guidance: input.voice_guidance ?? false,
      affirmations_count: 0,
      affirmations_played: [],
    })
    .select(
      'id, user_id, mode, category, started_at, ended_at, duration_sec, affirmations_played, affirmations_count, nature_sound, volume_profile, voice_guidance, created_at'
    )
    .single()

  if (error || !data) {
    return { session: null, affirmations: [], error: 'Impossible de démarrer la session.' }
  }

  return { session: data as ReprogrammingSession, affirmations: pool, error: null }
}

/**
 * Termine une session de reprogrammation.
 * Calcule duration_sec, persiste affirmations_played et count.
 */
export async function endSession(input: {
  sessionId: string
  affirmationsPlayed: string[]
}): Promise<{ session: ReprogrammingSession | null; error: string | null }> {
  if (!input.sessionId || typeof input.sessionId !== 'string') {
    return { session: null, error: 'Session invalide.' }
  }
  const played = (input.affirmationsPlayed ?? []).filter(
    id => typeof id === 'string' && id.length > 0
  )

  const supabase = await createServerSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return { session: null, error: 'Non authentifié — reconnecte-toi.' }
  }
  const profileId = await resolveProfileId(supabase)
  if (!profileId) {
    return { session: null, error: 'Profil introuvable.' }
  }

  const sb = createServiceClient()
  const { data: existing, error: readError } = await sb
    .schema('mukti')
    .from('reprogramming_sessions')
    .select('id, user_id, started_at, ended_at')
    .eq('id', input.sessionId)
    .eq('user_id', profileId)
    .single()
  if (readError || !existing) {
    return { session: null, error: 'Session introuvable.' }
  }
  if (existing.ended_at) {
    return { session: null, error: 'Session déjà terminée.' }
  }

  const startedAtMs = new Date(existing.started_at as string).getTime()
  const endedAt = new Date()
  const durationSec = Math.max(0, Math.round((endedAt.getTime() - startedAtMs) / 1000))

  const { data: updated, error: updateError } = await sb
    .schema('mukti')
    .from('reprogramming_sessions')
    .update({
      ended_at: endedAt.toISOString(),
      duration_sec: durationSec,
      affirmations_played: played,
      affirmations_count: played.length,
    })
    .eq('id', input.sessionId)
    .eq('user_id', profileId)
    .select(
      'id, user_id, mode, category, started_at, ended_at, duration_sec, affirmations_played, affirmations_count, nature_sound, volume_profile, voice_guidance, created_at'
    )
    .single()

  if (updateError || !updated) {
    return { session: null, error: 'Impossible de terminer la session.' }
  }
  return { session: updated as ReprogrammingSession, error: null }
}

/** Liste les 20 dernières sessions de l'utilisateur (historique). */
export async function listRecentSessions(opts: { limit?: number } = {}): Promise<{
  sessions: ReprogrammingSession[]
  error: string | null
}> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 20))
  const supabase = await createServerSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return { sessions: [], error: 'Non authentifié — reconnecte-toi.' }
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { sessions: [], error: 'Profil introuvable.' }

  const sb = createServiceClient()
  const { data, error } = await sb
    .schema('mukti')
    .from('reprogramming_sessions')
    .select(
      'id, user_id, mode, category, started_at, ended_at, duration_sec, affirmations_played, affirmations_count, nature_sound, volume_profile, voice_guidance, created_at'
    )
    .eq('user_id', profileId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) return { sessions: [], error: error.message }
  return { sessions: (data as ReprogrammingSession[]) ?? [], error: null }
}

/**
 * Calcule le prochain créneau notification journée (2h gap, 9h-19h local).
 * Pure-logic — utilisée par CRON notifs (G5.5) ou client-side scheduling.
 */
export function nextDayReminderHour(nowLocalHour: number): number | null {
  if (nowLocalHour < 0 || nowLocalHour > 23) return null
  const slots = REPROG_DAY_REMINDER_HOURS
  for (const h of slots) {
    if (h > nowLocalHour) return h
  }
  return null // aucun créneau restant aujourd'hui — reprendre demain
}

/** Courbe volume ramp linéaire descendante sur 30 min (mode nuit). */
export function computeRampVolume(elapsedSec: number, startVolume = 1.0): number {
  const rampSec = REPROG_NIGHT_VOLUME_RAMP_MIN * 60
  if (elapsedSec <= 0) return startVolume
  if (elapsedSec >= rampSec) return 0
  return Math.max(0, startVolume * (1 - elapsedSec / rampSec))
}

// Helper : résout profiles.id via auth_user_id
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
