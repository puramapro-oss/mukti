'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { auroraRequest } from '@/lib/aurora-session-api'
import { createNatureSoundEngine, type NatureSoundHandle } from '@/lib/nature-sounds'
import type { NatureSound, ReprogCategory } from '@/lib/constants'
import { speakAffirmation } from './nightPlayerHelpers'

interface AffirmationItem {
  id: string
  text_fr: string
  text_en: string | null
  source: 'purama' | 'user' | 'community'
}
interface Options {
  category: ReprogCategory
  natureSound: NatureSound
  voiceEnabled: boolean
  rampEnabled: boolean
}
type Status = 'idle' | 'starting' | 'running' | 'saving'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isAffirmation(value: unknown): value is AffirmationItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && UUID.test(item.id.replace(/^custom-/, '')) &&
    typeof item.text_fr === 'string' && item.text_fr.trim().length > 0 &&
    (item.text_en === null || typeof item.text_en === 'string') &&
    typeof item.source === 'string' && ['purama', 'user', 'community'].includes(item.source)
}
function attempt(action: () => void): boolean {
  try { action(); return true } catch { return false }
}

/** Session ownership is synchronous; asynchronous replies cannot resurrect an old player. */
export function useNightPlayerSession({ category, natureSound, voiceEnabled, rampEnabled }: Options) {
  const [status, setStatus] = useState<Status>('idle')
  const [affirmations, setAffirmations] = useState<AffirmationItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playedCount, setPlayedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const statusRef = useRef<Status>('idle')
  const mounted = useRef(false)
  const generation = useRef(0)
  const requestRef = useRef<AbortController | null>(null)
  const natureRef = useRef<NatureSoundHandle | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionRef = useRef<string | null>(null)
  const indexRef = useRef(0)
  const playedRef = useRef(new Set<string>())

  const clearOutputs = useCallback(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current)
    timerRef.current = null
    attempt(() => window.speechSynthesis?.cancel())
    if (!attempt(() => natureRef.current?.stop())) {
      attempt(() => natureRef.current?.dispose())
      natureRef.current = null
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current += 1
      statusRef.current = 'idle'
      requestRef.current?.abort()
      requestRef.current = null
      if (timerRef.current !== null) clearInterval(timerRef.current)
      timerRef.current = null
      attempt(() => window.speechSynthesis?.cancel())
      attempt(() => natureRef.current?.dispose())
      natureRef.current = null
    }
  }, [])

  const cue = useCallback((item: AffirmationItem) => {
    if (!attempt(() => speakAffirmation(item, voiceEnabled, 0.6)) && mounted.current) {
      setError('Guidage vocal indisponible. Tu peux arrêter la séance à tout moment.')
    }
  }, [voiceEnabled])

  useEffect(() => {
    if (status !== 'running' || affirmations.length === 0) return
    const ticket = generation.current
    const interval = setInterval(() => {
      if (!mounted.current || statusRef.current !== 'running' || ticket !== generation.current) return
      const next = (indexRef.current + 1) % affirmations.length
      indexRef.current = next
      const item = affirmations[next]
      playedRef.current.add(item.id.replace(/^custom-/, ''))
      setCurrentIndex(next)
      setPlayedCount(playedRef.current.size)
      cue(item)
    }, 12_000)
    timerRef.current = interval
    return () => {
      clearInterval(interval)
      if (timerRef.current === interval) timerRef.current = null
    }
  }, [status, affirmations, cue])

  const cancelStart = useCallback(() => {
    if (statusRef.current !== 'starting') return
    generation.current += 1
    statusRef.current = 'idle'
    requestRef.current?.abort()
    requestRef.current = null
    clearOutputs()
    setStatus('idle')
    setError(null)
  }, [clearOutputs])

  const startSession = useCallback(async () => {
    if (!mounted.current || statusRef.current !== 'idle') return
    statusRef.current = 'starting'
    const ticket = ++generation.current
    const controller = new AbortController()
    requestRef.current = controller
    setStatus('starting')
    setError(null)
    sessionRef.current = null
    try {
      // Create a silent context during the user action. No audio before valid data.
      if (!natureRef.current) natureRef.current = createNatureSoundEngine()
      const data = await auroraRequest('/api/reprogramming/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'night', category, nature_sound: natureSound,
          volume_profile: rampEnabled ? 'adaptive' : 'fixed', voice_guidance: voiceEnabled }),
      }, controller)
      if (!mounted.current || ticket !== generation.current) return
      if (typeof data.session_id !== 'string' || !UUID.test(data.session_id) ||
          !Array.isArray(data.affirmations) || data.affirmations.length === 0 ||
          !data.affirmations.every(isAffirmation)) {
        throw new Error('Invalid night session')
      }
      natureRef.current.setSound(natureSound)
      natureRef.current.setVolume(0.55)
      natureRef.current.start()
      sessionRef.current = data.session_id
      indexRef.current = 0
      playedRef.current = new Set([data.affirmations[0].id.replace(/^custom-/, '')])
      setAffirmations(data.affirmations)
      setCurrentIndex(0)
      setPlayedCount(playedRef.current.size)
      statusRef.current = 'running'
      setStatus('running')
      cue(data.affirmations[0])
    } catch {
      if (!mounted.current || ticket !== generation.current) return
      clearOutputs()
      statusRef.current = 'idle'
      setStatus('idle')
      setError('Démarrage non confirmé. Vérifie la connexion puis réessaie.')
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [category, natureSound, rampEnabled, voiceEnabled, cue, clearOutputs])

  const stopSession = useCallback(async () => {
    if (!mounted.current || statusRef.current !== 'running') return
    // Lock before any await or state update: repeated clicks share one termination.
    statusRef.current = 'saving'
    const ticket = ++generation.current
    setStatus('saving')
    clearOutputs()
    const controller = new AbortController()
    requestRef.current = controller
    const sessionId = sessionRef.current
    sessionRef.current = null
    try {
      if (!sessionId) throw new Error('Missing session')
      await auroraRequest('/api/reprogramming/end', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, affirmations_played: Array.from(playedRef.current) }),
      }, controller)
      if (mounted.current && ticket === generation.current) {
        toast.success('Séance terminée et enregistrement confirmé.', { duration: 4000 })
      }
    } catch {
      if (mounted.current && ticket === generation.current) {
        setError('Séance arrêtée. Enregistrement non confirmé : vérifie ton historique avant de réessayer.')
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      if (mounted.current && ticket === generation.current) {
        statusRef.current = 'idle'
        setStatus('idle')
      }
    }
  }, [clearOutputs])

  const setVolume = useCallback((volume: number) => {
    if (statusRef.current === 'running') {
      attempt(() => natureRef.current?.setVolume(volume))
    }
  }, [])

  return { status, running: status === 'running', affirmations, currentIndex, playedCount,
    error, startSession, stopSession, cancelStart, setVolume }
}
