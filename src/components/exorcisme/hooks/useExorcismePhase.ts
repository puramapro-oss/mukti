import { useCallback, useEffect, useRef, useState } from 'react'
import { EXORCISME_PHASES, type ExorcismePhaseName } from '@/lib/exorcisme-utils'

type PhaseMs = Partial<Record<ExorcismePhaseName, number>>

export interface UseExorcismePhaseReturn {
  phase: ExorcismePhaseName
  phaseMsRef: React.MutableRefObject<PhaseMs>
  startTsRef: React.MutableRefObject<number>
  goToPhase: (next: ExorcismePhaseName) => void
}

export function useExorcismePhase(): UseExorcismePhaseReturn {
  const [phase, setPhase] = useState<ExorcismePhaseName>('invocation')
  const startTsRef = useRef<number>(0)
  const phaseStartRef = useRef<number>(0)
  const phaseMsRef = useRef<PhaseMs>({})

  useEffect(() => {
    if (startTsRef.current === 0) {
      const now = performance.now()
      startTsRef.current = now
      phaseStartRef.current = now
    }
  }, [])

  const goToPhase = useCallback((next: ExorcismePhaseName) => {
    const now = performance.now()
    setPhase(prev => {
      phaseMsRef.current[prev] = Math.max(
        0,
        Math.round(now - phaseStartRef.current)
      )
      phaseStartRef.current = now
      return next
    })
  }, [])

  // Phase 1 : INVOCATION — auto-advance après 10s
  useEffect(() => {
    if (phase !== 'invocation') return
    const phaseDur = EXORCISME_PHASES.find(p => p.name === 'invocation')?.duration_ms ?? 10000
    const timer = setTimeout(() => goToPhase('revelation'), phaseDur)
    return () => clearTimeout(timer)
  }, [phase, goToPhase])

  // Phase 4 : REPROGRAMMATION — auto-advance après duration
  useEffect(() => {
    if (phase !== 'reprogrammation') return
    const phaseDur =
      EXORCISME_PHASES.find(p => p.name === 'reprogrammation')?.duration_ms ?? 18000
    const timer = setTimeout(() => goToPhase('scellement'), phaseDur)
    return () => clearTimeout(timer)
  }, [phase, goToPhase])

  return {
    phase,
    phaseMsRef,
    startTsRef,
    goToPhase,
  }
}
