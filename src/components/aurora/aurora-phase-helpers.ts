import type { AuroraPhase } from '@/lib/constants'
import type { BreathSubStep } from './useAuroraPhase.types'

/** A top-up continues the inhale; optional holds disappear in the soft plan. */
export function planBreathCycle(breath: AuroraPhase['breath']): BreathSubStep[] {
  const out: BreathSubStep[] = [{ sub: 'inspire', plannedSec: breath.in }]
  if (breath.top_up && breath.top_up > 0) {
    out.push({ sub: 'inspire', plannedSec: breath.top_up })
  }
  if (breath.hold && breath.hold > 0) {
    out.push({ sub: 'hold', plannedSec: breath.hold })
  }
  out.push({ sub: 'expire', plannedSec: breath.out })
  return out
}
