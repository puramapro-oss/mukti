'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createAuroraAudio, type AuroraAudioHandle, type AuroraRitualMix } from '@/lib/aurora-audio'
import { createAuroraHaptic, type AuroraHapticHandle } from '@/lib/aurora-haptic'
import { auroraRequest } from '@/lib/aurora-session-api'
import { ritualCueAt, type RitualPlan } from '@/lib/aurora-ritual'
import { AURORA_PHASES, type AuroraVariant, type AuroraPowerSwitch, type AuroraPhaseName } from '@/lib/constants'
import { useAuroraPhase, type AuroraPhaseMeta, type StoppedReason } from './useAuroraPhase'

const CUES: Record<AuroraPhaseName, string> = {
  armement: 'Installation. Respire sans forcer.',
  double_sigh: 'Double soupape. Laisse tomber.',
  resonance_core: 'Résonance. Inspire, expire longuement.',
  omega_lock: 'Poursuis à ton rythme. Tu peux arrêter.',
  glide_out: 'Glide Out. Tu ralentis.',
}
const jsonHeaders = { 'Content-Type': 'application/json' }

export function useAuroraSession(variant: AuroraVariant, ritualPlan: RitualPlan | null = null) {
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [ritualMix, setRitualMix] = useState<AuroraRitualMix>({ voice: 0.8, music: 0.3, tone: 0 })
  const [ritualCompletion, setRitualCompletion] = useState<'completed' | 'stopped' | null>(null)
  const [powerSwitch, setPowerSwitch] = useState<AuroraPowerSwitch>('soft')
  const [persistError, setPersistError] = useState<string | null>(null)
  const [completedInfo, setCompletedInfo] = useState<{ level: string | null; streak: number; sessionId: string } | null>(null)
  const [starting, setStarting] = useState(false)
  const [saving, setSaving] = useState(false)
  const audioRef = useRef<AuroraAudioHandle | null>(null)
  const hapticRef = useRef<AuroraHapticHandle | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const startRequestRef = useRef<AbortController | null>(null)
  const completeRequestRef = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const activeRef = useRef(false)
  const savingRef = useRef(false)
  const mountedRef = useRef(false)
  const generationRef = useRef(0)
  // Capture the approved plan for this run; editing a draft cannot rewrite a session.
  const activeRitualRef = useRef<RitualPlan | null>(null)
  const spokenCueRef = useRef<string | null>(null)

  const silence = useCallback(() => {
    audioRef.current?.stop()
    hapticRef.current?.cancel()
  }, [])

  const createAudio = useCallback(() => createAuroraAudio({
    onVoiceError: () => {
      if (!mountedRef.current || !activeRef.current || !activeRitualRef.current) return
      setVoiceEnabled(false)
      setPersistError('La voix a été interrompue. Le texte reste disponible et la séance continue. Tu peux mettre en pause pour réessayer.')
    },
  }), [])

  const finish = useCallback(async (reason: StoppedReason, meta: AuroraPhaseMeta) => {
    activeRef.current = false
    silence()
    if (activeRitualRef.current) {
      // The existing API stores breathing metrics, not goals. Never send invented
      // coherence, streaks, rewards or completion of the person's planned action.
      sessionIdRef.current = null
      if (mountedRef.current) setRitualCompletion(reason === 'glide_out_complete' ? 'completed' : 'stopped')
      return
    }
    const id = sessionIdRef.current
    sessionIdRef.current = null
    if (!id || savingRef.current) return
    const ticket = generationRef.current
    const controller = new AbortController()
    completeRequestRef.current = controller
    savingRef.current = true
    setSaving(true)
    try {
      const data = await auroraRequest(`/api/aurora/session/${encodeURIComponent(id)}/complete`, {
        method: 'PATCH', headers: jsonHeaders,
        body: JSON.stringify({ phases_completed: meta.phasesCompleted, coherence_score: meta.coherence,
          stopped_reason: reason, total_duration_sec: meta.sessionElapsedSec }),
      }, controller)
      if (typeof data.streak_days !== 'number' || !Number.isInteger(data.streak_days) || data.streak_days < 0 ||
          !(data.level_reached === null || typeof data.level_reached === 'string')) {
        throw new Error('Réponse du serveur invalide.')
      }
      if (!mountedRef.current || ticket !== generationRef.current) return
      setCompletedInfo({ level: data.level_reached, streak: data.streak_days, sessionId: id })
      setPersistError(null)
      if (reason === 'glide_out_complete') toast.success('Session terminée et enregistrée.', { duration: 4000 })
      else toast.info(reason === 'dizzy' ? 'Session arrêtée. Reprends une respiration naturelle.' : 'Session arrêtée et enregistrée.')
    } catch {
      if (mountedRef.current && ticket === generationRef.current) {
        setPersistError('Session arrêtée — enregistrement non confirmé. Vérifie ton historique avant de réessayer.')
      }
    } finally {
      if (completeRequestRef.current === controller) completeRequestRef.current = null
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }, [silence])

  const engine = useAuroraPhase({
    variant, powerSwitch,
    onPhaseChange: (phase) => {
      if (!activeRitualRef.current && voiceEnabled) audioRef.current?.speakPhaseCue(CUES[phase])
    },
    onBreathStep: (phase) => {
      if (!activeRitualRef.current) { audioRef.current?.setPhase(phase); hapticRef.current?.pulse(phase) }
    },
    onComplete: (meta) => { void finish('glide_out_complete', meta) },
    onStop: (reason, meta) => { void finish(reason, meta) },
  })

  const activateRitualAudio = useCallback(async (position: number, isCurrent: () => boolean) => {
    const voiceRequested = voiceEnabled && ritualMix.voice > 0
    const soundRequested = ritualMix.music > 0 || ritualMix.tone > 0
    if (!voiceRequested && !soundRequested) { audioRef.current?.stop(); return }
    audioRef.current ??= createAudio()
    const audio = audioRef.current
    audio.setRitualMix?.(ritualMix)
    const capabilities = audio.getCapabilities?.()
    if ((soundRequested && !capabilities?.audio) || (voiceRequested && !capabilities?.voice)) {
      throw new Error('Une sortie demandée ou la voix française locale est indisponible. Choisis le texte seul ou désactive la voix pour écouter la musique.')
    }
    audio.setVoiceGuidance(voiceRequested)
    audio.setPosition?.(position)
    await audio.prepare()
    if (!isCurrent()) return
    await audio.start()
  }, [createAudio, ritualMix, voiceEnabled])

  const start = useCallback(async () => {
    if (busyRef.current || savingRef.current || activeRef.current || !mountedRef.current) return
    busyRef.current = true
    const ticket = ++generationRef.current
    const controller = new AbortController()
    startRequestRef.current = controller
    const isCurrent = () => mountedRef.current && ticket === generationRef.current
    setStarting(true)
    setPersistError(null)
    setCompletedInfo(null)
    setRitualCompletion(null)
    sessionIdRef.current = null
    activeRitualRef.current = ritualPlan
    spokenCueRef.current = null
    try {
      if (ritualPlan) {
        if (ritualPlan.durationSec !== AURORA_PHASES[variant].reduce((total, phase) => total + phase.duration_sec, 0)) {
          throw new Error('La durée a changé. Prépare à nouveau le texte de ton rituel.')
        }
        await activateRitualAudio(0, isCurrent)
        if (!isCurrent()) return
        activeRef.current = true
        engine.actions.start()
        return
      }
      audioRef.current ??= createAudio()
      hapticRef.current ??= createAuroraHaptic()
      audioRef.current.setRitualMix?.(null)
      audioRef.current.setVoiceGuidance(voiceEnabled)
      // Resume during the user gesture, at zero gain, before the network round trip.
      const prepared = audioRef.current.prepare().then(() => true, () => false)
      const data = await auroraRequest('/api/aurora/session', {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ variant, voice_guidance: voiceEnabled, power_switch: powerSwitch }),
      }, controller)
      if (!isCurrent()) return
      if (typeof data.session_id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.session_id)) {
        throw new Error('Identifiant de session invalide.')
      }
      if (!await prepared) throw new Error('Audio indisponible. Vérifie les autorisations du navigateur puis réessaie.')
      if (!isCurrent()) return
      sessionIdRef.current = data.session_id
      await audioRef.current.start()
      if (!isCurrent()) return
      activeRef.current = true
      engine.actions.start()
    } catch (error) {
      if (isCurrent()) {
        silence()
        setPersistError(controller.signal.aborted ? 'Le serveur ne répond pas. Réessaie.' :
          error instanceof Error ? error.message : 'Impossible de démarrer. Réessaie.')
      }
    } finally {
      if (isCurrent()) {
        busyRef.current = false
        startRequestRef.current = null
        setStarting(false)
      }
    }
  }, [activateRitualAudio, createAudio, engine.actions, powerSwitch, ritualPlan, silence, variant, voiceEnabled])

  const cancelPending = useCallback(() => {
    generationRef.current += 1
    startRequestRef.current?.abort()
    startRequestRef.current = null
    busyRef.current = false
    setStarting(false)
  }, [])

  const pause = useCallback(() => {
    if (!activeRef.current && !busyRef.current) return
    cancelPending()
    silence()
    engine.actions.pause()
  }, [cancelPending, engine.actions, silence])

  const resume = useCallback(async () => {
    if (!engine.meta.running || !engine.meta.paused || busyRef.current) return
    busyRef.current = true
    const ticket = ++generationRef.current
    setStarting(true)
    setPersistError(null)
    try {
      const isCurrent = () => mountedRef.current && ticket === generationRef.current
      const replayFrom = activeRitualRef.current && voiceEnabled && ritualMix.voice > 0
        ? ritualCueAt(activeRitualRef.current, engine.meta.sessionElapsedSec).at : null
      if (activeRitualRef.current) await activateRitualAudio(replayFrom ?? engine.meta.sessionElapsedSec, isCurrent)
      else await audioRef.current?.start()
      if (!mountedRef.current || ticket !== generationRef.current) return
      if (replayFrom !== null) {
        if (!engine.actions.rewindPausedTo(replayFrom)) throw new Error('Impossible de reprendre cette étape. Arrête le rituel puis prépare une nouvelle écoute.')
        spokenCueRef.current = null
      }
      engine.actions.resume()
      if (!activeRitualRef.current) {
        audioRef.current?.setPhase(engine.state.phase)
        hapticRef.current?.pulse(engine.state.phase)
      }
    } catch (error) {
      if (mountedRef.current && ticket === generationRef.current) {
        silence()
        setPersistError(error instanceof Error ? `${error.message} La session reste en pause.` : 'Audio indisponible. La session reste en pause.')
      }
    } finally {
      if (mountedRef.current && ticket === generationRef.current) {
        busyRef.current = false
        setStarting(false)
      }
    }
  }, [activateRitualAudio, engine.actions, engine.meta.paused, engine.meta.running, engine.meta.sessionElapsedSec, engine.state.phase, ritualMix.voice, silence, voiceEnabled])

  const stop = useCallback((reason: StoppedReason = 'user_stop') => {
    if (!activeRef.current && !busyRef.current) return
    activeRef.current = false
    cancelPending()
    silence()
    engine.actions.stop(reason)
  }, [cancelPending, engine.actions, silence])

  useEffect(() => { audioRef.current?.setVoiceGuidance(voiceEnabled) }, [voiceEnabled])

  useEffect(() => {
    const plan = activeRitualRef.current
    if (!plan || !engine.meta.running || engine.meta.paused || !activeRef.current) return
    audioRef.current?.setPosition?.(engine.meta.sessionElapsedSec)
    const cue = ritualCueAt(plan, engine.meta.sessionElapsedSec)
    if (voiceEnabled && ritualMix.voice > 0 && spokenCueRef.current !== cue.id) {
      spokenCueRef.current = cue.id
      audioRef.current?.speakPhaseCue(cue.text)
    }
  }, [engine.meta.paused, engine.meta.running, engine.meta.sessionElapsedSec, ritualMix.voice, voiceEnabled])

  const muteRitual = useCallback(() => {
    if (!activeRitualRef.current) return
    silence()
    setVoiceEnabled(false)
    setRitualMix({ voice: 0, music: 0, tone: 0 })
  }, [silence])

  const replayRitualCue = useCallback(() => {
    const plan = activeRitualRef.current
    if (plan && activeRef.current && !engine.meta.paused && voiceEnabled && ritualMix.voice > 0) {
      const cue = ritualCueAt(plan, engine.meta.sessionElapsedSec)
      engine.actions.pause()
      if (engine.actions.rewindPausedTo(cue.at)) {
        audioRef.current?.setPosition?.(cue.at)
        spokenCueRef.current = cue.id
        audioRef.current?.speakPhaseCue(cue.text)
      }
      engine.actions.resume()
    }
  }, [engine.actions, engine.meta.paused, engine.meta.sessionElapsedSec, ritualMix.voice, voiceEnabled])

  const resetRitualPreparation = useCallback(() => {
    if (busyRef.current || activeRef.current || savingRef.current) return
    activeRitualRef.current = null
    spokenCueRef.current = null
    setRitualCompletion(null)
    setPersistError(null)
    setCompletedInfo(null)
  }, [])

  const pauseRef = useRef(pause)
  useEffect(() => { pauseRef.current = pause }, [pause])
  useEffect(() => {
    mountedRef.current = true
    const onHidden = () => { if (document.hidden) pauseRef.current() }
    const onLeave = () => pauseRef.current()
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onLeave)
    window.addEventListener('blur', onLeave)
    return () => {
      mountedRef.current = false
      activeRef.current = false
      generationRef.current += 1
      startRequestRef.current?.abort()
      completeRequestRef.current?.abort()
      audioRef.current?.dispose()
      hapticRef.current?.cancel()
      audioRef.current = null
      hapticRef.current = null
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onLeave)
      window.removeEventListener('blur', onLeave)
    }
  }, [])

  return { engine, voiceEnabled, setVoiceEnabled, powerSwitch, setPowerSwitch,
    persistError, completedInfo, starting, saving, start, pause, resume, stop,
    ritualMix, setRitualMix, ritualCompletion, muteRitual, replayRitualCue, resetRitualPreparation }
}
