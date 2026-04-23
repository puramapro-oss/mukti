// MUKTI — G5.2 AURORA types partagés

export type BreathPhase = 'inspire' | 'expire' | 'hold' | 'idle'

export interface BreathState {
  phase: BreathPhase
  /** 0-1 progression dans la phase courante */
  progress: number
  /** Temps cumulé (s) depuis le début de la session */
  elapsedSec: number
  /** Durée (s) de la phase courante */
  phaseDurationSec: number
}
