// MUKTI — G5.4 Reprogramming pure utils (client-safe)
// Aucune dépendance server (pas de supabase-server / service client).
// Partagé entre lib/reprogramming.ts (server) et NightPlayer/Client components.

import { REPROG_DAY_REMINDER_HOURS, REPROG_NIGHT_VOLUME_RAMP_MIN } from './constants'

/** Courbe volume ramp linéaire descendante sur 30 min (mode nuit). */
export function computeRampVolume(elapsedSec: number, startVolume = 1.0): number {
  const rampSec = REPROG_NIGHT_VOLUME_RAMP_MIN * 60
  if (elapsedSec <= 0) return startVolume
  if (elapsedSec >= rampSec) return 0
  return Math.max(0, startVolume * (1 - elapsedSec / rampSec))
}

/**
 * Calcule le prochain créneau notification journée (2h gap, slots 9h-19h).
 * Pure-logic — utilisée par CRON notifs (G5.5) ou client-side scheduling.
 */
export function nextDayReminderHour(nowLocalHour: number): number | null {
  if (nowLocalHour < 0 || nowLocalHour > 23) return null
  const slots = REPROG_DAY_REMINDER_HOURS
  for (const h of slots) {
    if (h > nowLocalHour) return h
  }
  return null
}
