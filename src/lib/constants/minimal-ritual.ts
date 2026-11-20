import type { MinimalRitualHabit } from './core-events'

export const MINIMAL_RITUAL_PARTICIPATION_MODES = ['standard', 'adapted', 'rest'] as const
export type MinimalRitualParticipationMode = typeof MINIMAL_RITUAL_PARTICIPATION_MODES[number]

export const MINIMAL_RITUAL_MODE_OPTIONS = [
  { value: 'standard', label: 'Geste proposé' },
  { value: 'adapted', label: 'Version adaptée' },
  { value: 'rest', label: 'Repos' },
] as const

export const MINIMAL_RITUAL_ADAPTED_PROMPTS: Record<MinimalRitualHabit, string> = {
  respiration_consciente: 'Observe simplement une respiration naturelle, sans la forcer. Tu peux aussi passer ce geste.',
  merci_corps: 'Choisis une phrase neutre qui te convient, ou reste un instant en silence.',
  posture_verticale: 'Garde une position confortable, assise ou allongée. Aucun changement de posture n’est nécessaire.',
  geste_nourrissant: 'Choisis un geste confortable, ou un instant sans geste ni contact avec le corps.',
  pause_ecran: 'Détourne doucement ton attention de l’écran, les yeux ouverts ou fermés selon ton confort.',
  eau_lente: 'Si tu souhaites boire, fais-le à ton rythme en suivant tes consignes habituelles. Sinon, choisis une simple pause.',
  gratitude_micro: 'Nomme quelque chose de neutre ou agréable, sans chercher à ressentir de la gratitude.',
  contact_nature: 'Observe un élément naturel accessible, une image, ou choisis un instant de silence.',
}

export const MINIMAL_RITUAL_REST_PROMPT = 'Tu peux choisir de te reposer. Aucun exercice n’est déclaré réalisé et tes jours déjà reconnus restent conservés.'

export function isMinimalRitualParticipationMode(value: unknown): value is MinimalRitualParticipationMode {
  return typeof value === 'string'
    && (MINIMAL_RITUAL_PARTICIPATION_MODES as readonly string[]).includes(value)
}
