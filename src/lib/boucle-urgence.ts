// MUKTI — G5.7 Boucle Urgence Invisible (Mode 9) — server helpers
// Ne PAS importer depuis un Client Component (utilise createServerSupabaseClient).
// Clients → importer depuis './boucle-urgence-utils'.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import {
  clampDurationSec,
  BOUCLE_URGENCE_MAX_DURATION_SEC,
  type BoucleUrgenceOutcome,
  type BoucleUrgenceTrigger,
} from './boucle-urgence-utils'

export {
  BOUCLE_URGENCE_DEFAULT_DURATION_SEC,
  BOUCLE_URGENCE_MIN_DURATION_SEC,
  BOUCLE_URGENCE_MAX_DURATION_SEC,
  BOUCLE_URGENCE_DURATION_CHOICES_SEC,
  BOUCLE_URGENCE_HAPTIC_PATTERN,
  BOUCLE_URGENCE_HAPTIC_INTERVAL_MS,
  BOUCLE_URGENCE_BREATH_CYCLE_MS,
  BOUCLE_URGENCE_WORD_INTERVAL_MS,
  BOUCLE_URGENCE_WORD_VISIBLE_MS,
  BOUCLE_URGENCE_WORDS_FR,
  pickWord,
  clampDurationSec,
} from './boucle-urgence-utils'
export type { BoucleUrgenceTrigger, BoucleUrgenceOutcome } from './boucle-urgence-utils'

export interface BoucleUrgenceSensorData {
  trigger?: BoucleUrgenceTrigger
  duration_sec_target?: number
  haptic_used?: boolean
  words_shown?: number
}

export interface BoucleUrgenceStats {
  total: number
  today_count: number
  avg_duration_sec: number
  best_streak_days: number
  current_streak_days: number
  recent: Array<{
    id: string
    started_at: string
    completed_at: string | null
    duration_sec: number | null
    outcome: BoucleUrgenceOutcome | null
    trigger: BoucleUrgenceTrigger | null
    duration_sec_target: number | null
  }>
}

/** Démarre une session : insère mode_sessions row, renvoie id. */
export async function startBoucleUrgenceSession(input: {
  trigger: BoucleUrgenceTrigger
  duration_sec_target: number
}): Promise<{ session_id: string } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Connexion requise.' }

  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { error: 'Profil introuvable.' }

  const service = createServiceClient()
  const target = clampDurationSec(input.duration_sec_target)

  const { data, error } = await service
    .schema('mukti')
    .from('mode_sessions')
    .insert({
      user_id: profileId,
      mode: 'boucle_urgence',
      started_at: new Date().toISOString(),
      sensor_data: {
        trigger: input.trigger,
        duration_sec_target: target,
      } satisfies BoucleUrgenceSensorData,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'Impossible d\'activer le camouflage — réessaie.' }
  }
  return { session_id: (data as { id: string }).id }
}

