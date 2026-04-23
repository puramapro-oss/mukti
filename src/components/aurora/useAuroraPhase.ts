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
import type { AuroraPhase, AuroraPhaseName, AuroraVariant } from '@/lib/constants'
import type { BreathPhase, BreathState } from './types'

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

interface BreathSubStep {
  sub: BreathPhase // 'inspire'|'expire'|'hold'
  plannedSec: number
}

function planBreathCycle(breath: AuroraPhase['breath']): BreathSubStep[] {
  const out: BreathSubStep[] = []
  out.push({ sub: 'inspire', plannedSec: breath.in })
  if (breath.top_up && breath.top_up > 0) {
    // top_up = continuation de l'inspire — même phase visuelle
    out.push({ sub: 'inspire', plannedSec: breath.top_up })
  }
  if (breath.hold && breath.hold > 0) {
    out.push({ sub: 'hold', plannedSec: breath.hold })
  }
  out.push({ sub: 'expire', plannedSec: breath.out })
  return out
}

export interface UseAuroraPhaseOptions {
  variant: AuroraVariant
  /** Callback appelé quand la phase change (utile pour audio/haptic sync). */
  onPhaseChange?: (phase: AuroraPhaseName, index: number) => void
  /** Callback appelé au début de chaque sub-step inspire/expire/hold. */
  onBreathStep?: (sub: BreathPhase) => void
  /** Callback une fois la session complète (phase 4 terminée). */
  onComplete?: (meta: AuroraPhaseMeta) => void
  /** Callback si user arrête manuellement. */
  onStop?: (reason: StoppedReason, meta: AuroraPhaseMeta) => void
}

export function useAuroraPhase(opts: UseAuroraPhaseOptions) {
  const phases = useMemo(() => AURORA_PHASES[opts.variant], [opts.variant])
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
  const pauseAccumRef = useRef(0) // ms cumulés pendant pauses
  const pauseStartRef = useRef<number | null>(null)

  // Cohérence : ratios actuel/planifié par sub-step, rolling window
  const coherenceSamplesRef = useRef<number[]>([])

  // Phase completed accumulator
  const phaseBreathsRef = useRef(0)
  const phaseStartSessionSecRef = useRef(0) // elapsed de session au début phase
  const phasesCompletedRef = useRef<PhaseCompletionRecord[]>([])

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
  const loop = useCallback(
    (now: number) => {
      if (!runningRef.current) return
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const idx = phaseIndexRef.current
      if (idx >= phases.length) {
        // Session finie — géré par completePhase() au moment de terminer la dernière phase
        return
      }
      const currentPhase = phases[idx]

      const phaseElapsedMs =
        now - phaseStartTsRef.current - pauseAccumRef.current
      const phaseElapsedSec = phaseElapsedMs / 1000

      // Progression globale (session) pour UI
      const sessionElapsedSec = phaseStartSessionSecRef.current + phaseElapsedSec

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
        now - subStartTsRef.current - pauseAccumRef.current
      const subElapsedSec = subElapsedMs / 1000
      const subProgress = Math.min(1, subElapsedSec / currentSub.plannedSec)

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
        pauseAccumRef.current = 0 // reset pause accum pour le nouveau sub
        const newSub = cycleRef.current[subIndexRef.current]
        opts.onBreathStep?.(newSub.sub)
      }

      // Check fin de phase ?
      if (phaseElapsedSec >= currentPhase.duration_sec) {
        // Complète la phase
        const rec: PhaseCompletionRecord = {
          phase: currentPhase.name,
          duration_sec: Math.round(phaseElapsedSec * 10) / 10,
          breaths_counted: phaseBreathsRef.current,
          coherence: computeRollingCoherence(),
        }
        phasesCompletedRef.current.push(rec)

        const nextIdx = idx + 1
        if (nextIdx >= phases.length) {
          // Session complète
          runningRef.current = false
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
        pauseAccumRef.current = 0
        phaseBreathsRef.current = 0
        cycleRef.current = [] // reset cycle plan
        opts.onPhaseChange?.(phases[nextIdx].name, nextIdx)
      }

      // Update UI state
      const currentCycleSub = cycleRef.current[subIndexRef.current] ?? currentSub
      const uiPhase: BreathPhase = currentCycleSub?.sub ?? 'idle'
      const uiDuration = currentCycleSub?.plannedSec ?? 1
      const uiProgress = Math.max(0, Math.min(1, subProgress))
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

      rafRef.current = requestAnimationFrame(loop)
    },
    [phases, sessionTotalSec, computeRollingCoherence, recordSubStepCoherence, opts]
  )

  // --------- Actions ---------
  const start = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    pausedRef.current = false
    phaseIndexRef.current = 0
    phaseStartTsRef.current = performance.now()
    subIndexRef.current = 0
    cycleRef.current = []
    subStartTsRef.current = performance.now()
    pauseAccumRef.current = 0
    pauseStartRef.current = null
    phaseBreathsRef.current = 0
    phaseStartSessionSecRef.current = 0
    phasesCompletedRef.current = []
    coherenceSamplesRef.current = []

    opts.onPhaseChange?.(phases[0].name, 0)
    opts.onBreathStep?.('inspire')

    rafRef.current = requestAnimationFrame(loop)
  }, [loop, opts, phases])

  const pause = useCallback(() => {
    if (!runningRef.current || pausedRef.current) return
    pausedRef.current = true
    pauseStartRef.current = performance.now()
    setMeta((p) => ({ ...p, paused: true }))
  }, [])

  const resume = useCallback(() => {
    if (!runningRef.current || !pausedRef.current) return
    pausedRef.current = false
    if (pauseStartRef.current !== null) {
      pauseAccumRef.current += performance.now() - pauseStartRef.current
      pauseStartRef.current = null
    }
    setMeta((p) => ({ ...p, paused: false }))
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
        (performance.now() - phaseStartTsRef.current - pauseAccumRef.current) / 1000
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
