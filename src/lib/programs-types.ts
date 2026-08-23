import type { AddictionId } from './constants'

export interface ProgramPhase {
  name: string
  days_range: string
  intent: string
  daily_rituals: { moment: 'reveil' | 'midi' | 'soir' | 'nuit'; title: string; duration_sec: number; description: string }[]
  recommended_modes: string[]
  affirmations: string[]
}

export interface MicroMeditation {
  trigger: 'reveil' | 'midi' | 'soir' | 'pulsion' | 'stress' | 'fatigue'
  title: string
  script: string
  duration_sec: number
}

export interface PlantInfo {
  name: string
  latin_name: string | null
  benefits: string
  disclaimer: string
}

export interface AntiPulsionAction {
  situation: string
  action: string
  duration_sec: number
}

export interface HypnoseScript {
  title: string
  duration_min: number
  script: string
}

export interface ProgramStructure {
  addiction_type: AddictionId
  severity: number
  intention: string
  phases: ProgramPhase[]
  micro_meditations: MicroMeditation[]
  affirmations: string[]
  recommended_modes: string[]
  plants_info: PlantInfo[]
  anti_pulsion_actions: AntiPulsionAction[]
  breathing_protocols: { name: string; pattern: string; description: string }[]
  hypnose_scripts: HypnoseScript[]
  risk_triggers: string[]
  success_markers: string[]
  emergency_message: string
}

export interface StoredProgram extends ProgramStructure {
  id: string
  addiction_id: string
  user_id: string
  version: number
  model_used: string
  generated_at: string
  is_current: boolean
}
