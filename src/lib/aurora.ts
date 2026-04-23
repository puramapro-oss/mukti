// MUKTI — AURORA OMEGA helpers (G5)
// Respiration neural override — 4 variantes × 5 phases + cohérence + niveaux Brume→Polaris.
// Utilisable server & client (pure logic, aucun window/audio ici).

import {
  AURORA_VARIANTS,
  AURORA_PHASES,
  AURORA_LEVELS,
  AURORA_POWER_SWITCHES,
  type AuroraVariant,
  type AuroraPhase,
  type AuroraLevel,
  type AuroraPowerSwitch,
} from './constants'

export interface AuroraSession {
  id: string
  user_id: string
  variant: AuroraVariant
  started_at: string
  completed_at: string | null
  duration_sec: number | null
  phases_completed: PhaseCompletion[]
  coherence_score: number | null
  power_switch: AuroraPowerSwitch | null
  level_reached: AuroraLevel | null
  stopped_reason: 'user_stop' | 'dizzy' | 'glide_out_complete' | 'timeout' | 'error' | null
  voice_guidance: boolean
  created_at: string
}

export interface PhaseCompletion {
  phase: AuroraPhase['name']
  duration_sec: number
  breaths_counted: number
  coherence: number | null
}

export interface AuroraStreak {
  user_id: string
  current_days: number
  best_days: number
  last_session_date: string | null
  current_level: AuroraLevel
  total_minutes: number
  total_sessions: number
  updated_at: string
}

/** Retourne la liste des 5 phases pour une variante. */
export function getVariantPhases(variant: AuroraVariant): AuroraPhase[] {
  return AURORA_PHASES[variant]
}

/** Durée totale (sec) d'une variante = somme des 5 phases. */
export function getVariantTotalSec(variant: AuroraVariant): number {
  return AURORA_PHASES[variant].reduce((sum, p) => sum + p.duration_sec, 0)
}

/** Retourne la meta d'une variante (name, color, glyph, duration_min). */
export function getVariantMeta(variant: AuroraVariant) {
  return AURORA_VARIANTS.find(v => v.id === variant)
}

/** Validation type-safe d'une valeur variant. */
export function isValidVariant(v: string): v is AuroraVariant {
  return (AURORA_VARIANTS as readonly { id: string }[]).some(x => x.id === v)
}

/**
 * Calcule un score de cohérence (0-1) à partir des timings réels du user vs timings planifiés.
 * Détection simple : variance relative. Plus la variance est faible, plus le score est élevé.
 * - Si variance < 0.1 → score ≥ 0.9 (excellent)
 * - Si variance > 0.5 → score < 0.5 (instable, recommander SOFT)
 */
export function computeCoherence(plannedSec: number[], actualSec: number[]): number {
  if (plannedSec.length === 0 || plannedSec.length !== actualSec.length) return 0
  const ratios = plannedSec.map((p, i) => {
    if (p <= 0) return 1
    return actualSec[i] / p
  })
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length
  const variance =
    ratios.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratios.length
  // variance 0 → score 1; variance 0.25 → score 0.5; variance >0.5 → score clamp
  const score = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) * 1.5))
  return Math.round(score * 1000) / 1000
}

/**
 * Détermine le Power Switch recommandé selon la cohérence et le niveau utilisateur.
 * Règle sécurité : cohérence < 0.5 OU niveau Brume → toujours SOFT.
 */
export function recommendPowerSwitch(
  coherence: number,
  level: AuroraLevel
): AuroraPowerSwitch {
  if (coherence < 0.5 || level === 'brume') return 'soft'
  if (coherence >= 0.8 && (level === 'aura' || level === 'polaris')) return 'omega'
  return 'core'
}

/** Retourne la meta d'un power switch. */
export function getPowerSwitchMeta(id: AuroraPowerSwitch) {
  return AURORA_POWER_SWITCHES.find(p => p.id === id)
}

/**
 * Calcule le niveau AURORA à partir de la streak et du nombre de sessions.
 * Les seuils sont cumulatifs : on prend le plus haut niveau atteint.
 */
export function computeAuroraLevel(
  currentDays: number,
  totalSessions: number
): AuroraLevel {
  const reversed = [...AURORA_LEVELS].reverse()
  for (const lv of reversed) {
    if (currentDays >= lv.min_days && totalSessions >= lv.min_sessions) {
      return lv.id
    }
  }
  return 'brume'
}

/** Retourne la meta d'un niveau AURORA. */
export function getLevelMeta(id: AuroraLevel) {
  return AURORA_LEVELS.find(l => l.id === id)
}

/**
 * Décide si la session doit être considérée comme "complétée" (≥ 80% de la durée prévue
 * et phase finale glide_out entamée).
 */
export function isSessionCompleted(
  variant: AuroraVariant,
  phasesCompleted: PhaseCompletion[]
): boolean {
  const planned = getVariantTotalSec(variant)
  const actual = phasesCompleted.reduce((s, p) => s + p.duration_sec, 0)
  const ratio = actual / planned
  const reachedGlideOut = phasesCompleted.some(p => p.phase === 'glide_out')
  return ratio >= 0.8 && reachedGlideOut
}

/**
 * Met à jour la streak après une session.
 * Règles :
 *  - Session aujourd'hui : +0 ou +1 si dernier = hier
 *  - Session après un trou de > 1 jour : reset current_days = 1
 *  - best_days = max(best_days, current_days)
 */
export function nextStreakState(
  prev: Pick<AuroraStreak, 'current_days' | 'best_days' | 'last_session_date' | 'total_minutes' | 'total_sessions'>,
  sessionDate: string,
  sessionDurationSec: number
): Pick<AuroraStreak, 'current_days' | 'best_days' | 'last_session_date' | 'total_minutes' | 'total_sessions' | 'current_level'> {
  const today = sessionDate.slice(0, 10)
  const last = prev.last_session_date?.slice(0, 10) ?? null

  let current = prev.current_days
  if (!last) {
    current = 1
  } else if (last === today) {
    // même jour, pas d'incrément mais on laisse total++
    current = Math.max(prev.current_days, 1)
  } else {
    const dayDiff = daysBetween(last, today)
    current = dayDiff === 1 ? prev.current_days + 1 : 1
  }
  const best = Math.max(prev.best_days, current)
  const totalMinutes = prev.total_minutes + Math.round(sessionDurationSec / 60)
  const totalSessions = prev.total_sessions + 1
  const nextLevel = computeAuroraLevel(current, totalSessions)

  return {
    current_days: current,
    best_days: best,
    last_session_date: today,
    total_minutes: totalMinutes,
    total_sessions: totalSessions,
    current_level: nextLevel,
  }
}

function daysBetween(iso1: string, iso2: string): number {
  const d1 = new Date(iso1 + 'T00:00:00Z').getTime()
  const d2 = new Date(iso2 + 'T00:00:00Z').getTime()
  return Math.round(Math.abs(d2 - d1) / 86400000)
}

/**
 * Calcule les timings secondes cumulés par phase (utile pour UI progress ring).
 * Retourne [{phase, start_sec, end_sec}].
 */
export function getPhaseTimeline(variant: AuroraVariant) {
  let cursor = 0
  return AURORA_PHASES[variant].map(p => {
    const start = cursor
    cursor += p.duration_sec
    return { phase: p.name, start_sec: start, end_sec: cursor, breath: p.breath, label_fr: p.label_fr, label_en: p.label_en }
  })
}
