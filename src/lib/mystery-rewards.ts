// MUKTI — G6 Mode 18 Récompenses Mystères
// Roll côté serveur, 1 claim par user+date (idempotent via UNIQUE constraint).
// Probas écrites dans constants.ts, auditables.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import {
  MYSTERY_REWARD_TIERS,
  MYSTERY_STREAK_BONUSES,
  type MysteryTier,
} from './constants'

export interface MysteryReward {
  id: string
  user_id: string
  claim_date: string // YYYY-MM-DD
  tier: MysteryTier
  reward_type: 'points' | 'coupon' | 'booster' | 'coin' | 'xp' | 'nothing'
  reward_amount: number
  reward_meta: Record<string, unknown> | null
  streak_day: number
  claimed_at: string
}

interface RolledReward {
  tier: MysteryTier
  reward_type: MysteryReward['reward_type']
  reward_amount: number
  reward_meta: Record<string, unknown> | null
}

/** Deterministic-ish seeded roll based on user_id + date. */
function rollReward(userId: string, date: string): RolledReward {
  // Deterministic hash for audit fairness: same user+date → same roll (anti-abuse via replay).
  let seed = 0
  const key = `${userId}:${date}`
  for (let i = 0; i < key.length; i++) {
    seed = (seed * 31 + key.charCodeAt(i)) | 0
  }
  // Mulberry32 PRNG from seed
  const rand = () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296)
  }

  const total = MYSTERY_REWARD_TIERS.reduce((s, t) => s + t.probability, 0)
  const pick = rand() * total
  let acc = 0
  const chosen = MYSTERY_REWARD_TIERS.find(t => {
    acc += t.probability
    return pick < acc
  })
  if (!chosen) {
    return { tier: 'common', reward_type: 'nothing', reward_amount: 0, reward_meta: null }
  }
  const amount = Math.round(
    chosen.min_amount + rand() * (chosen.max_amount - chosen.min_amount)
  )
  const rewardType = chosen.rewards[Math.floor(rand() * chosen.rewards.length)]!
  return {
    tier: chosen.tier,
    reward_type: rewardType as MysteryReward['reward_type'],
    reward_amount: rewardType === 'nothing' ? 0 : amount,
    reward_meta: { probability_pool: chosen.probability, total_pool: total },
  }
}

/** Apply streak bonus multiplier to reward_amount. */
function applyStreakBonus(amount: number, streakDay: number): number {
  let multiplier = 1
  for (const b of MYSTERY_STREAK_BONUSES) {
    if (streakDay >= b.min_streak) multiplier = b.multiplier
  }
  return Math.round(amount * multiplier)
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Compute current streak for user (consecutive days claimed). */
async function computeStreak(userId: string): Promise<number> {
  const sb = createServiceClient()
  const { data } = await sb
    .schema('mukti')
    .from('mystery_rewards')
    .select('claim_date')
    .eq('user_id', userId)
    .order('claim_date', { ascending: false })
    .limit(60)
  const dates = new Set((data ?? []).map(r => (r as { claim_date: string }).claim_date))
  let streak = 0
  const cursor = new Date()
  // Start from yesterday (today's claim hasn't happened yet)
  cursor.setUTCDate(cursor.getUTCDate() - 1)
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak + 1 // +1 because today's claim extends
}

/** Claim today's mystery chest. Idempotent. */
export async function claimDailyChest(): Promise<{
  reward: MysteryReward | null
  alreadyClaimed: boolean
  error: string | null
}> {
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) {
    return { reward: null, alreadyClaimed: false, error: 'Profil introuvable — reconnecte-toi.' }
  }

  const date = todayUtc()
  const sb = createServiceClient()

  // Check if already claimed today
  const { data: existing } = await sb
    .schema('mukti')
    .from('mystery_rewards')
    .select('*')
    .eq('user_id', profileId)
    .eq('claim_date', date)
    .maybeSingle()
  if (existing) {
    return { reward: existing as MysteryReward, alreadyClaimed: true, error: null }
  }

  const streak = await computeStreak(profileId)
  const roll = rollReward(profileId, date)
  const finalAmount = applyStreakBonus(roll.reward_amount, streak)

  const { data, error } = await sb
    .schema('mukti')
    .from('mystery_rewards')
    .insert({
      user_id: profileId,
      claim_date: date,
      tier: roll.tier,
      reward_type: roll.reward_type,
      reward_amount: finalAmount,
      reward_meta: { ...roll.reward_meta, streak_bonus_applied: finalAmount !== roll.reward_amount },
      streak_day: streak,
    })
    .select('*')
    .single()
  if (error || !data) {
    // Race condition : row was inserted concurrently. Re-fetch.
    const { data: retry } = await sb
      .schema('mukti')
      .from('mystery_rewards')
      .select('*')
      .eq('user_id', profileId)
      .eq('claim_date', date)
      .maybeSingle()
    if (retry) return { reward: retry as MysteryReward, alreadyClaimed: true, error: null }
    return { reward: null, alreadyClaimed: false, error: 'Impossible de réclamer le coffre.' }
  }

  // If reward_type=points, credit purama_points
  if (roll.reward_type === 'points' && finalAmount > 0) {
    try {
      const { data: profile } = await sb
        .schema('mukti')
        .from('profiles')
        .select('purama_points')
        .eq('id', profileId)
        .maybeSingle()
      const currentPoints = (profile as { purama_points: number } | null)?.purama_points ?? 0
      await sb
        .schema('mukti')
        .from('profiles')
        .update({ purama_points: currentPoints + finalAmount })
        .eq('id', profileId)
    } catch {
      // Non-blocking : le reward reste enregistré
    }
  }

  return { reward: data as MysteryReward, alreadyClaimed: false, error: null }
}

export async function listRewards(limit: number = 14): Promise<MysteryReward[]> {
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return []
  const sb = createServiceClient()
  const { data } = await sb
    .schema('mukti')
    .from('mystery_rewards')
    .select('*')
    .eq('user_id', profileId)
    .order('claim_date', { ascending: false })
    .limit(Math.max(1, Math.min(60, limit)))
  return (data ?? []) as MysteryReward[]
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
