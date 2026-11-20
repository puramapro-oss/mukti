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
//   - actions : start, pause, resume, stop, markDizzy, rewindPausedTo (rituel)

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

type TimelineCommand = { type: 'pause' } | { type: 'stop'; reason: StoppedReason }

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
  const loopRef = useRef<((now: number, command?: TimelineCommand) => void) | null>(null)

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
  const loop = useCallback((now: number, command?: TimelineCommand): void => {
      if (!runningRef.current) return
      if (pausedRef.current && command?.type !== 'stop') {
        rafRef.current = null
        return
      }
      // A user action can arrive before a delayed RAF. Reconcile that same
      // timeline first, without playing a cue or leaving a frame scheduled.
      if (command) {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      const previousPhaseIndex = phaseIndexRef.current
      if (previousPhaseIndex >= phases.length) {
        return
      }
      let breathChanged = false
      let frameTimingRecorded = false
      let reachedEnd = false
      let currentPhase = phases[phaseIndexRef.current]

      // Advance along scheduled boundaries, not the arrival time of this frame.
      // A late RAF may cross several breaths or phases; none of that active time
      // should disappear. Missed cues are deliberately not replayed below.
      while (true) {
        const phaseEndTs = phaseStartTsRef.current + currentPhase.duration_sec * 1000
        const observedUntilTs = Math.min(now, phaseEndTs)
        if (cycleRef.current.length === 0) {
          cycleRef.current = planBreathCycle(currentPhase.breath)
          subIndexRef.current = 0
          subStartTsRef.current = phaseStartTsRef.current
        }

        let currentSub = cycleRef.current[subIndexRef.current]
        while (subStartTsRef.current + currentSub.plannedSec * 1000 <= observedUntilTs) {
          // Only the first crossed step was displayed before this frame. Keep
          // its timing sample; do not invent perfectly timed samples for all
          // skipped steps. This remains an animation metric, not a breath sensor.
          if (!frameTimingRecorded) {
            recordSubStepCoherence((now - subStartTsRef.current) / 1000, currentSub.plannedSec)
            frameTimingRecorded = true
          }
          subStartTsRef.current += currentSub.plannedSec * 1000
          subIndexRef.current += 1
          if (subIndexRef.current >= cycleRef.current.length) {
            // Scheduled cycles, consistent with rewindPausedTo's reconstruction.
            phaseBreathsRef.current += 1
            subIndexRef.current = 0
          }
          currentSub = cycleRef.current[subIndexRef.current]
          breathChanged = true
        }

        if (now < phaseEndTs) break

        const rec: PhaseCompletionRecord = {
          phase: currentPhase.name,
          duration_sec: currentPhase.duration_sec,
          breaths_counted: phaseBreathsRef.current,
          coherence: computeRollingCoherence(),
        }
        phasesCompletedRef.current.push(rec)

        const nextIdx = phaseIndexRef.current + 1
        if (nextIdx >= phases.length) {
          reachedEnd = true
          break
        }

        // Passe à la phase suivante
        phaseIndexRef.current = nextIdx
        phaseStartSessionSecRef.current += currentPhase.duration_sec
        phaseStartTsRef.current = phaseEndTs
        phaseBreathsRef.current = 0
        cycleRef.current = planBreathCycle(phases[nextIdx].breath)
        subIndexRef.current = 0
        subStartTsRef.current = phaseEndTs
        currentPhase = phases[nextIdx]
      }

      const sessionElapsedSec = reachedEnd ? sessionTotalSec
        : phaseStartSessionSecRef.current + (now - phaseStartTsRef.current) / 1000
      const coherence = computeRollingCoherence()

      if (reachedEnd || command?.type === 'stop') {
        if (!reachedEnd) {
          phasesCompletedRef.current.push({
            phase: currentPhase.name,
            duration_sec: Math.round((now - phaseStartTsRef.current) / 100) / 10,
            breaths_counted: phaseBreathsRef.current,
            coherence,
          })
        }
        runningRef.current = false
        pausedRef.current = false
        pauseStartRef.current = null
        rafRef.current = null
        const reason = command?.type === 'stop' ? command.reason : 'glide_out_complete'
        const finalMeta: AuroraPhaseMeta = {
          currentPhaseIndex: phaseIndexRef.current,
          currentPhaseName: currentPhase.name,
          currentPhaseLabel: command?.type === 'stop' ? currentPhase.label_fr : 'Session complète',
          totalPhases: phases.length,
          sessionElapsedSec,
          sessionTotalSec,
          phaseStartSec: phaseStartSessionSecRef.current,
          phaseDurationSec: currentPhase.duration_sec,
          breathsCounted: phaseBreathsRef.current,
          coherence,
          phasesCompleted: [...phasesCompletedRef.current],
          running: false,
          paused: false,
          stoppedReason: reason,
        }
        setMeta(finalMeta)
        setState({ phase: 'idle', progress: command?.type === 'stop' ? 0 : 1, elapsedSec: sessionElapsedSec, phaseDurationSec: 0 })
        if (command?.type === 'stop') opts.onStop?.(reason, finalMeta)
        else opts.onComplete?.(finalMeta)
        return
      }

      const pausing = command?.type === 'pause'
      if (pausing) {
        pausedRef.current = true
        pauseStartRef.current = now
      }
      const phaseChanged = phaseIndexRef.current !== previousPhaseIndex
      if (!command) {
        if (phaseChanged) opts.onPhaseChange?.(currentPhase.name, phaseIndexRef.current)
        if (phaseChanged || breathChanged) opts.onBreathStep?.(cycleRef.current[subIndexRef.current].sub)
      }

      // Update UI state
      const currentCycleSub = cycleRef.current[subIndexRef.current]
      const uiPhase: BreathPhase = currentCycleSub?.sub ?? 'idle'
      const uiDuration = currentCycleSub?.plannedSec ?? 1
      const uiProgress = Math.max(0, Math.min(1, (now - subStartTsRef.current) / 1000 / uiDuration))

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
        paused: pausing,
      }))

      if (!pausing) rafRef.current = requestAnimationFrame(loopRef.current!)
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
    loopRef.current?.(performance.now(), { type: 'pause' })
  }, [])

  /**
   * Ritual-only replay support: reposition an already paused session without
   * starting a second clock or emitting breathing/audio/haptic callbacks.
   * The caller decides when to replay its narration and call resume().
   */
  const rewindPausedTo = useCallback((seconds: number): boolean => {
    if (!runningRef.current || !pausedRef.current || pauseStartRef.current === null ||
        typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 ||
        seconds >= sessionTotalSec) return false

    const currentPhase = phases[phaseIndexRef.current]
    if (!currentPhase) return false
    const elapsedAtPause = phaseStartSessionSecRef.current + Math.max(0, Math.min(
      currentPhase.duration_sec, (pauseStartRef.current - phaseStartTsRef.current) / 1000
    ))
    if (seconds > elapsedAtPause) return false

    let targetIndex = 0
    let targetPhaseStart = 0
    while (targetIndex < phases.length - 1 &&
           seconds >= targetPhaseStart + phases[targetIndex].duration_sec) {
      targetPhaseStart += phases[targetIndex].duration_sec
      targetIndex += 1
    }
    const targetPhase = phases[targetIndex]
    const phaseElapsed = seconds - targetPhaseStart
    const cycle = planBreathCycle(targetPhase.breath)
    const cycleDuration = cycle.reduce((sum, step) => sum + step.plannedSec, 0)
    const completedCycles = Math.floor(phaseElapsed / cycleDuration)
    let subElapsed = phaseElapsed - completedCycles * cycleDuration
    let targetSubIndex = 0
    while (targetSubIndex < cycle.length - 1 && subElapsed >= cycle[targetSubIndex].plannedSec) {
      subElapsed -= cycle[targetSubIndex].plannedSec
      targetSubIndex += 1
    }
    const targetSub = cycle[targetSubIndex]
    const now = performance.now()

    // Rebase all timestamps together. Time already spent paused cannot be
    // counted on the next resume, and no RAF is requested while rewinding.
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    phaseIndexRef.current = targetIndex
    phaseStartSessionSecRef.current = targetPhaseStart
    phaseStartTsRef.current = now - phaseElapsed * 1000
    cycleRef.current = cycle
    subIndexRef.current = targetSubIndex
    subStartTsRef.current = now - subElapsed * 1000
    pauseStartRef.current = now
    phaseBreathsRef.current = completedCycles
    phasesCompletedRef.current = phasesCompletedRef.current.slice(0, targetIndex)
    // Samples are not timestamped, so retaining them would include observations
    // from after the rewind point. Completed earlier phase records remain intact.
    coherenceSamplesRef.current = []

    setState({
      phase: targetSub.sub,
      progress: subElapsed / targetSub.plannedSec,
      elapsedSec: seconds,
      phaseDurationSec: targetSub.plannedSec,
    })
    setMeta((previous) => ({
      ...previous,
      currentPhaseIndex: targetIndex,
      currentPhaseName: targetPhase.name,
      currentPhaseLabel: targetPhase.label_fr,
      totalPhases: phases.length,
      sessionElapsedSec: seconds,
      sessionTotalSec,
      phaseStartSec: targetPhaseStart,
      phaseDurationSec: targetPhase.duration_sec,
      breathsCounted: completedCycles,
      coherence: computeRollingCoherence(),
      phasesCompleted: [...phasesCompletedRef.current],
      running: true,
      paused: true,
      stoppedReason: null,
    }))
    return true
  }, [phases, sessionTotalSec, computeRollingCoherence])

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
      loopRef.current?.(pauseStartRef.current ?? performance.now(), { type: 'stop', reason })
    },
    []
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
    actions: { start, pause, resume, stop, markDizzy, rewindPausedTo },
  }
}
