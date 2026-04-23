// MUKTI — G5.7 Boucle Urgence Invisible (Mode 9) — pure-logic client-safe
// Overlay discret "personne ne remarque" : micro-vibrations + mini-respi + mots flottants.
// Aucun import serveur — importable depuis Client Components.

export type BoucleUrgenceTrigger = 'page' | 'shortcut'
export type BoucleUrgenceOutcome = 'completed' | 'interrupted'

/** Durée cible en secondes : 60–300 (défaut 180). */
export const BOUCLE_URGENCE_DEFAULT_DURATION_SEC = 180
export const BOUCLE_URGENCE_MIN_DURATION_SEC = 60
export const BOUCLE_URGENCE_MAX_DURATION_SEC = 300

/** Choix utilisateur proposés dans l'UI de démarrage. */
export const BOUCLE_URGENCE_DURATION_CHOICES_SEC = [60, 120, 180, 300] as const

/** Pattern haptique discret : 2 micro-tap + 1 pause. Boucle toutes les ~6 secondes. */
export const BOUCLE_URGENCE_HAPTIC_PATTERN: readonly number[] = [60, 120, 60, 120]
export const BOUCLE_URGENCE_HAPTIC_INTERVAL_MS = 6000

/** Cycle respiration minimal (4s inspire / 3s expire) — en bas-droite, 48px. */
export const BOUCLE_URGENCE_BREATH_CYCLE_MS = 7000

/** Intervalle d'apparition d'un mot flottant. */
export const BOUCLE_URGENCE_WORD_INTERVAL_MS = 5000
export const BOUCLE_URGENCE_WORD_VISIBLE_MS = 3200

/** Vocabulaire FR — mots courts, doux, non-religieux. */
export const BOUCLE_URGENCE_WORDS_FR: readonly string[] = [
  'respire',
  'ici',
  'passe',
  'toi',
  'libre',
  'choix',
  'doux',
  'calme',
  'revient',
  'présent',
  'maintenant',
  'pause',
]

/**
 * Rotation déterministe : même index → même mot.
 * Permet une séquence prévisible pour debug + seed stable côté serveur.
 */
export function pickWord(index: number): string {
  const n = BOUCLE_URGENCE_WORDS_FR.length
  const i = ((index % n) + n) % n
  return BOUCLE_URGENCE_WORDS_FR[i]!
}

/** Clamp serveur-side : évite replay/triche. */
export function clampDurationSec(v: number): number {
  if (!Number.isFinite(v)) return BOUCLE_URGENCE_DEFAULT_DURATION_SEC
  return Math.min(
    BOUCLE_URGENCE_MAX_DURATION_SEC,
    Math.max(BOUCLE_URGENCE_MIN_DURATION_SEC, Math.round(v))
  )
}
