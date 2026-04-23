// MUKTI — Streaks & Milestones (G2)
// Logique check-in quotidien + rechute + crédit paliers wallet.
// Streaks : 1 active par addiction (DB partial UNIQUE).
// Paliers : J1/J7/J30/J90 par addiction, UNIQUE triple (user, addiction, milestone).

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { MILESTONES, MILESTONE_LOCK_DAYS, type MilestoneId } from './constants'
import { canClaimMilestone, recomputeTrustScore } from './trust'

export interface Streak {
  id: string
  addiction_id: string
  user_id: string
  started_at: string
  last_checkin_at: string | null
  ended_at: string | null
  current_days: number
  best_days: number
  is_active: boolean
  end_reason: 'relapse' | 'paused' | 'liberated' | null
  created_at: string
}

export interface Relapse {
  id: string
  addiction_id: string
  user_id: string
  streak_id: string | null
  relapsed_at: string
  trigger_note: string | null
  mood_before: number | null
  context_tags: string[]
  streak_reset_from_days: number
  generated_insight: string | null
  insight_model: string | null
  created_at: string
}

export interface StreakState {
  streak: Streak | null
  addiction_id: string
  days_since_declaration: number
  next_milestone: MilestoneId | null
  next_milestone_days_away: number | null
  milestones_achieved: MilestoneId[]
}

export interface MilestoneRow {
  id: string
  user_id: string
  addiction_id: string
  streak_id: string | null
  milestone: MilestoneId
  amount_cents: number
  status: 'pending' | 'credited' | 'locked' | 'unlocked' | 'denied_fraud' | 'denied_score'
  credited_at: string | null
  locked_until: string | null
  unlocked_at: string | null
  trust_score_at_grant: number | null
  fraud_check_passed: boolean | null
}

/** Streak actif d'une addiction (owner RLS). */
export async function getActiveStreak(addictionId: string): Promise<Streak | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('addiction_id', addictionId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null
  return data as Streak
}

/**
 * Check-in quotidien : incrémente current_days si au moins 24h depuis dernier checkin.
 * Idempotent pour la même fenêtre de 24h.
 */
export async function checkinDaily(addictionId: string): Promise<{
  ok: boolean
  streak: Streak | null
  incremented: boolean
  milestone_granted: MilestoneId | null
  error: string | null
}> {
  const supabase = await createServerSupabaseClient()

  const streak = await getActiveStreak(addictionId)
  if (!streak) {
    return {
      ok: false,
      streak: null,
      incremented: false,
      milestone_granted: null,
      error: 'Aucun streak actif — réactive la libération.',
    }
  }

  const now = Date.now()
  const lastCheckinMs = streak.last_checkin_at ? new Date(streak.last_checkin_at).getTime() : 0
  const hoursSinceLast = (now - lastCheckinMs) / 3600000

  // anti-replay < 20h = même jour, pas d'incrément
  if (hoursSinceLast < 20 && streak.last_checkin_at !== null) {
    return { ok: true, streak, incremented: false, milestone_granted: null, error: null }
  }

  const newDays = streak.current_days + 1
  const { data: updated, error } = await supabase
    .from('streaks')
    .update({
      current_days: newDays,
      last_checkin_at: new Date().toISOString(),
      best_days: Math.max(streak.best_days, newDays),
    })
    .eq('id', streak.id)
    .select('*')
    .single()

  if (error || !updated) {
    return {
      ok: false,
      streak,
      incremented: false,
      milestone_granted: null,
      error: `Check-in échoué : ${error?.message ?? 'inconnu'}`,
    }
  }

  const fresh = updated as Streak
  const milestone = MILESTONES.find(m => m.days === fresh.current_days)
  let granted: MilestoneId | null = null
  if (milestone) {
    const result = await grantMilestoneIfEligible(fresh.user_id, addictionId, fresh.id, milestone.id)
    if (result.status === 'credited' || result.status === 'locked') granted = milestone.id
  }

  void recomputeTrustScore(fresh.user_id).catch(() => {})

  return { ok: true, streak: fresh, incremented: true, milestone_granted: granted, error: null }
}

