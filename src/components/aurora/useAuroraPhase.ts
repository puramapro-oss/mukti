'use client'

// MUKTI — G5.3 useAuroraPhase
// Engine state machine des 5 phases AURORA OMEGA (brief section 5).
// Consomme AURORA_PHASES (constants) + produit BreathState + calcule cohérence.
//
// Timeline interne :
//   - phaseIndex ∈ 0..4 (armement → double_sigh → resonance_core → omega_lock → glide_out)
//   - chaque phase contient N cycles de respiration (inspire + top_up? + hold? + expire)
//   - top_up est traité visuellement comme inspire (les visuels voient 'inspire')
//   - fin de la dernière phase → stopped_reason='glide_out_complete'
//
// API :
//   - state : { phase, progress, elapsedSec, phaseDurationSec }
//   - meta  : { currentPhaseIndex, currentPhaseName, totalPhases: 5,
//              phaseStartSec, sessionElapsedSec, coherence, breathsCounted,
//              phasesCompleted[], running, paused }
//   - actions : start, pause, resume, stop, markDizzy

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AURORA_PHASES } from '@/lib/constants'
import { planBreathCycle } from './aurora-phase-helpers'
import type { BreathPhase, BreathState } from './types'
import type {
  AuroraPhaseMeta,
  PhaseCompletionRecord,
  StoppedReason,
  BreathSubStep,
  UseAuroraPhaseOptions,
} from './useAuroraPhase.types'

// Re-export types for convenience
export type {
  AuroraPhaseMeta,
  PhaseCompletionRecord,
  StoppedReason,
  UseAuroraPhaseOptions,
}

