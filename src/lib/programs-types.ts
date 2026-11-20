import type { z } from 'zod'
import type { PROGRAM_STRUCTURE_SCHEMA } from './programs-schema'

// Les types sont dérivés du contrat réellement exécuté, sans preuve clinique implicite.
export type ProgramStructure = z.infer<typeof PROGRAM_STRUCTURE_SCHEMA>
export type ProgramPhase = ProgramStructure['phases'][number]
export type MicroMeditation = ProgramStructure['micro_meditations'][number]
export type PlantInfo = ProgramStructure['plants_info'][number]
export type AntiPulsionAction = ProgramStructure['anti_pulsion_actions'][number]
export type HypnoseScript = ProgramStructure['hypnose_scripts'][number]

export interface StoredProgram extends ProgramStructure {
  id: string
  addiction_id: string
  user_id: string
  version: number
  model_used: string
  generated_at: string
  is_current: boolean
}

