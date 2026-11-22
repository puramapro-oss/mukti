// MUKTI — Types pour useAuroraPhase
import type { AuroraPhaseName, AuroraVariant, AuroraPowerSwitch } from '@/lib/constants'
import type { BreathPhase } from './types'

export interface AuroraPhaseMeta {
  currentPhaseIndex: number // 0..4
  currentPhaseName: AuroraPhaseName | 'idle'
  currentPhaseLabel: string
  totalPhases: number // 5
  sessionElapsedSec: number
  sessionTotalSec: number
  phaseStartSec: number
  phaseDurationSec: number
  breathsCounted: number
  coherence: number // 0-1 running
  phasesCompleted: PhaseCompletionRecord[]
  running: boolean
  paused: boolean
  stoppedReason: StoppedReason | null
}

export interface PhaseCompletionRecord {
  phase: AuroraPhaseName
  duration_sec: number
  breaths_counted: number
  coherence: number | null
}

export type StoppedReason =
  | 'user_stop'
  | 'dizzy'
  | 'glide_out_complete'
  | 'timeout'
  | 'error'

export interface BreathSubStep {
  sub: BreathPhase // 'inspire'|'expire'|'hold'
  plannedSec: number
}

export interface UseAuroraPhaseOptions {
  variant: AuroraVariant
  powerSwitch?: AuroraPowerSwitch
  /** Callback appelé quand la phase change (utile pour audio/haptic sync). */
  onPhaseChange?: (phase: AuroraPhaseName, index: number) => void
  /** Callback appelé au début de chaque sub-step inspire/expire/hold. */
  onBreathStep?: (sub: BreathPhase) => void
  /** Callback une fois la session complète (phase 4 terminée). */
  onComplete?: (meta: AuroraPhaseMeta) => void
  /** Callback si user arrête manuellement. */
  onStop?: (reason: StoppedReason, meta: AuroraPhaseMeta) => void
}