export function useAuroraPhase(opts: UseAuroraPhaseOptions) {
  const phases = useMemo(() => AURORA_PHASES[opts.variant].map((phase) => ({
    ...phase,
    breath: { ...phase.breath, hold: opts.powerSwitch === 'soft' ? 0 : phase.breath.hold },
  })), [opts.variant, opts.powerSwitch])
  const sessionTotalSec = useMemo(
    () => phases.reduce((s, p) => s + p.duration_sec, 0),
    [phases]
  )

  const [state, setState] = useState<BreathState>({
    phase: 'idle',
    progress: 0,
    elapsedSec: 0,
    phaseDurationSec: 0,
  })
  const [meta, setMeta] = useState<AuroraPhaseMeta>(() => ({
    currentPhaseIndex: 0,
    currentPhaseName: 'idle',
    currentPhaseLabel: 'Prêt·e ?',
    totalPhases: 5,
    sessionElapsedSec: 0,
    sessionTotalSec,
    phaseStartSec: 0,
    phaseDurationSec: 0,
    breathsCounted: 0,
    coherence: 1,
    phasesCompleted: [],
    running: false,
    paused: false,
    stoppedReason: null,
  }))

  // Refs internes (évite de rebuild le RAF loop à chaque re-render)
  const runningRef = useRef(false)
  const pausedRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  const phaseIndexRef = useRef(0)
  const phaseStartTsRef = useRef(0) // performance.now() au début phase
  const subIndexRef = useRef(0) // index dans cycle en cours
  const cycleRef = useRef<BreathSubStep[]>([])
  const subStartTsRef = useRef(0)
  const pauseStartRef = useRef<number | null>(null)

  // Cohérence : ratios actuel/planifié par sub-step, rolling window
  const coherenceSamplesRef = useRef<number[]>([])

  // Phase completed accumulator
  const phaseBreathsRef = useRef(0)
  const phaseStartSessionSecRef = useRef(0) // elapsed de session au début phase
  const phasesCompletedRef = useRef<PhaseCompletionRecord[]>([])

  // Loop ref to break circular dependency
  const loopRef = useRef<((now: number) => void) | null>(null)

  // --------- Helpers ---------
  const computeRollingCoherence = useCallback((): number => {
    const samples = coherenceSamplesRef.current
    if (samples.length === 0) return 1
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    const variance =
      samples.reduce((sum, r) => sum + (r - mean) ** 2, 0) / samples.length
    const score = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) * 1.5))
    return Math.round(score * 1000) / 1000
  }, [])

  const recordSubStepCoherence = useCallback((actualSec: number, plannedSec: number) => {
    if (plannedSec <= 0) return
    const ratio = actualSec / plannedSec
    // window max 40 samples (~40 souffles)
    const arr = coherenceSamplesRef.current
    arr.push(ratio)
    if (arr.length > 40) arr.shift()
  }, [])

  // --------- RAF loop ---------
  const loop = useCallback((now: number): void => {
      if (!runningRef.current) return
      if (pausedRef.current) {
        rafRef.current = null
        return
      }

      const idx = phaseIndexRef.current
      if (idx >= phases.length) {
        // Session finie — géré par completePhase() au moment de terminer la dernière phase
        return
      }
      const currentPhase = phases[idx]

      const phaseElapsedMs =
        now - phaseStartTsRef.current
      const phaseElapsedSec = phaseElapsedMs / 1000

      // Progression globale (session) pour UI
      // Plan cycle actuel si absent
      if (cycleRef.current.length === 0) {
        cycleRef.current = planBreathCycle(currentPhase.breath)
        subIndexRef.current = 0
        subStartTsRef.current = now
      }

      const cycle = cycleRef.current
      const subIdx = subIndexRef.current
      const currentSub = cycle[subIdx]
      const subElapsedMs =
        now - subStartTsRef.current
      const subElapsedSec = subElapsedMs / 1000

      // Check fin de sub-step
      if (subElapsedSec >= currentSub.plannedSec) {
        // Enregistre cohérence de ce sub-step
        recordSubStepCoherence(subElapsedSec, currentSub.plannedSec)

        // Next sub
        const nextSubIdx = subIdx + 1
        if (nextSubIdx >= cycle.length) {
          // Cycle complet = 1 souffle
          phaseBreathsRef.current += 1
          // Prépare nouveau cycle
          cycleRef.current = planBreathCycle(currentPhase.breath)
          subIndexRef.current = 0
        } else {
          subIndexRef.current = nextSubIdx
        }
        subStartTsRef.current = now
        const newSub = cycleRef.current[subIndexRef.current]
        if (phaseElapsedSec < currentPhase.duration_sec) opts.onBreathStep?.(newSub.sub)
      }

      // Check fin de phase ?
      if (phaseElapsedSec >= currentPhase.duration_sec) {
        // Complète la phase
        const rec: PhaseCompletionRecord = {
          phase: currentPhase.name,
          duration_sec: currentPhase.duration_sec,
          breaths_counted: phaseBreathsRef.current,
          coherence: computeRollingCoherence(),
        }
        phasesCompletedRef.current.push(rec)

        const nextIdx = idx + 1
        if (nextIdx >= phases.length) {
          // Session complète
          runningRef.current = false
          rafRef.current = null
          setState({ phase: 'idle', progress: 1, elapsedSec: sessionTotalSec, phaseDurationSec: 0 })
          const finalMeta: AuroraPhaseMeta = {
            currentPhaseIndex: phases.length - 1,
            currentPhaseName: 'glide_out',
            currentPhaseLabel: 'Session complète',
            totalPhases: 5,
            sessionElapsedSec: sessionTotalSec,
            sessionTotalSec,
            phaseStartSec: phaseStartSessionSecRef.current,
            phaseDurationSec: currentPhase.duration_sec,
            breathsCounted: phaseBreathsRef.current,
            coherence: computeRollingCoherence(),
            phasesCompleted: [...phasesCompletedRef.current],
            running: false,
            paused: false,
            stoppedReason: 'glide_out_complete',
          }
          setMeta(finalMeta)
          opts.onComplete?.(finalMeta)
          return
        }

        // Passe à la phase suivante
        phaseIndexRef.current = nextIdx
        phaseStartSessionSecRef.current += currentPhase.duration_sec
        phaseStartTsRef.current = now
        phaseBreathsRef.current = 0
        cycleRef.current = planBreathCycle(phases[nextIdx].breath)
        subIndexRef.current = 0
        subStartTsRef.current = now
        opts.onPhaseChange?.(phases[nextIdx].name, nextIdx)
        opts.onBreathStep?.(cycleRef.current[0].sub)
      }

      // Update UI state
      const currentCycleSub = cycleRef.current[subIndexRef.current] ?? currentSub
      const uiPhase: BreathPhase = currentCycleSub?.sub ?? 'idle'
      const uiDuration = currentCycleSub?.plannedSec ?? 1
      const uiProgress = Math.max(0, Math.min(1, (now - subStartTsRef.current) / 1000 / uiDuration))
      const sessionElapsedSec = phaseStartSessionSecRef.current + (now - phaseStartTsRef.current) / 1000
      const coherence = computeRollingCoherence()

      setState({
        phase: uiPhase,
        progress: uiProgress,
        elapsedSec: sessionElapsedSec,
        phaseDurationSec: uiDuration,
      })
      setMeta((prev) => ({
        ...prev,
        currentPhaseIndex: phaseIndexRef.current,
        currentPhaseName: phases[phaseIndexRef.current].name,
        currentPhaseLabel: phases[phaseIndexRef.current].label_fr,
        sessionElapsedSec,
        sessionTotalSec,
        phaseStartSec: phaseStartSessionSecRef.current,
        phaseDurationSec: phases[phaseIndexRef.current].duration_sec,
        breathsCounted: phaseBreathsRef.current,
        coherence,
        running: true,
        paused: false,
      }))

      rafRef.current = requestAnimationFrame(loopRef.current!)
  }, [phases, opts, sessionTotalSec, computeRollingCoherence, recordSubStepCoherence])

  // Update loopRef after loop is defined
  useEffect(() => {
    loopRef.current = loop
  }, [loop])

  // --------- Actions ---------
  const start = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    pausedRef.current = false
    phaseIndexRef.current = 0
    phaseStartTsRef.current = performance.now()
    subIndexRef.current = 0
    cycleRef.current = planBreathCycle(phases[0].breath)
    subStartTsRef.current = phaseStartTsRef.current
    pauseStartRef.current = null
    phaseBreathsRef.current = 0
    phaseStartSessionSecRef.current = 0
    phasesCompletedRef.current = []
    coherenceSamplesRef.current = []
    setState({ phase: 'inspire', progress: 0, elapsedSec: 0, phaseDurationSec: cycleRef.current[0].plannedSec })
    setMeta({
      currentPhaseIndex: 0, currentPhaseName: phases[0].name, currentPhaseLabel: phases[0].label_fr,
      totalPhases: phases.length, sessionElapsedSec: 0, sessionTotalSec, phaseStartSec: 0,
      phaseDurationSec: phases[0].duration_sec, breathsCounted: 0, coherence: 1,
      phasesCompleted: [], running: true, paused: false, stoppedReason: null,
    })

    opts.onPhaseChange?.(phases[0].name, 0)
    opts.onBreathStep?.('inspire')

    rafRef.current = requestAnimationFrame(loopRef.current!)
  }, [opts, phases, sessionTotalSec])

  const pause = useCallback(() => {
    if (!runningRef.current || pausedRef.current) return
    pausedRef.current = true
    pauseStartRef.current = performance.now()
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setMeta((p) => ({ ...p, paused: true }))
  }, [])

  const resume = useCallback(() => {
    if (!runningRef.current || !pausedRef.current) return
    pausedRef.current = false
    if (pauseStartRef.current !== null) {
      const pausedMs = performance.now() - pauseStartRef.current
      phaseStartTsRef.current += pausedMs
      subStartTsRef.current += pausedMs
      pauseStartRef.current = null
    }
    setMeta((p) => ({ ...p, paused: false }))
    rafRef.current = requestAnimationFrame(loopRef.current!)
  }, [])

  const stop = useCallback(
    (reason: StoppedReason = 'user_stop') => {
      if (!runningRef.current) return
      runningRef.current = false
      pausedRef.current = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null

      // Enregistre la phase courante comme partielle
      const idx = phaseIndexRef.current
      const phase = phases[idx]
      const elapsedSecNow =
        Math.max(0, Math.min(phase.duration_sec,
          ((pauseStartRef.current ?? performance.now()) - phaseStartTsRef.current) / 1000))
      pauseStartRef.current = null
      phasesCompletedRef.current.push({
        phase: phase.name,
        duration_sec: Math.round(elapsedSecNow * 10) / 10,
        breaths_counted: phaseBreathsRef.current,
        coherence: computeRollingCoherence(),
      })

      const finalMeta: AuroraPhaseMeta = {
        currentPhaseIndex: idx,
        currentPhaseName: phase.name,
        currentPhaseLabel: phase.label_fr,
        totalPhases: 5,
        sessionElapsedSec: phaseStartSessionSecRef.current + elapsedSecNow,
        sessionTotalSec,
        phaseStartSec: phaseStartSessionSecRef.current,
        phaseDurationSec: phase.duration_sec,
        breathsCounted: phaseBreathsRef.current,
        coherence: computeRollingCoherence(),
        phasesCompleted: [...phasesCompletedRef.current],
        running: false,
        paused: false,
        stoppedReason: reason,
      }
      setMeta(finalMeta)
      setState({ phase: 'idle', progress: 0, elapsedSec: finalMeta.sessionElapsedSec, phaseDurationSec: 0 })
      opts.onStop?.(reason, finalMeta)
    },
    [phases, sessionTotalSec, computeRollingCoherence, opts]
  )

  const markDizzy = useCallback(() => stop('dizzy'), [stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return {
    state,
    meta,
    actions: { start, pause, resume, stop, markDizzy },
  }
}