/**
 * Enregistre une rechute. Le trigger DB `relapses_handle_relapse` :
 *  - ferme le streak actif (ended_at + end_reason='relapse')
 *  - ouvre un nouveau streak j0 tout de suite
 *  - calcule streak_reset_from_days
 * L'insight IA bienveillant est rempli en post-processing (hors de ce helper).
 */
export async function recordRelapse(params: {
  addictionId: string
  trigger_note?: string
  mood_before?: number
  context_tags?: string[]
}): Promise<{ relapse: Relapse | null; error: string | null }> {
  const supabase = await createServerSupabaseClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return { relapse: null, error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (!profile) return { relapse: null, error: 'Profil introuvable.' }

  const { data, error } = await supabase
    .from('relapses')
    .insert({
      addiction_id: params.addictionId,
      user_id: profile.id,
      trigger_note: params.trigger_note ?? null,
      mood_before: params.mood_before ?? null,
      context_tags: params.context_tags ?? [],
    })
    .select('*')
    .single()

  if (error) return { relapse: null, error: error.message }

  void recomputeTrustScore(profile.id).catch(() => {})

  return { relapse: data as Relapse, error: null }
}

/**
 * Vérifie l'éligibilité du palier puis crédit wallet_transactions + insertion payment_milestones.
 * Locked pendant MILESTONE_LOCK_DAYS (résolution §35.5 L221-28).
 * Service-role requis car payment_milestones/wallet_transactions lecture-seule côté user.
 */
export async function grantMilestoneIfEligible(
  userId: string,
  addictionId: string,
  streakId: string,
  milestoneId: MilestoneId
): Promise<{ status: MilestoneRow['status']; row: MilestoneRow | null; reason?: string }> {
  const admin = createServiceClient()
  const milestone = MILESTONES.find(m => m.id === milestoneId)
  if (!milestone) return { status: 'denied_score', row: null, reason: 'Milestone inconnu' }

  const { data: existing } = await admin
    .from('payment_milestones')
    .select('*')
    .eq('user_id', userId)
    .eq('addiction_id', addictionId)
    .eq('milestone', milestoneId)
    .maybeSingle()

  if (existing) {
    return { status: (existing as MilestoneRow).status, row: existing as MilestoneRow }
  }

  const eligibility = await canClaimMilestone(userId, milestone.amount_cents)

  // Quelque soit l'issue, on trace la tentative
  const baseRow = {
    user_id: userId,
    addiction_id: addictionId,
    streak_id: streakId,
    milestone: milestoneId,
    amount_cents: milestone.amount_cents,
    trust_score_at_grant: eligibility.score,
    fraud_check_passed: eligibility.status === 'credited' || eligibility.status === 'locked',
  }

  if (eligibility.status === 'denied_fraud' || eligibility.status === 'denied_score') {
    const { data: inserted } = await admin
      .from('payment_milestones')
      .insert({ ...baseRow, status: eligibility.status })
      .select('*')
      .single()
    return { status: eligibility.status, row: inserted as MilestoneRow | null, reason: eligibility.reason }
  }

  // Crédité → pending_cents du wallet + lock 30j
  const amount = eligibility.adjusted_amount_cents ?? milestone.amount_cents
  const lockedUntil = new Date(Date.now() + MILESTONE_LOCK_DAYS * 86400000).toISOString()

  const { data: txLocked } = await admin
    .from('wallet_transactions')
    .insert({
      user_id: userId,
      amount_cents: amount,
      direction: 'credit',
      source: 'milestone_locked',
      description: `Palier ${milestoneId} libération addiction — verrouillé ${MILESTONE_LOCK_DAYS}j`,
      reference_type: 'payment_milestone',
      metadata: { milestone: milestoneId, addiction_id: addictionId, locked_until: lockedUntil },
    })
    .select('id')
    .single()

  // Met à jour wallet.pending_cents (atomique via rpc? fallback update avec select)
  const { data: wallet } = await admin
    .from('wallets')
    .select('id, pending_cents, total_earned_cents')
    .eq('user_id', userId)
    .single()

  if (wallet) {
    await admin
      .from('wallets')
      .update({
        pending_cents: wallet.pending_cents + amount,
        total_earned_cents: wallet.total_earned_cents + amount,
      })
      .eq('id', wallet.id)
  }

  const { data: inserted } = await admin
    .from('payment_milestones')
    .insert({
      ...baseRow,
      status: 'locked',
      credited_at: new Date().toISOString(),
      locked_until: lockedUntil,
      wallet_tx_locked_id: txLocked?.id ?? null,
    })
    .select('*')
    .single()

  return { status: 'locked', row: inserted as MilestoneRow | null }
}

/**
 * CRON quotidien : débloque les paliers dont locked_until < now.
 * Transfère pending_cents → balance_cents + crée wallet_transaction 'milestone_unlocked'.
 */
export async function unlockExpiredMilestones(): Promise<{ unlocked_count: number }> {
  const admin = createServiceClient()
  const nowIso = new Date().toISOString()

  const { data: locked } = await admin
    .from('payment_milestones')
    .select('*')
    .eq('status', 'locked')
    .lte('locked_until', nowIso)
    .limit(200)

  if (!locked || locked.length === 0) return { unlocked_count: 0 }

  let unlocked = 0
  for (const m of locked as MilestoneRow[]) {
    const { data: wallet } = await admin
      .from('wallets')
      .select('id, balance_cents, pending_cents')
      .eq('user_id', m.user_id)
      .single()

    if (!wallet) continue

    const { data: txUnlocked } = await admin
      .from('wallet_transactions')
      .insert({
        user_id: m.user_id,
        amount_cents: m.amount_cents,
        direction: 'credit',
        source: 'milestone_unlocked',
        description: `Palier ${m.milestone} déverrouillé après 30 jours`,
        reference_type: 'payment_milestone',
        reference_id: m.id,
        metadata: { milestone: m.milestone, addiction_id: m.addiction_id },
      })
      .select('id')
      .single()

    await admin
      .from('wallets')
      .update({
        balance_cents: wallet.balance_cents + m.amount_cents,
        pending_cents: Math.max(0, wallet.pending_cents - m.amount_cents),
      })
      .eq('id', wallet.id)

    await admin
      .from('payment_milestones')
      .update({
        status: 'unlocked',
        unlocked_at: nowIso,
        wallet_tx_unlocked_id: txUnlocked?.id ?? null,
      })
      .eq('id', m.id)

    unlocked++
  }

  return { unlocked_count: unlocked }
}

/** Résumé complet de l'état streak pour l'UI (dashboard + détail addiction). */
export async function getStreakState(addictionId: string): Promise<StreakState> {
  const supabase = await createServerSupabaseClient()
  const streak = await getActiveStreak(addictionId)
  const days = streak?.current_days ?? 0

  const { data: milestoneRows } = await supabase
    .from('payment_milestones')
    .select('milestone, status')
    .eq('addiction_id', addictionId)

  const achieved = ((milestoneRows ?? []) as { milestone: MilestoneId; status: string }[])
    .filter(m => m.status === 'credited' || m.status === 'locked' || m.status === 'unlocked')
    .map(m => m.milestone)

  const remaining = MILESTONES.filter(m => !achieved.includes(m.id) && m.days > days)
  const next = remaining[0] ?? null

  return {
    streak,
    addiction_id: addictionId,
    days_since_declaration: days,
    next_milestone: next ? next.id : null,
    next_milestone_days_away: next ? next.days - days : null,
    milestones_achieved: achieved,
  }
}

/** CRON nightly : advance current_days pour les streaks actifs dont last_checkin_at > 24h
 *  (pas utilisé si on force check-in manuel ; garde pour auto-credit éventuel palier avec check d'activité).
 *  Pour MVP on laisse le user check-in → on n'avance pas automatiquement.
 */
export async function listStreaksNeedingCheckinReminder(): Promise<Streak[]> {
  const admin = createServiceClient()
  const threshold = new Date(Date.now() - 20 * 3600000).toISOString()
  const { data } = await admin
    .from('streaks')
    .select('*')
    .eq('is_active', true)
    .or(`last_checkin_at.is.null,last_checkin_at.lt.${threshold}`)
    .limit(1000)

  return (data ?? []) as Streak[]
}