/** Complète une session : UPDATE outcome + duration. Idempotent. */
export async function completeBoucleUrgenceSession(input: {
  session_id: string
  outcome: BoucleUrgenceOutcome
  duration_sec: number
  haptic_used?: boolean
  words_shown?: number
}): Promise<{ ok: true; stats: BoucleUrgenceStats } | { error: string }> {
  if (!input.session_id || typeof input.session_id !== 'string') {
    return { error: 'Session invalide.' }
  }
  if (input.duration_sec < 0 || input.duration_sec > BOUCLE_URGENCE_MAX_DURATION_SEC + 5) {
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

  const { data: existing, error: readErr } = await service
    .schema('mukti')
    .from('mode_sessions')
    .select('id, user_id, mode, completed_at, sensor_data, started_at')
    .eq('id', input.session_id)
    .eq('user_id', profileId)
    .eq('mode', 'boucle_urgence')
    .maybeSingle()

  if (readErr || !existing) {
    return { error: 'Session introuvable.' }
  }
  const row = existing as {
    id: string
    completed_at: string | null
    sensor_data: Record<string, unknown>
  }
  if (row.completed_at) {
    const stats = await computeBoucleUrgenceStats(profileId)
    return { ok: true, stats }
  }

  const mergedSensor: BoucleUrgenceSensorData = {
    ...(row.sensor_data as BoucleUrgenceSensorData),
    haptic_used: Boolean(input.haptic_used),
    words_shown: Math.max(0, Math.min(999, Math.round(input.words_shown ?? 0))),
  }

  const { error: updErr } = await service
    .schema('mukti')
    .from('mode_sessions')
    .update({
      completed_at: new Date().toISOString(),
      duration_sec: Math.max(0, Math.round(input.duration_sec)),
      outcome: input.outcome,
      sensor_data: mergedSensor,
    })
    .eq('id', input.session_id)
    .eq('user_id', profileId)

  if (updErr) {
    return { error: 'Impossible d\'enregistrer la fin — réessaie.' }
  }

  const stats = await computeBoucleUrgenceStats(profileId)
  return { ok: true, stats }
}

/** Stats on-the-fly : total completed, today, avg duration, streak, 10 récents. */
export async function computeBoucleUrgenceStats(
  profileId: string
): Promise<BoucleUrgenceStats> {
  const service = createServiceClient()
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await service
    .schema('mukti')
    .from('mode_sessions')
    .select('id, started_at, completed_at, duration_sec, outcome, sensor_data')
    .eq('user_id', profileId)
    .eq('mode', 'boucle_urgence')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(500)

  const rows = (data ?? []) as Array<{
    id: string
    started_at: string
    completed_at: string | null
    duration_sec: number | null
    outcome: BoucleUrgenceOutcome | null
    sensor_data: BoucleUrgenceSensorData | null
  }>

  const completed = rows.filter(r => r.outcome === 'completed')
  const todayUtc = new Date().toISOString().slice(0, 10)

  const sumDuration = completed.reduce((acc, r) => acc + (r.duration_sec ?? 0), 0)
  const avg_duration_sec = completed.length ? Math.round(sumDuration / completed.length) : 0
  const today_count = completed.filter(r => r.started_at.slice(0, 10) === todayUtc).length

  const daySet = new Set<string>()
  for (const r of completed) daySet.add(r.started_at.slice(0, 10))
  const sortedDaysDesc = Array.from(daySet).sort((a, b) => (a < b ? 1 : -1))

  let current_streak_days = 0
  if (sortedDaysDesc.length > 0) {
    const first = sortedDaysDesc[0]!
    if (first === todayUtc || first === yesterdayUtc()) {
      let cursor = new Date(first + 'T00:00:00Z').getTime()
      for (const d of sortedDaysDesc) {
        const t = new Date(d + 'T00:00:00Z').getTime()
        if (t === cursor || t === cursor - 86400000) {
          current_streak_days += 1
          cursor = t - 86400000
        } else if (t < cursor - 86400000) {
          break
        }
      }
    }
  }

  let best_streak_days = 0
  let runLength = 0
  let previous: number | null = null
  const ascDays = Array.from(daySet)
    .map(d => new Date(d + 'T00:00:00Z').getTime())
    .sort((a, b) => a - b)
  for (const t of ascDays) {
    if (previous === null || t === previous + 86400000) runLength += 1
    else runLength = 1
    if (runLength > best_streak_days) best_streak_days = runLength
    previous = t
  }

  const recent = rows.slice(0, 10).map(r => ({
    id: r.id,
    started_at: r.started_at,
    completed_at: r.completed_at,
    duration_sec: r.duration_sec,
    outcome: r.outcome,
    trigger: (r.sensor_data?.trigger as BoucleUrgenceTrigger | undefined) ?? null,
    duration_sec_target: (r.sensor_data?.duration_sec_target as number | undefined) ?? null,
  }))

  return {
    total: completed.length,
    today_count,
    avg_duration_sec,
    best_streak_days: Math.max(best_streak_days, current_streak_days),
    current_streak_days,
    recent,
  }
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
