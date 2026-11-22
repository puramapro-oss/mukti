// One declared participation per owner, habit and local calendar day.
// Rest is recorded separately from a completed practice; no reward is issued here.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { MINIMAL_RITUAL_HABITS, type MinimalRitualHabit } from './constants/core-events'
import {
  isMinimalRitualParticipationMode,
  type MinimalRitualParticipationMode,
} from './constants/minimal-ritual'
import { DEFAULT_WELLBEING_TIME_ZONE, localDay, normalizeTimeZone } from './wellbeing-date'

export interface MinimalTick {
  id: string
  user_id: string
  habit_slug: MinimalRitualHabit
  tick_date: string
  tick_at: string
  participation_mode: MinimalRitualParticipationMode
  time_zone: string
}

export interface HabitStatus {
  slug: MinimalRitualHabit
  recorded_today: boolean
  ticked_today: boolean
  participation_mode: MinimalRitualParticipationMode | null
  /** Historical information only; never used for a reward or a penalty. */
  streak_days: number
  /** All recorded days, including explicit rest. It does not reset after a gap. */
  progress_days: number
  practice_days: number
  rest_days: number
}

export interface MinimalRitualToday {
  habits: HabitStatus[]
  day: string
  time_zone: string
}

export class MinimalRitualError extends Error {
  constructor(message: string, public readonly status: number = 503) {
    super(message)
    this.name = 'MinimalRitualError'
  }
}

export interface MinimalTickResult {
  recorded: boolean
  ticked: boolean
  already: boolean
  error: string | null
  status: number
  participation_mode?: MinimalRitualParticipationMode
  day?: string
  time_zone?: string
  habits?: HabitStatus[]
  status_warning?: string
}

type ServiceClient = ReturnType<typeof createServiceClient>
type StoredTick = Pick<MinimalTick, 'id' | 'user_id' | 'habit_slug' | 'tick_date' | 'participation_mode' | 'time_zone'>
const TICK_FIELDS = 'id,user_id,habit_slug,tick_date,participation_mode,time_zone'

export function isMinimalHabit(value: unknown): value is MinimalRitualHabit {
  return typeof value === 'string'
    && (MINIMAL_RITUAL_HABITS as readonly { slug: string }[]).some(habit => habit.slug === value)
}

function requestTimeZone(value: unknown): string {
  try {
    return normalizeTimeZone(value)
  } catch {
    throw new MinimalRitualError('Fuseau horaire invalide.', 400)
  }
}

function errorResult(error: unknown): MinimalTickResult {
  const known = error instanceof MinimalRitualError
    ? error
    : new MinimalRitualError('Enregistrement non confirmé. Réessaie dans un instant.')
  return { recorded: false, ticked: false, already: false, error: known.message, status: known.status }
}

function confirmedTick(value: unknown, profileId: string, slug: MinimalRitualHabit, day: string): StoredTick | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || !row.id
    || row.user_id !== profileId || row.habit_slug !== slug || row.tick_date !== day
    || !isMinimalRitualParticipationMode(row.participation_mode)
    || typeof row.time_zone !== 'string' || !row.time_zone) return null
  return row as unknown as StoredTick
}

/** Insert first: only PostgreSQL 23505 followed by an owner-scoped read confirms a retry. */
export async function tickHabit(
  slug: string,
  participationMode: unknown = 'standard',
  timeZone: unknown = DEFAULT_WELLBEING_TIME_ZONE,
  now: Date = new Date(),
): Promise<MinimalTickResult> {
  if (!isMinimalHabit(slug)) {
    return errorResult(new MinimalRitualError('Habitude invalide.', 400))
  }
  if (!isMinimalRitualParticipationMode(participationMode)) {
    return errorResult(new MinimalRitualError('Choix de participation invalide.', 400))
  }

  try {
    const zone = requestTimeZone(timeZone)
    const day = localDay(now, zone)
    const supabase = await createServerSupabaseClient()
    const profileId = await resolveProfileId(supabase)
    const service = createServiceClient()

    const { data, error } = await service.schema('mukti').from('minimal_ritual_ticks')
      .insert({ user_id: profileId, habit_slug: slug, tick_date: day, participation_mode: participationMode, time_zone: zone })
      .select(TICK_FIELDS)
      .single()

    let stored = confirmedTick(data, profileId, slug, day)
    let already = false
    if (!error && stored
      && (stored.participation_mode !== participationMode || stored.time_zone !== zone)) {
      throw new MinimalRitualError('Enregistrement non confirmé. Réessaie dans un instant.')
    }
    if (error) {
      if (error.code !== '23505') {
        throw new MinimalRitualError('Enregistrement non confirmé. Réessaie dans un instant.')
      }
      const { data: existing, error: readError } = await service.schema('mukti').from('minimal_ritual_ticks')
        .select(TICK_FIELDS)
        .eq('user_id', profileId)
        .eq('habit_slug', slug)
        .eq('tick_date', day)
        .maybeSingle()
      if (readError) {
        throw new MinimalRitualError('Impossible de vérifier le choix déjà enregistré. Réessaie dans un instant.')
      }
      stored = confirmedTick(existing, profileId, slug, day)
      if (!stored) {
        throw new MinimalRitualError('Enregistrement non confirmé. Réessaie dans un instant.')
      }
      already = true
    }
    if (!stored) {
      throw new MinimalRitualError('Enregistrement non confirmé. Réessaie dans un instant.')
    }

    const result: MinimalTickResult = {
      recorded: true,
      ticked: stored.participation_mode !== 'rest',
      already,
      error: null,
      status: 200,
      participation_mode: stored.participation_mode,
      day: stored.tick_date,
      time_zone: zone,
    }
    // A failed refresh must not hide an already confirmed write or fabricate a count.
    try {
      const habits = await readStatuses(service, profileId, day)
      const savedStatus = habits.find(habit => habit.slug === slug)
      if (!savedStatus?.recorded_today || savedStatus.participation_mode !== stored.participation_mode) {
        throw new MinimalRitualError('Récapitulatif indisponible.')
      }
      result.habits = habits
    } catch {
      result.status_warning = 'Ton choix est enregistré. Le récapitulatif est momentanément indisponible.'
    }
    return result
  } catch (error) {
    return errorResult(error)
  }
}

