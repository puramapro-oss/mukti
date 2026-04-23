// MUKTI — Rituel 7 Secondes (G5.6) — pure-logic client-safe
// Phases, constantes et helpers utilisables depuis des Client Components.
// Aucun import serveur (pas de next/headers, pas de supabase-server).

export type Rituel7sTrigger = 'button' | 'shortcut' | 'page'
export type Rituel7sOutcome = 'completed' | 'interrupted'
export type Rituel7sPhaseName = 'stop' | 'inspire' | 'suspend' | 'expire'

export interface Rituel7sPhase {
  name: Rituel7sPhaseName
  label_fr: string
  start_ms: number
  end_ms: number
  hint_fr: string
}

// Phases fixes — 7000ms total. Jamais modifiées (ancrage réflexe).
export const RITUEL_7S_PHASES: readonly Rituel7sPhase[] = [
  { name: 'stop',    label_fr: 'Arrête',   start_ms:    0, end_ms: 1000, hint_fr: 'Pose-toi. Ici, maintenant.' },
  { name: 'inspire', label_fr: 'Inspire',  start_ms: 1000, end_ms: 3000, hint_fr: 'Par le nez, lentement.' },
  { name: 'suspend', label_fr: 'Suspends', start_ms: 3000, end_ms: 4000, hint_fr: 'Garde l\'air une seconde.' },
  { name: 'expire',  label_fr: 'Expire',   start_ms: 4000, end_ms: 7000, hint_fr: 'Par la bouche, longuement.' },
] as const

export const RITUEL_7S_TOTAL_MS = 7000
export const RITUEL_7S_MAX_DURATION_SEC = 15 // tolérance serveur anti-replay

// Banque d'affirmations FR — tirage uniforme à chaque session
export const RITUEL_7S_AFFIRMATIONS_FR = [
  'Je choisis autre chose.',
  'Je reviens à moi.',
  'Cette envie passe.',
  'Je suis plus grand que ça.',
  'Je me libère.',
  'Je respire, je relâche.',
  'Mon corps sait ce qui est juste.',
  'Je choisis ma liberté.',
] as const

export type Rituel7sAffirmation = typeof RITUEL_7S_AFFIRMATIONS_FR[number]

/** Tire une affirmation au sort (uniforme). */
export function pickAffirmation(): Rituel7sAffirmation {
  const idx = Math.floor(Math.random() * RITUEL_7S_AFFIRMATIONS_FR.length)
  return RITUEL_7S_AFFIRMATIONS_FR[idx]!
}
