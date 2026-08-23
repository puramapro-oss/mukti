// ==================================================
// G2 — Libération Addictions
// ==================================================

export const MAX_ACTIVE_ADDICTIONS = 3

// Paliers wallet par addiction (cents) — brief MUKTI-BRIEF.md L74
export const MILESTONES = [
  { id: 'J1' as const, days: 1, amount_cents: 50, label: '24 heures', emoji: '🌱' },
  { id: 'J7' as const, days: 7, amount_cents: 200, label: '1 semaine', emoji: '🌿' },
  { id: 'J30' as const, days: 30, amount_cents: 1000, label: '1 mois', emoji: '🌳' },
  { id: 'J90' as const, days: 90, amount_cents: 5000, label: '3 mois', emoji: '✨' },
] as const

export type MilestoneId = typeof MILESTONES[number]['id']

// Résolution §35.5 L221-28 : prime verrouillée 30j, wallet only, zéro checkbox
export const MILESTONE_LOCK_DAYS = 30

// Anti-fraude trust score thresholds (voir lib/trust.ts)
export const TRUST = {
  initial: 50,
  min: 0,
  max: 100,
  ceiling_zero: 30,        // score < 30 → 0% (Points only)
  ceiling_half: 60,        // score 30-60 → 50% du palier
  // score ≥ 60 → 100% du palier
  rapid_action_window_sec: 10,   // < 10s entre actions critiques = flag
  max_fingerprints_per_user: 5,   // > 5 fingerprints distincts = flag
  max_users_per_fingerprint: 2,   // > 2 users même fingerprint = flag + freeze paiements
  review_flag_score: 25,           // flag manuel si score < 25
} as const

// 5 modes MVP G2 (20 modes totaux livrés G5/G6)
export const MODES_G2 = [
  { id: 'coupure_40s' as const, name: 'Coupure Instantanée', duration_sec: 40, color: '#EF4444', emoji: '⚡', desc: 'Protocole 40s hypnose flash + respiration' },
  { id: 'multisensoriel' as const, name: 'Multisensoriel Ultime', duration_sec: 180, color: '#7C3AED', emoji: '🌀', desc: 'Son + vibration + spirales + respiration adaptative' },
  { id: 'micro_meditation' as const, name: 'Micro-Méditations', duration_sec: 30, color: '#06B6D4', emoji: '🌬️', desc: '10-40s toutes les heures, discrètes' },
  { id: 'avatar' as const, name: 'Avatar Anticraving', duration_sec: 0, color: '#10B981', emoji: '🌟', desc: 'Ton toi libéré grandit avec tes jours' },
  { id: 'compteur' as const, name: 'Compteur Motivation', duration_sec: 0, color: '#F59E0B', emoji: '🔥', desc: '€/temps/santé gagnés + paliers spectaculaires' },
] as const

export type ModeId = typeof MODES_G2[number]['id']

// Programme Opus — fréquence regen autorisée (1× déclaration + 1×/30j)
export const PROGRAM_REGEN_COOLDOWN_DAYS = 30
