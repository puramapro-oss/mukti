// MUKTI — Contrat unique de structure pour l’outil, la persistance et la lecture.
// Ce contrôle ne qualifie ni les conseils, ni les plantes, ni les scripts d’hypnose.

import { z } from 'zod'
import { ADDICTION_TYPES } from './constants/addictions'

const text = z.string()
const texts = z.array(text)
const seconds = (minimum: number, maximum: number) =>
  z.number().int().min(minimum).max(maximum)

// Métadonnée de contrôle du délai, indépendante du contenu généré.
export const PROGRAM_GENERATED_AT_SCHEMA = z.iso.datetime({ offset: true })

export const PROGRAM_STRUCTURE_SCHEMA = z.object({
  addiction_type: z.enum(ADDICTION_TYPES.map(({ id }) => id)),
  severity: z.number().int().min(1).max(5),
  intention: text,
  phases: z.array(z.object({
    name: text,
    days_range: text,
    intent: text,
    daily_rituals: z.array(z.object({
      moment: z.enum(['reveil', 'midi', 'soir', 'nuit']),
      title: text,
      duration_sec: seconds(10, 1800),
      description: text,
    })),
    recommended_modes: texts,
    affirmations: texts,
  })).length(3),
  micro_meditations: z.array(z.object({
    trigger: z.enum(['reveil', 'midi', 'soir', 'pulsion', 'stress', 'fatigue']),
    title: text,
    script: text,
    duration_sec: seconds(10, 60),
  })).min(4),
  affirmations: texts.min(10),
  recommended_modes: texts,
  plants_info: z.array(z.object({
    name: text,
    // L’ancien schéma autorisait l’absence ; le type et l’affichage utilisent null.
    latin_name: text.nullable().default(null),
    benefits: text,
    disclaimer: text,
  })).default([]),
  anti_pulsion_actions: z.array(z.object({
    situation: text,
    action: text,
    duration_sec: seconds(5, 600),
  })),
  breathing_protocols: z.array(z.object({
    name: text,
    pattern: text,
    description: text,
  })),
  hypnose_scripts: z.array(z.object({
    title: text,
    duration_min: z.number().min(1).max(30),
    script: text,
  })),
  risk_triggers: texts,
  success_markers: texts,
  emergency_message: text,
})

export class ProgramStructureError extends Error {
  readonly code = 'INVALID_PROGRAM_STRUCTURE'

  constructor() {
    super('La structure du programme est invalide.')
    this.name = 'ProgramStructureError'
  }
}

/** Valide et copie la structure ; les champs inconnus ne sont pas propagés. */
export function parseProgramStructure(value: unknown): z.infer<typeof PROGRAM_STRUCTURE_SCHEMA> {
  const result = PROGRAM_STRUCTURE_SCHEMA.safeParse(value)
  if (!result.success) throw new ProgramStructureError()
  return result.data
}

/** Même contrat envoyé au modèle. Un JSON conforme n’est pas une validation clinique. */
export const PROGRAM_TOOL_SCHEMA = {
  name: 'produce_program',
  description: 'Retourne le programme d’accompagnement structuré en JSON.',
  input_schema: {
    ...z.toJSONSchema(PROGRAM_STRUCTURE_SCHEMA, { target: 'draft-07', io: 'input' }),
    type: 'object' as const,
  },
}

