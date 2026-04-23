// MUKTI — G5.7 Exorcisme de l'Addiction (Mode 10) — pure-logic client-safe
// Séance cathartique 5 phases : invocation → révélation → destruction → reprogrammation → scellement.
// Aucun import serveur — importable depuis Client Components.

export type ExorcismeOutcome = 'completed' | 'interrupted'

export type ExorcismePhaseName =
  | 'invocation'
  | 'revelation'
  | 'destruction'
  | 'reprogrammation'
  | 'scellement'

export interface ExorcismePhase {
  name: ExorcismePhaseName
  index: number
  label_fr: string
  hint_fr: string
  duration_ms: number | null // null = user-paced (pas de timeout auto)
}

/** 5 phases ordonnées. */
export const EXORCISME_PHASES: readonly ExorcismePhase[] = [
  {
    name: 'invocation',
    index: 0,
    label_fr: 'Invocation',
    hint_fr: 'Pose ton téléphone. Prépare-toi.',
    duration_ms: 10_000,
  },
  {
    name: 'revelation',
    index: 1,
    label_fr: 'Révélation',
    hint_fr: 'Nomme ce qui te possède.',
    duration_ms: null,
  },
  {
    name: 'destruction',
    index: 2,
    label_fr: 'Destruction',
    hint_fr: 'Frappe. Encore. Encore.',
    duration_ms: null,
  },
  {
    name: 'reprogrammation',
    index: 3,
    label_fr: 'Reprogrammation',
    hint_fr: 'Prends en toi ce qui remplace.',
    duration_ms: 18_000,
  },
  {
    name: 'scellement',
    index: 4,
    label_fr: 'Scellement',
    hint_fr: 'Scelle cette libération.',
    duration_ms: 10_000,
  },
] as const

/** Limites texte "ce qui me possède" — concis, sans PII. */
export const EXORCISME_MIN_TEXT_LENGTH = 1
export const EXORCISME_MAX_TEXT_LENGTH = 80

/** Nombre de tapes requis pour briser le texte durant Destruction. */
export const EXORCISME_SHATTER_TAPS = 4

/** Affirmations fallback FR — utilisées si Haiku indisponible. Tutoiement, non religieux. */
export const EXORCISME_FALLBACK_AFFIRMATIONS_FR: readonly string[] = [
  'Ce qui me possédait n\'a plus de prise. Je choisis ce qui me nourrit.',
  'Je reprends la place que je m\'étais laissé voler.',
  'Mon corps sait. Je l\'écoute, je le respecte.',
  'L\'envie passe. Moi, je reste.',
  'Je ne suis pas cette pulsion. Je suis bien plus grand·e.',
  'À chaque fois que je choisis autre chose, je deviens plus libre.',
  'Ce vide que je comblais — je le traverse maintenant sans fuir.',
  'Je me libère sans me punir. Doucement, fermement.',
]

/** Tire une affirmation fallback aléatoirement. */
export function pickFallbackAffirmation(): string {
  const n = EXORCISME_FALLBACK_AFFIRMATIONS_FR.length
  const i = Math.floor(Math.random() * n)
  return EXORCISME_FALLBACK_AFFIRMATIONS_FR[i]!
}

/** Sanitize texte utilisateur (trim + limite) — pas d'échappement HTML ici (React gère). */
export function sanitizePossessionText(raw: string): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, EXORCISME_MAX_TEXT_LENGTH)
}
