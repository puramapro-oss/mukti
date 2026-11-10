import { createServiceClient } from './supabase'
import { localDay, normalizeTimeZone } from './wellbeing-date'
import type { WellbeingContext, WellbeingValues, FeedbackValues } from './wellbeing-state'
import { FEEDBACK_DELAY_MS, FeedbackReceipt } from './wellbeing-state'
import type { AuroraVariant } from './constants/aurora'

export async function getWellbeingContext(userId: string, timeZone?: string, now = new Date()) {
  const zone = normalizeTimeZone(timeZone)
  const day = localDay(now, zone)
  const { data, error } = await createServiceClient().schema('mukti').from('wellbeing_checkins')
    .select('day, physical, cognitive, sensory, social, minutes, time_zone, updated_at')
    .eq('user_id', userId).eq('day', day).maybeSingle()
  if (error) throw new Error('Disponibilité du jour indisponible. Réessaie.')
  return { context: data as WellbeingContext | null, day, time_zone: zone }
}

export async function saveWellbeingContext(userId: string, input: WellbeingValues, now = new Date()) {
  const { consent: _consent, ...values } = input
  const day = localDay(now, values.time_zone)
  const { data, error } = await createServiceClient().schema('mukti').from('wellbeing_checkins')
    .upsert({ ...values, user_id: userId, day, consent_version: 'wellbeing-v1', updated_at: now.toISOString() },
      { onConflict: 'user_id,day' })
    .select('day, physical, cognitive, sensory, social, minutes, time_zone, updated_at').single()
  if (error || !data) throw new Error('Enregistrement non confirmé. Tes choix restent affichés pour réessayer.')
  return { context: data as WellbeingContext, day, time_zone: values.time_zone }
}

export async function deleteWellbeingContext(userId: string) {
  const { error } = await createServiceClient().schema('mukti').from('wellbeing_checkins').delete().eq('user_id', userId)
  if (error) throw new Error('Suppression non confirmée. Réessaie.')
}

export interface FeedbackSession {
  id: string; variant: AuroraVariant; completed_at: string
  feedback: Array<{ stage: 'immediate' | 'later'; feeling: FeedbackValues['feeling']; discomfort: boolean; created_at: string }>
  later_available_at: string
}

export async function getWellbeingFeedback(userId: string) {
  const sb = createServiceClient().schema('mukti')
  const [sessions, pauses] = await Promise.all([
    sb.from('aurora_sessions').select('id, variant, completed_at').eq('user_id', userId)
      .not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(8),
    sb.from('wellbeing_suggestion_pauses').select('variant').eq('user_id', userId),
  ])
  if (sessions.error || pauses.error || !Array.isArray(sessions.data) || !Array.isArray(pauses.data)) throw new Error('Retours indisponibles. Réessaie.')
  const rows = (sessions.data ?? []) as Array<{ id: string; variant: AuroraVariant; completed_at: string }>
  const feedback = rows.length ? await sb.from('aurora_feedback')
    .select('session_id, stage, feeling, discomfort, created_at').eq('user_id', userId)
    .in('session_id', rows.map((row) => row.id)) : { data: [], error: null }
  if (feedback.error || !Array.isArray(feedback.data)) throw new Error('Retours indisponibles. Réessaie.')
  return {
    sessions: rows.map((row) => ({
      ...row,
      later_available_at: new Date(new Date(row.completed_at).getTime() + FEEDBACK_DELAY_MS).toISOString(),
      feedback: (feedback.data ?? []).filter((item) => item.session_id === row.id)
        .map(({ stage, feeling, discomfort, created_at }) => ({ stage, feeling, discomfort, created_at })),
    })) as FeedbackSession[],
    paused_variants: (pauses.data ?? []).map((row) => row.variant as AuroraVariant),
  }
}

export async function saveWellbeingFeedback(userId: string, input: FeedbackValues) {
  // One database transaction records the response and pauses future suggestions when needed.
  const { data, error } = await createServiceClient().schema('mukti').rpc('record_aurora_feedback', {
    p_user_id: userId, p_session_id: input.session_id, p_stage: input.stage,
    p_feeling: input.feeling, p_discomfort: input.discomfort,
  })
  if (error) {
    if (error.code === '22023' || error.code === 'P0002') return { ok: false, status: 400, error: 'Séance introuvable ou retour ultérieur pas encore disponible.' }
    return { ok: false, status: 503, error: 'Retour non enregistré. Réessaie.' }
  }
  const receipt = FeedbackReceipt.safeParse(data)
  if (!receipt.success) return { ok: false, status: 503, error: 'Enregistrement non confirmé. Réessaie avec le même retour.' }
  return { ok: true, status: 200, result: receipt.data }
}

export async function deleteWellbeingFeedback(userId: string) {
  // Keep deliberate suggestion pauses; deleting personal feedback must not silently resume them.
  const { error } = await createServiceClient().schema('mukti').from('aurora_feedback').delete().eq('user_id', userId)
  if (error) throw new Error('Suppression non confirmée. Réessaie.')
}

export async function resumeWellbeingSuggestion(userId: string, variant: AuroraVariant) {
  const { error } = await createServiceClient().schema('mukti').from('wellbeing_suggestion_pauses')
    .delete().eq('user_id', userId).eq('variant', variant)
  if (error) throw new Error('Reprise des suggestions non confirmée. Réessaie.')
}
