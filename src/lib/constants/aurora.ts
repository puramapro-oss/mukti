// MUKTI — AURORA OMEGA
// 4 variantes AURORA OMEGA (G5)
// Les phases sont définies à part dans AURORA_PHASES (structure 5 phases/variante)
export const AURORA_VARIANTS = [
  { id: 'calm',   name: 'Calm',   duration_min: 8,  description: 'Pause guidée',       color: '#06b6d4', glyph: '🌊' },
  { id: 'focus',  name: 'Focus',  duration_min: 4,  description: 'Avant travail créatif',     color: '#7c3aed', glyph: '🎯' },
  { id: 'sleep',  name: 'Sleep',  duration_min: 10, description: 'Rituel avant le coucher',      color: '#1e1b4b', glyph: '🌙' },
  { id: 'ignite', name: 'Ignite', duration_min: 2,  description: 'Pause courte',         color: '#F59E0B', glyph: '⚡' },
] as const
export type AuroraVariant = typeof AURORA_VARIANTS[number]['id']

// Phases AURORA OMEGA (brief section 5) — durations en secondes
// Total : calm=468s≈8min / focus=248s≈4min / sleep=608s≈10min / ignite=128s≈2min
export type AuroraPhaseName = 'armement' | 'double_sigh' | 'resonance_core' | 'omega_lock' | 'glide_out'
export interface AuroraPhase {
  name: AuroraPhaseName
  duration_sec: number
  breath: { in: number; top_up?: number; out: number; hold?: number }
  label_fr: string
  label_en: string
}
export const AURORA_PHASES: Record<AuroraVariant, AuroraPhase[]> = {
  calm: [
    { name: 'armement',       duration_sec: 8,   breath: { in: 2, out: 2 },                   label_fr: 'Armement',           label_en: 'Arming' },
    { name: 'double_sigh',    duration_sec: 40,  breath: { in: 3, top_up: 1, out: 8 },        label_fr: 'Double Sigh Reset',  label_en: 'Double Sigh Reset' },
    { name: 'resonance_core', duration_sec: 240, breath: { in: 5, out: 7 },                   label_fr: 'Résonance Core',     label_en: 'Resonance Core' },
    { name: 'omega_lock',     duration_sec: 120, breath: { in: 4, out: 6, hold: 2 },          label_fr: 'Omega Lock',         label_en: 'Omega Lock' },
    { name: 'glide_out',      duration_sec: 60,  breath: { in: 4, out: 8 },                   label_fr: 'Glide Out',          label_en: 'Glide Out' },
  ],
  focus: [
    { name: 'armement',       duration_sec: 8,   breath: { in: 2, out: 2 },                   label_fr: 'Armement',           label_en: 'Arming' },
    { name: 'double_sigh',    duration_sec: 30,  breath: { in: 3, top_up: 1, out: 6 },        label_fr: 'Double Sigh Reset',  label_en: 'Double Sigh Reset' },
    { name: 'resonance_core', duration_sec: 120, breath: { in: 4, out: 6 },                   label_fr: 'Résonance Core',     label_en: 'Resonance Core' },
    { name: 'omega_lock',     duration_sec: 60,  breath: { in: 4, out: 5, hold: 1 },          label_fr: 'Omega Lock',          label_en: 'Omega Lock' },
    { name: 'glide_out',      duration_sec: 30,  breath: { in: 3, out: 5 },                   label_fr: 'Glide Out',          label_en: 'Glide Out' },
  ],
  sleep: [
    { name: 'armement',       duration_sec: 8,   breath: { in: 2, out: 2 },                   label_fr: 'Armement',           label_en: 'Arming' },
    { name: 'double_sigh',    duration_sec: 60,  breath: { in: 3, top_up: 1, out: 9 },        label_fr: 'Double Sigh Reset',  label_en: 'Double Sigh Reset' },
    { name: 'resonance_core', duration_sec: 360, breath: { in: 4, out: 8 },                   label_fr: 'Résonance Core',     label_en: 'Resonance Core' },
    { name: 'omega_lock',     duration_sec: 120, breath: { in: 4, out: 7, hold: 1 },          label_fr: 'Omega Lock',         label_en: 'Omega Lock' },
    { name: 'glide_out',      duration_sec: 60,  breath: { in: 3, out: 9 },                   label_fr: 'Glide Out',          label_en: 'Glide Out' },
  ],
  ignite: [
    { name: 'armement',       duration_sec: 8,   breath: { in: 2, out: 2 },                   label_fr: 'Armement',           label_en: 'Arming' },
    { name: 'double_sigh',    duration_sec: 20,  breath: { in: 2, top_up: 1, out: 4 },        label_fr: 'Double Sigh Reset',  label_en: 'Double Sigh Reset' },
    { name: 'resonance_core', duration_sec: 60,  breath: { in: 3, out: 3 },                   label_fr: 'Résonance Core',     label_en: 'Resonance Core' },
    { name: 'omega_lock',     duration_sec: 20,  breath: { in: 3, out: 3, hold: 1 },          label_fr: 'Omega Lock',         label_en: 'Omega Lock' },
    { name: 'glide_out',      duration_sec: 20,  breath: { in: 2, out: 4 },                   label_fr: 'Glide Out',          label_en: 'Glide Out' },
  ],
}

// Repères de participation AURORA — aucune mesure physiologique.
export const AURORA_LEVELS = [
  { id: 'brume',   name: 'Brume',   min_days: 0,  min_sessions: 0,  color: '#64748b', glyph: '🌫️',  description_fr: 'Tu poses tes premiers souffles.' },
  { id: 'onde',    name: 'Onde',    min_days: 7,  min_sessions: 5,  color: '#06b6d4', glyph: '🌊',  description_fr: 'Tu as enregistré au moins 5 séances.' },
  { id: 'aura',    name: 'Aura',    min_days: 21, min_sessions: 15, color: '#7c3aed', glyph: '✨',  description_fr: 'Tu as enregistré au moins 15 séances.' },
  { id: 'polaris', name: 'Polaris', min_days: 60, min_sessions: 40, color: '#f472b6', glyph: '⭐',  description_fr: 'Tu as enregistré au moins 40 séances.' },
] as const
export type AuroraLevel = typeof AURORA_LEVELS[number]['id']

// Options manuelles de guidage ; Soft par défaut, aucune progression automatique.
export const AURORA_POWER_SWITCHES = [
  { id: 'soft', name: 'Soft',  holds: false, description_fr: 'Sans rétention — option par défaut' },
  { id: 'core', name: 'Core',  holds: true,  description_fr: 'Pause guidée facultative de 1 à 2 s' },
  { id: 'omega',name: 'Omega', holds: true,  description_fr: 'Même rythme guidé que Core' },
] as const
export type AuroraPowerSwitch = typeof AURORA_POWER_SWITCHES[number]['id']