export async function loadMinimalRitualToday(
  timeZone: unknown = DEFAULT_WELLBEING_TIME_ZONE,
  now: Date = new Date(),
): Promise<MinimalRitualToday> {
  const zone = requestTimeZone(timeZone)
  const day = localDay(now, zone)
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  const habits = await readStatuses(createServiceClient(), profileId, day)
  return { habits, day, time_zone: zone }
}

/** Retained for callers that only need the list; failures are never returned as an empty success. */
export async function todayStatus(timeZone: unknown = DEFAULT_WELLBEING_TIME_ZONE, now: Date = new Date()): Promise<HabitStatus[]> {
  return (await loadMinimalRitualToday(timeZone, now)).habits
}

function countValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !/^\d+$/.test(value)) return null
  const count = Number(value)
  return Number.isSafeInteger(count) && count >= 0 ? count : null
}

async function readStatuses(service: ServiceClient, profileId: string, day: string): Promise<HabitStatus[]> {
  const { data, error } = await service.schema('mukti').rpc('minimal_ritual_summary', {
    p_user_id: profileId,
    p_today: day,
  })
  if (error || !Array.isArray(data)) {
    throw new MinimalRitualError('Impossible de lire tes choix enregistrés. Réessaie dans un instant.')
  }

  const byHabit = new Map<MinimalRitualHabit, HabitStatus>()
  for (const value of data as unknown[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new MinimalRitualError('Récapitulatif indisponible. Réessaie dans un instant.')
    }
    const row = value as Record<string, unknown>
    const progress = countValue(row.progress_days)
    const practice = countValue(row.practice_days)
    const rest = countValue(row.rest_days)
    const streak = countValue(row.streak_days)
    if (!isMinimalHabit(row.habit_slug) || byHabit.has(row.habit_slug)
      || typeof row.recorded_today !== 'boolean' || typeof row.ticked_today !== 'boolean'
      || (row.mode_today !== null && !isMinimalRitualParticipationMode(row.mode_today))
      || progress === null || practice === null || rest === null || streak === null
      || progress !== practice + rest || streak > progress
      || (row.recorded_today && progress < 1)
      || (row.ticked_today && practice < 1)
      || (row.mode_today === 'rest' && rest < 1)
      || row.recorded_today !== (row.mode_today !== null)
      || row.ticked_today !== (row.mode_today !== null && row.mode_today !== 'rest')) {
      throw new MinimalRitualError('Récapitulatif indisponible. Réessaie dans un instant.')
    }
    byHabit.set(row.habit_slug, {
      slug: row.habit_slug,
      recorded_today: row.recorded_today,
      ticked_today: row.ticked_today,
      participation_mode: row.mode_today as MinimalRitualParticipationMode | null,
      streak_days: streak,
      progress_days: progress,
      practice_days: practice,
      rest_days: rest,
    })
  }
  return MINIMAL_RITUAL_HABITS.map(habit => byHabit.get(habit.slug) ?? {
    slug: habit.slug, recorded_today: false, ticked_today: false, participation_mode: null,
    streak_days: 0, progress_days: 0, practice_days: 0, rest_days: 0,
  })
}

async function resolveProfileId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>): Promise<string> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new MinimalRitualError('Connexion requise pour retrouver tes choix.', 401)
  const { data, error } = await supabase.schema('mukti').from('profiles')
    .select('id').eq('auth_user_id', user.id).maybeSingle()
  if (error) throw new MinimalRitualError('Impossible de lire ton profil. Réessaie dans un instant.')
  const id = (data as { id?: unknown } | null)?.id
  if (typeof id !== 'string' || !id) throw new MinimalRitualError('Profil introuvable. Reconnecte-toi.', 404)
  return id
}
