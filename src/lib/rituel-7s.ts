// MUKTI — Rituel 7 Secondes (G5.6) — server helpers
// Ne PAS importer depuis un Client Component (utilise createServerSupabaseClient).
// Clients → importer depuis './rituel-7s-utils'.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import {
  pickAffirmation,
  RITUEL_7S_MAX_DURATION_SEC,
  type Rituel7sOutcome,
  type Rituel7sTrigger,
} from './rituel-7s-utils'

// Re-export pure-logic helpers pour compatibilité ascendante (server callers).
// Les clients doivent importer directement depuis './rituel-7s-utils'.
export {
  RITUEL_7S_PHASES,
  RITUEL_7S_TOTAL_MS,
  RITUEL_7S_MAX_DURATION_SEC,
  RITUEL_7S_AFFIRMATIONS_FR,
  pickAffirmation,
} from './rituel-7s-utils'
export type {
  Rituel7sTrigger,
  Rituel7sOutcome,
  Rituel7sPhaseName,
  Rituel7sPhase,
  Rituel7sAffirmation,
} from './rituel-7s-utils'

// ===========================
// Types DB
// ===========================
export interface Rituel7sSession {
  id: string
  user_id: string
  mode: 'rituel_7s'
  started_at: string
  completed_at: string | null
  duration_sec: number | null
  outcome: Rituel7sOutcome | null
  sensor_data: {
    affirmation_text?: string
    trigger?: Rituel7sTrigger
    phase_durations_ms?: number[]
    haptic_used?: boolean
    audio_used?: boolean
  }
  created_at: string
}

export interface Rituel7sStreak {
  current_days: number
  best_days: number
  today_count: number
  total: number
  recent: Array<{
    id: string
    started_at: string
    completed_at: string | null
    duration_sec: number | null
    outcome: Rituel7sOutcome | null
    affirmation_text: string | null
    trigger: Rituel7sTrigger | null
  }>
}

// ===========================
// Server helpers
// ===========================

/** Démarre une session : insère mode_sessions row, renvoie id + affirmation */
export async function startRituel7sSession(input: {
  trigger: Rituel7sTrigger
}): Promise<{ session_id: string; affirmation_text: string } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Connexion requise.' }

  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { error: 'Profil introuvable.' }

  const affirmation_text = pickAffirmation()

  const service = createServiceClient()
  const { data, error } = await service
    .schema('mukti')
    .from('mode_sessions')
    .insert({
      user_id: profileId,
      mode: 'rituel_7s',
      started_at: new Date().toISOString(),
      sensor_data: {
        affirmation_text,
        trigger: input.trigger,
      },
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'Impossible de démarrer le rituel — réessaie.' }
  }
  return { session_id: (data as { id: string }).id, affirmation_text }
}

