// The historical routes are kept, but no random or financial reward is issued here.
// Daily recognition is a separate, free record. Legacy receipts remain unchanged.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import {
  RECOGNITION_FORMAT,
  RECOGNITION_TIME_ZONE,
  isDailyRecognition,
  isLegacyMysteryReward,
  recognitionHistoryLimit,
  utcRecognitionDate,
  type DailyRecognition,
  type LegacyMysteryReward,
  type RecognitionOverview,
} from './daily-recognition'

export type MysteryReward = LegacyMysteryReward

export class RecognitionError extends Error {
  constructor(message: string, public readonly status = 503) {
    super(message)
    this.name = 'RecognitionError'
  }
}

const UNAVAILABLE = 'Enregistrement indisponible. Réessaie plus tard.'
const HISTORY_UNAVAILABLE = 'Historique indisponible. Réessaie plus tard.'

async function resolveProfileId(): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new RecognitionError('Connexion requise.', 401)
  const { data, error } = await supabase
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (error) throw new RecognitionError(UNAVAILABLE)
  if (!data?.id) throw new RecognitionError('Profil introuvable — reconnecte-toi.', 409)
  return data.id as string
}

/**
 * Compatibility name for the old endpoint. The database owns the UTC day and
 * serializes concurrent calls with UNIQUE(user_id, recognition_date).
 * There is no activity check, streak, amount, wallet write or benefit to redeem.
 */
export async function claimDailyChest(): Promise<{
  recognition: DailyRecognition
  alreadyClaimed: boolean
}> {
  const profileId = await resolveProfileId()
  const service = createServiceClient()
  const { data, error } = await service.schema('mukti').rpc('record_daily_recognition', {
    p_profile_id: profileId,
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new RecognitionError(UNAVAILABLE)
  }
  const result = data as Record<string, unknown>
  if (!isDailyRecognition(result.recognition) || typeof result.already_recorded !== 'boolean') {
    throw new RecognitionError(UNAVAILABLE)
  }
  return { recognition: result.recognition, alreadyClaimed: result.already_recorded }
}

function legacyRows(data: unknown): LegacyMysteryReward[] {
  if (!Array.isArray(data)) throw new RecognitionError(HISTORY_UNAVAILABLE)
  return data.map(row => {
    const legacy: unknown = row && typeof row === 'object'
      ? { ...row, delivery_status: 'unknown' }
      : null
    if (!isLegacyMysteryReward(legacy)) throw new RecognitionError(HISTORY_UNAVAILABLE)
    return legacy
  })
}

/** Legacy history only; does not infer delivery or adjust any historical balance. */
export async function listRewards(limit = 14): Promise<LegacyMysteryReward[]> {
  const profileId = await resolveProfileId()
  const { data, error } = await createServiceClient()
    .schema('mukti')
    .from('mystery_rewards')
    .select('id, claim_date, tier, reward_type, reward_amount, streak_day, claimed_at')
    .eq('user_id', profileId)
    .order('claim_date', { ascending: false })
    .limit(recognitionHistoryLimit(limit))
  if (error) throw new RecognitionError(HISTORY_UNAVAILABLE)
  return legacyRows(data)
}

export async function getRecognitionOverview(limit = 14): Promise<RecognitionOverview> {
  const profileId = await resolveProfileId()
  const service = createServiceClient()
  const count = recognitionHistoryLimit(limit)
  const today = utcRecognitionDate()
  const [recognitionsResult, legacyResult] = await Promise.all([
    service.schema('mukti').from('daily_recognitions')
      .select('id, recognition_date, recognized_at')
      .eq('user_id', profileId)
      .order('recognition_date', { ascending: false })
      .limit(count),
    service.schema('mukti').from('mystery_rewards')
      .select('id, claim_date, tier, reward_type, reward_amount, streak_day, claimed_at')
      .eq('user_id', profileId)
      .order('claim_date', { ascending: false })
      .limit(count),
  ])
  if (recognitionsResult.error || legacyResult.error
    || !Array.isArray(recognitionsResult.data)
    || !recognitionsResult.data.every(isDailyRecognition)) {
    throw new RecognitionError(HISTORY_UNAVAILABLE)
  }
  const recognitions = recognitionsResult.data as DailyRecognition[]
  return {
    format: RECOGNITION_FORMAT,
    time_zone: RECOGNITION_TIME_ZONE,
    today,
    recognition: recognitions.find(row => row.recognition_date === today) ?? null,
    recognitions,
    legacy_rewards: legacyRows(legacyResult.data),
  }
}
