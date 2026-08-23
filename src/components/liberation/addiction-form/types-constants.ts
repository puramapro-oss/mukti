import type { AddictionId } from '@/lib/constants'

export type Severity = 1 | 2 | 3 | 4 | 5
export type Goal = 'reduce' | 'stop'

export interface FormState {
  type: AddictionId | null
  severity: Severity
  frequency_daily: number | ''
  started_ago_months: number | ''
  goal: Goal
  custom_label: string
  triggers: string[]
}

export const TRIGGERS_BY_TYPE: Record<AddictionId, string[]> = {
  tabac: ['Stress', 'Café', 'Après repas', 'Alcool', 'Soirée', 'Pause boulot', 'Téléphone', 'Conduite'],
  alcool: ['Stress', 'Apéro', 'Soirée', 'Seul(e)', 'Week-end', 'Repas', 'Anxiété', 'Évènements sociaux'],
  sucre: ['Émotionnel', 'Fatigue', 'Stress', 'Ennui', 'Après repas', 'Soirée', 'Publicité', 'TV'],
  drogue: ['Soirée', 'Stress', 'Entourage', 'Musique', 'Week-end', 'Solitude', 'Déception', 'Excitation'],
  ecran: ['Ennui', 'Anxiété', 'Attente', 'Soirée', 'Au réveil', 'Transports', 'Au lit', 'Solitude'],
  jeux: ['Solitude', 'Stress', 'Ennui', 'Adrénaline', 'Week-end', 'Évasion', 'Frustration'],
  reseaux_sociaux: ['Ennui', 'Comparaison', 'FOMO', 'Attente', 'Notification', 'Au réveil', 'Au lit'],
  pornographie: ['Solitude', 'Stress', 'Fatigue', 'Nuit', 'Ennui', 'Anxiété', 'Frustration'],
  achats: ['Pub', 'Mauvaise journée', 'Stress', 'Réconfort', 'Promos', 'Scroll', 'Week-end'],
  nourriture: ['Émotionnel', 'Stress', 'Ennui', 'Soirée', 'Fatigue', 'Solitude', 'Récompense'],
  codependance: ['Besoin validation', 'Peur solitude', 'Insécurité', 'Relation instable', 'Comparaison'],
  travail: ['Pression', 'Peur échec', 'Perfectionnisme', 'Burnout', 'Validation', 'Dopamine projet'],
  autre: ['Stress', 'Solitude', 'Fatigue', 'Ennui', 'Émotionnel', 'Évasion'],
}

export const INITIAL_STATE: FormState = {
  type: null,
  severity: 3,
  frequency_daily: '',
  started_ago_months: '',
  goal: 'stop',
  custom_label: '',
  triggers: [],
}

export const STEPS = [
  { id: 1, title: 'Ton défi' },
  { id: 2, title: 'Intensité' },
  { id: 3, title: 'Histoire' },
  { id: 4, title: 'Déclencheurs' },
] as const
