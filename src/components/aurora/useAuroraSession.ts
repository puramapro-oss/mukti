'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createAuroraAudio, type AuroraAudioHandle } from '@/lib/aurora-audio'
import { createAuroraHaptic, type AuroraHapticHandle } from '@/lib/aurora-haptic'
import { auroraRequest } from '@/lib/aurora-session-api'
import type { AuroraVariant, AuroraPowerSwitch, AuroraPhaseName } from '@/lib/constants'
import { useAuroraPhase, type AuroraPhaseMeta, type StoppedReason } from './useAuroraPhase'

const CUES: Record<AuroraPhaseName, string> = {
  armement: 'Armement. Respire doucement.',
  double_sigh: 'Double soupape. Laisse tomber.',
  resonance_core: 'Résonance. Inspire, expire longuement.',
  omega_lock: 'Omega Lock. Maîtrise.',
  glide_out: 'Glide Out. Tu ralentis.',
}
const jsonHeaders = { 'Content-Type': 'application/json' }

export function useAuroraSession(variant: AuroraVariant) {
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [powerSwitch, setPowerSwitch] = useState<AuroraPowerSwitch>('core')
  const [persistError, setPersistError] = useState<string | null>(null)
  const [completedInfo, setCompletedInfo] = useState<{ level: string | null; streak: number } | null>(null)
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

  const silence = useCallback(() => {
    audioRef.current?.stop()
    hapticRef.current?.cancel()
  }, [])

  const finish = useCallback(async (reason: StoppedReason, meta: AuroraPhaseMeta) => {
    activeRef.current = false
    silence()
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
      setCompletedInfo({ level: data.level_reached, streak: data.streak_days })
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
    onPhaseChange: (phase) => { if (voiceEnabled) audioRef.current?.speakPhaseCue(CUES[phase]) },
    onBreathStep: (phase) => { audioRef.current?.setPhase(phase); hapticRef.current?.pulse(phase) },
    onComplete: (meta) => { void finish('glide_out_complete', meta) },
    onStop: (reason, meta) => { void finish(reason, meta) },
  })

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
    sessionIdRef.current = null
    try {
      audioRef.current ??= createAuroraAudio()
      hapticRef.current ??= createAuroraHaptic()
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
  }, [engine.actions, powerSwitch, silence, variant, voiceEnabled])

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
    try {
      await audioRef.current?.start()
      if (!mountedRef.current || ticket !== generationRef.current) return
      engine.actions.resume()
      audioRef.current?.setPhase(engine.state.phase)
      hapticRef.current?.pulse(engine.state.phase)
    } catch {
      if (mountedRef.current && ticket === generationRef.current) {
        silence()
        setPersistError('Audio indisponible. La session reste en pause.')
      }
    } finally {
      if (mountedRef.current && ticket === generationRef.current) {
        busyRef.current = false
        setStarting(false)
      }
    }
  }, [engine.actions, engine.meta.paused, engine.meta.running, engine.state.phase, silence])

  const stop = useCallback((reason: StoppedReason = 'user_stop') => {
    if (!activeRef.current && !busyRef.current) return
    activeRef.current = false
    cancelPending()
    silence()
    engine.actions.stop(reason)
  }, [cancelPending, engine.actions, silence])

  useEffect(() => { audioRef.current?.setVoiceGuidance(voiceEnabled) }, [voiceEnabled])

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
    persistError, completedInfo, starting, saving, start, pause, resume, stop }
}
