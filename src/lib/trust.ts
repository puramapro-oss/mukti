// MUKTI — Trust Score anti-fraude (G2 base MVP ; couches physio → P6)
// Score 0-100 avec seuils : <30 = 0% paliers (Points only) · 30-60 = 50% · ≥60 = 100%.
// Signals MVP : vitesse d'actions critiques + multi-comptes fingerprint + ratio rechutes/check-ins.

import { createHash } from 'node:crypto'
import { createServiceClient } from './supabase'
import { TRUST } from './constants'

export interface TrustScore {
  id: string
  user_id: string
  score: number
  coherence_factors: Record<string, number>
  multi_account_flags: number
  gps_anomalies: number
  rapid_actions_flags: number
  manual_review_flag: boolean
  manual_review_reason: string | null
  payout_ceiling_cents: number
  last_updated: string
  history: { at: string; delta: number; reason: string }[]
  created_at: string
  updated_at: string
}

export interface Fingerprint {
  id: string
  user_id: string
  fingerprint_hash: string
  ip_hash: string | null
  user_agent_hash: string | null
  first_seen_at: string
  last_seen_at: string
  seen_count: number
}

/** SHA-256 stable pour hasher IP + User-Agent côté serveur (RGPD friendly). */
export function hashSignal(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

/**
 * Génère un fingerprint hash combiné (pas stocké en clair).
 * Inputs bruts : IP + UA + viewport + language + timezone. Nous recevons déjà un hash client
 * (FingerprintJS-like) + on combine avec le hash serveur pour robustesse.
 */
export function computeFingerprintHash(clientFingerprint: string, ip: string, userAgent: string): string {
  return hashSignal(`${clientFingerprint}|${ip}|${userAgent}`)
}

/** Ceiling paiements : 0 / 50% / 100% selon score. */
export function getPayoutCeilingPercent(score: number): 0 | 50 | 100 {
  if (score < TRUST.ceiling_zero) return 0
  if (score < TRUST.ceiling_half) return 50
  return 100
}

export async function getTrustScore(userId: string): Promise<TrustScore | null> {
  const admin = createServiceClient()
  const { data, error } = await admin
    .from('trust_scores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data as TrustScore
}

/** Idempotent — trigger DB le fait déjà mais on garde cette fonction pour les flux de test. */
export async function ensureTrustScore(userId: string): Promise<TrustScore> {
  const admin = createServiceClient()
  const { data: existing } = await admin
    .from('trust_scores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing as TrustScore

  const { data } = await admin
    .from('trust_scores')
    .insert({ user_id: userId, score: TRUST.initial, payout_ceiling_cents: 500 })
    .select('*')
    .single()

  return data as TrustScore
}

/**
 * Recalcule le trust score depuis les signaux récents.
 * Formule MVP additive :
 *  +1/j d'ancienneté profil (max +20)
 *  +2 par mode_session complétée dernière semaine (max +15)
 *  -10 si ratio rechutes/check-ins > 0.5 sur 30j
 *  -5 par "rapid action flag"
 *  -15 par multi-compte fingerprint
 *  -20 si GPS anomalies > 2 sur 7j (placeholder MVP)
 */
export async function recomputeTrustScore(userId: string): Promise<TrustScore> {
  const admin = createServiceClient()
  const existing = await ensureTrustScore(userId)

  const factors: Record<string, number> = {}
  let score = TRUST.initial

  const { data: profile } = await admin
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.created_at) {
    const days = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
    const bonus = Math.min(20, days)
    score += bonus
    factors.account_age_bonus = bonus
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { count: sessionCount } = await admin
    .from('mode_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', weekAgo)
  const sessionBonus = Math.min(15, (sessionCount ?? 0) * 2)
  score += sessionBonus
  factors.session_bonus = sessionBonus

  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const { count: relapseCount } = await admin
    .from('relapses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('relapsed_at', monthAgo)
  const { count: checkinCount } = await admin
    .from('mode_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('started_at', monthAgo)
  if ((checkinCount ?? 0) > 0) {
    const ratio = (relapseCount ?? 0) / (checkinCount ?? 1)
    if (ratio > 0.5) {
      score -= 10
      factors.relapse_ratio_penalty = -10
    }
  }

  score -= existing.rapid_actions_flags * 5
  factors.rapid_actions_penalty = -existing.rapid_actions_flags * 5

  score -= existing.multi_account_flags * 15
  factors.multi_account_penalty = -existing.multi_account_flags * 15

  score -= Math.min(20, existing.gps_anomalies * 10)
  factors.gps_anomalies_penalty = -Math.min(20, existing.gps_anomalies * 10)

  const clamped = Math.max(TRUST.min, Math.min(TRUST.max, score))
  const reviewFlag = clamped < TRUST.review_flag_score

  const history = [
    ...existing.history,
    {
      at: new Date().toISOString(),
      delta: clamped - existing.score,
      reason: 'recompute_auto',
    },
  ].slice(-50)

  const ceilingPercent = getPayoutCeilingPercent(clamped)
  const payoutCeilingCents = ceilingPercent === 0 ? 0 : ceilingPercent === 50 ? 2500 : 10000

  const { data } = await admin
    .from('trust_scores')
    .update({
      score: clamped,
      coherence_factors: factors,
      manual_review_flag: reviewFlag,
      manual_review_reason: reviewFlag ? `score ${clamped} sous seuil ${TRUST.review_flag_score}` : null,
      payout_ceiling_cents: payoutCeilingCents,
      last_updated: new Date().toISOString(),
      history,
    })
    .eq('user_id', userId)
    .select('*')
    .single()

  return data as TrustScore
}

/**
 * Peut-on créditer un palier de ce montant ?
 * Status retourné :
 *  credited : score >= ceiling_half → 100% du montant
 *  locked   : 30-60 → 50% du montant ajusté, mais toujours locked 30j
 *  denied_score : score < ceiling_zero → 0€, basculé en Points only
 *  denied_fraud : fingerprint flags > seuil
 */
export async function canClaimMilestone(
  userId: string,
  milestoneAmountCents: number
): Promise<{
  status: 'credited' | 'locked' | 'denied_score' | 'denied_fraud'
  score: number
  adjusted_amount_cents?: number
  reason?: string
}> {
  const trust = await ensureTrustScore(userId)

  if (trust.manual_review_flag || trust.multi_account_flags >= 1) {
    return {
      status: 'denied_fraud',
      score: trust.score,
      reason: 'Vérification manuelle nécessaire — tes paliers sont convertis en Points en attendant.',
    }
  }

  const percent = getPayoutCeilingPercent(trust.score)
  if (percent === 0) {
    return {
      status: 'denied_score',
      score: trust.score,
      reason: 'Score de confiance en construction — tes paliers te rapportent des Points pour l\'instant.',
    }
  }

  const adjusted = percent === 100 ? milestoneAmountCents : Math.floor(milestoneAmountCents / 2)
  return { status: 'locked', score: trust.score, adjusted_amount_cents: adjusted }
}

/**
 * Enregistre un fingerprint et détecte multi-comptes.
 * Renvoie le nombre d'autres users ayant vu ce même hash → incrémente multi_account_flags.
 */
export async function registerFingerprint(params: {
  userId: string
  fingerprintHash: string
  ipHash?: string
  userAgentHash?: string
}): Promise<{ collisions: number; flagged: boolean }> {
  const admin = createServiceClient()

  await admin
    .from('trust_fingerprints')
    .upsert(
      {
        user_id: params.userId,
        fingerprint_hash: params.fingerprintHash,
        ip_hash: params.ipHash ?? null,
        user_agent_hash: params.userAgentHash ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,fingerprint_hash' }
    )

  const { data: owners } = await admin
    .from('trust_fingerprints')
    .select('user_id')
    .eq('fingerprint_hash', params.fingerprintHash)

  const uniqueUsers = new Set((owners ?? []).map(o => o.user_id))
  uniqueUsers.delete(params.userId)
  const collisions = uniqueUsers.size
  const flagged = collisions >= TRUST.max_users_per_fingerprint - 1

  if (flagged) {
    const current = await ensureTrustScore(params.userId)
    const history = [
      ...current.history,
      {
        at: new Date().toISOString(),
        delta: -15,
        reason: `multi_account_fingerprint:${collisions}_collisions`,
      },
    ].slice(-50)
    await admin
      .from('trust_scores')
      .update({
        multi_account_flags: current.multi_account_flags + 1,
        manual_review_flag: true,
        manual_review_reason: `Multi-comptes détecté (${collisions} autres users sur ce fingerprint)`,
        history,
      })
      .eq('user_id', params.userId)
  }

  return { collisions, flagged }
}

/** Enregistre un flag "rapid action" (actions critiques < TRUST.rapid_action_window_sec). */
export async function flagRapidAction(userId: string, reason: string): Promise<void> {
  const admin = createServiceClient()
  const existing = await ensureTrustScore(userId)
  const history = [
    ...existing.history,
    { at: new Date().toISOString(), delta: -5, reason: `rapid_action:${reason}` },
  ].slice(-50)

  await admin
    .from('trust_scores')
    .update({
      rapid_actions_flags: existing.rapid_actions_flags + 1,
      history,
    })
    .eq('user_id', userId)
}

/** Utilitaire d'inspection pour l'admin Tissma (god-mode). */
export async function getTrustSnapshot(userId: string): Promise<{
  score: TrustScore | null
  fingerprints: Fingerprint[]
}> {
  const admin = createServiceClient()
  const score = await getTrustScore(userId)
  const { data: fps } = await admin
    .from('trust_fingerprints')
    .select('*')
    .eq('user_id', userId)

  return { score, fingerprints: (fps ?? []) as Fingerprint[] }
}
