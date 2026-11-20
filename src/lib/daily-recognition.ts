/** Shared, non-financial contract for the former daily reward screen. */
export const RECOGNITION_FORMAT = 'daily-recognition-v1' as const
export const RECOGNITION_TIME_ZONE = 'UTC' as const
export const RECOGNITION_MESSAGE = 'Ta journée compte, à ton rythme.'

export interface DailyRecognition {
  id: string
  recognition_date: string
  recognized_at: string
}

/** Historical data only. An old receipt is not proof that a benefit was delivered. */
export interface LegacyMysteryReward {
  id: string
  claim_date: string
  tier: 'common' | 'rare' | 'legendary' | 'jackpot'
  reward_type: 'points' | 'coupon' | 'booster' | 'coin' | 'xp' | 'nothing'
  reward_amount: number
  streak_day: number
  claimed_at: string
  delivery_status: 'unknown'
}

export interface RecognitionOverview {
  format: typeof RECOGNITION_FORMAT
  time_zone: typeof RECOGNITION_TIME_ZONE
  today: string
  recognition: DailyRecognition | null
  recognitions: DailyRecognition[]
  legacy_rewards: LegacyMysteryReward[]
}

export const LEGACY_REWARD_LABELS: Record<LegacyMysteryReward['reward_type'], string> = {
  points: 'Points',
  coupon: 'Coupon',
  booster: 'Booster',
  coin: 'Coin',
  xp: 'XP',
  nothing: 'Aucun avantage',
}

export function utcRecognitionDate(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function recognitionHistoryLimit(limit: number): number {
  return Number.isFinite(limit) ? Math.max(1, Math.min(60, Math.floor(limit))) : 14
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isRecognitionDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && utcRecognitionDate(date) === value
}

export function isDailyRecognition(value: unknown): value is DailyRecognition {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return false
  if (!isRecognitionDate(value.recognition_date) || typeof value.recognized_at !== 'string') return false
  const time = new Date(value.recognized_at)
  return Number.isFinite(time.getTime()) && utcRecognitionDate(time) === value.recognition_date
}

export function isLegacyMysteryReward(value: unknown): value is LegacyMysteryReward {
  return isRecord(value)
    && typeof value.id === 'string'
    && !!value.id
    && isRecognitionDate(value.claim_date)
    && typeof value.tier === 'string'
    && ['common', 'rare', 'legendary', 'jackpot'].includes(value.tier)
    && typeof value.reward_type === 'string'
    && Object.hasOwn(LEGACY_REWARD_LABELS, value.reward_type)
    && typeof value.reward_amount === 'number'
    && Number.isSafeInteger(value.reward_amount)
    && value.reward_amount >= 0
    && typeof value.streak_day === 'number'
    && Number.isSafeInteger(value.streak_day)
    && value.streak_day >= 1
    && typeof value.claimed_at === 'string'
    && Number.isFinite(new Date(value.claimed_at).getTime())
    && value.delivery_status === 'unknown'
}

export function isRecognitionOverview(value: unknown): value is RecognitionOverview {
  if (!isRecord(value)
    || value.format !== RECOGNITION_FORMAT
    || value.time_zone !== RECOGNITION_TIME_ZONE
    || !isRecognitionDate(value.today)
    || !Array.isArray(value.recognitions)
    || !value.recognitions.every(isDailyRecognition)
    || !Array.isArray(value.legacy_rewards)
    || !value.legacy_rewards.every(isLegacyMysteryReward)) return false
  return value.recognition === null
    || (isDailyRecognition(value.recognition) && value.recognition.recognition_date === value.today)
}

/** A repeated response or another tab must never duplicate the same daily entry. */
export function mergeRecognitionHistory(
  history: DailyRecognition[],
  recognition: DailyRecognition,
  limit = 14,
): DailyRecognition[] {
  return [recognition, ...history.filter(row =>
    row.id !== recognition.id && row.recognition_date !== recognition.recognition_date)]
    .sort((a, b) => b.recognition_date.localeCompare(a.recognition_date))
    .slice(0, recognitionHistoryLimit(limit))
}
