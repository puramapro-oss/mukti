import { AURORA_LEVELS, type AuroraLevel } from './constants/aurora'

export interface AuroraCompletionInput {
  session_id: string
  user_id: string
  phases_completed: Array<{ phase: string; duration_sec: number; breaths_counted: number; coherence: number | null }>
  coherence_score: number
  stopped_reason: 'user_stop' | 'dizzy' | 'glide_out_complete' | 'timeout' | 'error'
  total_duration_sec: number
}
export interface AuroraCompletionResult {
  ok: boolean
  error: string | null
  level_reached: AuroraLevel | null
  streak_days: number
}
export type AuroraCompletionRpc = (
  name: string,
  parameters: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const phaseNames = ['armement', 'double_sigh', 'resonance_core', 'omega_lock', 'glide_out']
const stopReasons = ['user_stop', 'dizzy', 'glide_out_complete', 'timeout', 'error']
const finiteRange = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
const failure = (message = 'Enregistrement non confirmé. Réessaie.') : AuroraCompletionResult =>
  ({ ok: false, error: message, level_reached: null, streak_days: 0 })

/** Server-side adapter. Never falls back to non-transactional writes or retries a mutation. */
export async function completeAuroraSession(
  rpc: AuroraCompletionRpc,
  input: AuroraCompletionInput,
): Promise<AuroraCompletionResult> {
  if (!input || !UUID.test(input.session_id) || !UUID.test(input.user_id)
      || !finiteRange(input.total_duration_sec, 0, 1800)
      || !finiteRange(input.coherence_score, 0, 1)
      || !stopReasons.includes(input.stopped_reason)
      || !Array.isArray(input.phases_completed)
      || input.phases_completed.length < 1 || input.phases_completed.length > 5) {
    return failure('Données de séance invalides.')
  }
  let duration = 0
  for (const [index, phase] of input.phases_completed.entries()) {
    if (!phase || phase.phase !== phaseNames[index]
        || !finiteRange(phase.duration_sec, 0, 1800)
        || !finiteRange(phase.breaths_counted, 0, 500) || !Number.isInteger(phase.breaths_counted)
        || (phase.coherence !== null && !finiteRange(phase.coherence, 0, 1))) {
      return failure('Données de séance invalides.')
    }
    duration += phase.duration_sec
  }
  if (Math.abs(duration - input.total_duration_sec) > 0.11) return failure('Durée de séance incohérente.')

  try {
    const { data, error } = await rpc('aurora_complete_session_atomic_v1', {
      p_session_id: input.session_id,
      p_user_id: input.user_id,
      p_phases_completed: input.phases_completed,
      p_coherence_score: input.coherence_score,
      p_stopped_reason: input.stopped_reason,
      p_total_duration_sec: input.total_duration_sec,
    })
    // A missing migration, a failed transaction or an invalid response is never a success.
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return failure()
    const result = data as Record<string, unknown>
    if (result.ok !== true) {
      return failure(result.error === 'Session introuvable.' || result.error === 'Session déjà complétée.'
        ? result.error : undefined)
    }
    const level = AURORA_LEVELS.find(entry => entry.id === result.level_reached)?.id
    if (!level || !finiteRange(result.streak_days, 1, 2_147_483_647) || !Number.isInteger(result.streak_days)
        || result.error != null) return failure()
    return { ok: true, error: null, level_reached: level, streak_days: result.streak_days }
  } catch {
    return failure()
  }
}
