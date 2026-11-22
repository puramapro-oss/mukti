import { useCallback, useEffect, useRef, useState } from 'react'
import { EXORCISME_PHASES, type ExorcismePhaseName } from '@/lib/exorcisme-utils'

type PhaseMs = Partial<Record<ExorcismePhaseName, number>>

export interface UseExorcismePhaseReturn {
  phase: ExorcismePhaseName
  phaseMsRef: React.MutableRefObject<PhaseMs>
  startTsRef: React.MutableRefObject<number>
  goToPhase: (next: ExorcismePhaseName) => void
  snapshotPhaseDurations: (now?: number) => PhaseMs
}

export function useExorcismePhase(): UseExorcismePhaseReturn {
  const [phase, setPhase] = useState<ExorcismePhaseName>('invocation')
  const phaseRef = useRef<ExorcismePhaseName>('invocation')
  const initializedRef = useRef(false)
  const startTsRef = useRef(0)
  const phaseStartRef = useRef(0)
  const phaseMsRef = useRef<PhaseMs>({})

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      const now = performance.now()
      startTsRef.current = now
      phaseStartRef.current = now
    }
  }, [])

  const goToPhase = useCallback((next: ExorcismePhaseName) => {
    const previous = phaseRef.current
    if (next === previous) return
    const now = performance.now()
    phaseMsRef.current[previous] = (phaseMsRef.current[previous] ?? 0) +
      Math.max(0, Math.round(now - phaseStartRef.current))
    phaseStartRef.current = now
    phaseRef.current = next
    // State updater functions remain pure, including in React StrictMode.
    setPhase(next)
  }, [])

  const snapshotPhaseDurations = useCallback((now = performance.now()): PhaseMs => {
    if (!initializedRef.current) return {}
    const current = phaseRef.current
    return {
      ...phaseMsRef.current,
      [current]: (phaseMsRef.current[current] ?? 0) +
        Math.max(0, Math.round(now - phaseStartRef.current)),
    }
  }, [])

  useEffect(() => {
    if (phase !== 'invocation' && phase !== 'reprogrammation') return
    const duration = EXORCISME_PHASES.find(p => p.name === phase)?.duration_ms
    if (duration === null || duration === undefined) return
    const next = phase === 'invocation' ? 'revelation' : 'scellement'
    const timer = setTimeout(() => goToPhase(next), duration)
    return () => clearTimeout(timer)
  }, [phase, goToPhase])

  return { phase, phaseMsRef, startTsRef, goToPhase, snapshotPhaseDurations }
}
