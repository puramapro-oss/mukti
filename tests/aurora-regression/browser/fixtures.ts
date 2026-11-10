import type { MinimalRitualHabit } from '../../../src/lib/constants/core-events'
import type { HabitStatus } from '../../../src/lib/minimal-ritual'
import type { MentalJournalEntry } from '../../../src/lib/mental-journal-contract'
import type { RecognitionOverview } from '../../../src/lib/daily-recognition'

// Explicit synthetic input avoids executing application modules in Playwright's
// Node loader. The real component and its product constants are bundled by Vite.
const habitSlugs = [
  'respiration_consciente', 'merci_corps', 'posture_verticale', 'geste_nourrissant',
  'pause_ecran', 'eau_lente', 'gratitude_micro', 'contact_nature',
] as const satisfies readonly MinimalRitualHabit[]

export const NOW = '2026-11-10T12:00:00.000Z'
export const TODAY = '2026-11-10'
export const ZONE = 'Europe/Paris'
export const LEGACY_JOURNAL_ID = '10000000-0000-4000-8000-000000000001'
export const OWN_SESSION_ID = '20000000-0000-4000-8000-000000000001'
export const legacyJournal: MentalJournalEntry = {
  id: LEGACY_JOURNAL_ID, transcript: 'Écrit personnel synthétique — compte A.', transcript_lang: 'fr',
  audio_duration_sec: 8, entry_source: 'legacy', reflection: null, reflection_status: 'not_requested',
  created_at: '2026-11-09T12:00:00.000Z',
}
export const habitStatuses = (): HabitStatus[] => habitSlugs.map(slug => ({
  slug, recorded_today: false, ticked_today: false, participation_mode: null,
  progress_days: 2, practice_days: 2, rest_days: 0, streak_days: 0,
}))
export const recognitionOverview = (): RecognitionOverview => ({
  format: 'daily-recognition-v1', time_zone: 'UTC', today: TODAY, recognition: null,
  recognitions: [{ id: 'prior-recognition', recognition_date: '2026-11-08', recognized_at: '2026-11-08T12:00:00.000Z' }],
  legacy_rewards: [{ id: 'legacy-receipt', claim_date: '2026-10-20', claimed_at: '2026-10-20T12:00:00.000Z',
    tier: 'common', reward_type: 'points', reward_amount: 100, streak_day: 1, delivery_status: 'unknown' }],
})
