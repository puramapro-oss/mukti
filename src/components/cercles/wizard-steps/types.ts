export interface Phrase {
  id: string
  text_fr: string
  text_en: string
  weight: number
}

export type Step = 1 | 2 | 3 | 4 | 5

export const PARTICIPANT_PRESETS = [2, 4, 6, 8, 20, 50, 100, 500] as const