/** Complète une session : UPDATE outcome + duration + phase_durations. */
export async function completeRituel7sSession(input: {
  session_id: string
  outcome: Rituel7sOutcome
  duration_sec: number
  phase_durations_ms?: number[]
  haptic_used?: boolean
  audio_used?: boolean
}): Promise<{ ok: true; streak: Rituel7sStreak } | { error: string }> {
  if (!input.session_id || typeof input.session_id !== 'string') {
    return { error: 'Session invalide.' }
  }
  if (input.duration_sec < 0 || input.duration_sec > RITUEL_7S_MAX_DURATION_SEC) {
    return { error: 'Durée incohérente.' }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Connexion requise.' }

  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { error: 'Profil introuvable.' }

  const service = createServiceClient()

  // Ownership check + fetch existing sensor_data
  const { data: existing, error: readErr } = await service
    .schema('mukti')
    .from('mode_sessions')
    .select('id, user_id, mode, completed_at, sensor_data, started_at')
    .eq('id', input.session_id)
    .eq('user_id', profileId)
    .eq('mode', 'rituel_7s')
    .maybeSingle()

  if (readErr || !existing) {
    return { error: 'Session introuvable.' }
  }
  const row = existing as {
    id: string
    user_id: string
    mode: string
    completed_at: string | null
    sensor_data: Record<string, unknown>
    started_at: string
  }
  if (row.completed_at) {
    // Idempotent — renvoie streak sans re-update
    const streak = await computeRituel7sStreak(profileId)
    return { ok: true, streak }
  }

  const mergedSensor = {
    ...(row.sensor_data ?? {}),
    phase_durations_ms: input.phase_durations_ms ?? [],
    haptic_used: Boolean(input.haptic_used),
    audio_used: Boolean(input.audio_used),
  }

  const { error: updErr } = await service
    .schema('mukti')
    .from('mode_sessions')
    .update({
      completed_at: new Date().toISOString(),
      duration_sec: Math.round(input.duration_sec),
      outcome: input.outcome,
      sensor_data: mergedSensor,
    })
    .eq('id', input.session_id)
    .eq('user_id', profileId)

  if (updErr) {
    return { error: 'Impossible d\'enregistrer la fin — réessaie.' }
  }

  const streak = await computeRituel7sStreak(profileId)
  return { ok: true, streak }
}

/** Calcule streak (current/best) + today_count + total + 10 récents. */
export async function computeRituel7sStreak(profileId: string): Promise<Rituel7sStreak> {
  const service = createServiceClient()
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await service
    .schema('mukti')
    .from('mode_sessions')
    .select('id, started_at, completed_at, duration_sec, outcome, sensor_data')
    .eq('user_id', profileId)
    .eq('mode', 'rituel_7s')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(500)

  const rows = (data ?? []) as Array<{
    id: string
    started_at: string
    completed_at: string | null
    duration_sec: number | null
    outcome: Rituel7sOutcome | null
    sensor_data: { affirmation_text?: string; trigger?: Rituel7sTrigger } | null
  }>

  const completedRows = rows.filter(r => r.outcome === 'completed')

  // Streak logic : distinct days (UTC) des completed
  const daySet = new Set<string>()
  for (const r of completedRows) {
    daySet.add(r.started_at.slice(0, 10)) // YYYY-MM-DD UTC
  }
  const sortedDaysDesc = Array.from(daySet).sort((a, b) => (a < b ? 1 : -1))

  const todayUtc = new Date().toISOString().slice(0, 10)
  let current_days = 0
  if (sortedDaysDesc.length > 0) {
    const first = sortedDaysDesc[0]!
    if (first === todayUtc || first === yesterdayUtc()) {
      // Commence streak aujourd'hui ou hier (tolérance 1j si pas encore fait aujourd'hui)
      let cursor = new Date(first + 'T00:00:00Z').getTime()
      for (const d of sortedDaysDesc) {
        const t = new Date(d + 'T00:00:00Z').getTime()
        if (t === cursor || t === cursor - 86400000) {
          current_days += 1
          cursor = t - 86400000
        } else if (t < cursor - 86400000) {
          break
        }
      }
    }
  }

  // Best streak = plus longue séquence consécutive
  let best_days = 0
  let runLength = 0
  let previous: number | null = null
  const ascDays = Array.from(daySet)
    .map(d => new Date(d + 'T00:00:00Z').getTime())
    .sort((a, b) => a - b)
  for (const t of ascDays) {
    if (previous === null || t === previous + 86400000) {
      runLength += 1
    } else {
      runLength = 1
    }
    if (runLength > best_days) best_days = runLength
    previous = t
  }

  const today_count = completedRows.filter(r => r.started_at.slice(0, 10) === todayUtc).length
  const total = completedRows.length

  const recent = rows.slice(0, 10).map(r => ({
    id: r.id,
    started_at: r.started_at,
    completed_at: r.completed_at,
    duration_sec: r.duration_sec,
    outcome: r.outcome,
    affirmation_text: (r.sensor_data?.affirmation_text as string | undefined) ?? null,
    trigger: (r.sensor_data?.trigger as Rituel7sTrigger | undefined) ?? null,
  }))

  return { current_days, best_days: Math.max(best_days, current_days), today_count, total, recent }
}

function yesterdayUtc(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10)
}

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
