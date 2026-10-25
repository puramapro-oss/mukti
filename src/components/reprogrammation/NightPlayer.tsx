'use client'

// MUKTI — G5.4 NightPlayer
// Mode Nuit : affirmations lentes + son nature synthétisé + volume ramp 30min linéaire
// + user-controlled début/fin. SpeechSynthesis opt-in OFF par défaut.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square, Moon } from 'lucide-react'
import { toast } from 'sonner'
import { createNatureSoundEngine, type NatureSoundHandle } from '@/lib/nature-sounds'
import { REPROG_CATEGORIES, type NatureSound, type ReprogCategory } from '@/lib/constants'
import NightPlayerSettings from './NightPlayerSettings'
import { useNightPlayerVolume } from './useNightPlayerVolume'
import { speakAffirmation } from './nightPlayerHelpers'
import NightPlayerRampProgress from './NightPlayerRampProgress'

interface AffirmationItem {
  id: string
  text_fr: string
  text_en: string | null
  source: 'purama' | 'user' | 'community'
}

export interface NightPlayerProps {
  initialCategory?: ReprogCategory
  initialNatureSound?: NatureSound
}

// Temps entre 2 affirmations (lent en mode nuit = 12s)
const AFFIRMATION_INTERVAL_SEC = 12
// Volume audio affirmations vocales (si voice_guidance ON)
const VOICE_VOLUME = 0.6

export default function NightPlayer({
  initialCategory = 'sommeil-reparateur',
  initialNatureSound = 'ocean',
}: NightPlayerProps) {
  const [category, setCategory] = useState<ReprogCategory>(initialCategory)
  const [natureSound, setNatureSound] = useState<NatureSound>(initialNatureSound)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [rampEnabled, setRampEnabled] = useState(true)

  const [running, setRunning] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [affirmations, setAffirmations] = useState<AffirmationItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const natureRef = useRef<NatureSoundHandle | null>(null)
  const affirmationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playedIdsRef = useRef<Set<string>>(new Set())
  const indexRef = useRef(0)
  const [playedCount, setPlayedCount] = useState(0)
  const stopSessionRef = useRef<() => Promise<void>>(async () => undefined)

  const { volumePct, rampProgress, rampRemainingSec } = useNightPlayerVolume({
    running,
    rampEnabled,
    onVolumeChange: useCallback((vol: number) => natureRef.current?.setVolume(vol), []),
    onAutoStop: useCallback(async () => {
      await stopSessionRef.current()
    }, []),
  })

  const catMeta = useMemo(() => REPROG_CATEGORIES.find((c) => c.id === category)!, [category])
  const currentAffirmation = affirmations[currentIndex]

  // --- Lifecycle nature engine ---
  const ensureNature = useCallback(() => {
    if (!natureRef.current) natureRef.current = createNatureSoundEngine()
  }, [])

  useEffect(() => {
    return () => {
      natureRef.current?.dispose()
      if (affirmationTimerRef.current !== null) clearInterval(affirmationTimerRef.current)
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    }
  }, [])

  // --- Affirmation rotation ---
  useEffect(() => {
    if (!running || affirmations.length === 0) return
    const interval = setInterval(() => {
      const next = (indexRef.current + 1) % affirmations.length
      indexRef.current = next
      const a = affirmations[next]
      if (a) {
        playedIdsRef.current.add(a.id.replace(/^custom-/, ''))
        setPlayedCount(playedIdsRef.current.size)
      }
      speakAffirmation(a, voiceEnabled, VOICE_VOLUME)
      setCurrentIndex(next)
    }, AFFIRMATION_INTERVAL_SEC * 1000)
    affirmationTimerRef.current = interval
    return () => clearInterval(interval)
  }, [running, affirmations, voiceEnabled])

  // --- Session actions ---
  async function startSession() {
    setError(null)
    ensureNature()
    try {
      const resp = await fetch('/api/reprogramming/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'night',
          category,
          nature_sound: natureSound,
          volume_profile: rampEnabled ? 'adaptive' : 'fixed',
          voice_guidance: voiceEnabled,
        }),
      })
      if (!resp.ok) {
        const { error } = await resp.json().catch(() => ({ error: null }))
        setError(error ?? 'Impossible de démarrer la session.')
        return
      }
      const data = (await resp.json()) as {
        ok: boolean
        session_id: string
        affirmations: AffirmationItem[]
      }
      if (!data.affirmations?.length) {
        setError('Aucune affirmation disponible — réessaie plus tard.')
        return
      }
      setSessionId(data.session_id)
      setAffirmations(data.affirmations)
      setCurrentIndex(0)
      indexRef.current = 0
      playedIdsRef.current = new Set([data.affirmations[0].id.replace(/^custom-/, '')])
      setPlayedCount(1)
      setRunning(true)

      // Démarre son nature
      natureRef.current?.setSound(natureSound)
      natureRef.current?.start()
      natureRef.current?.setVolume(0.55)

      speakAffirmation(data.affirmations[0], voiceEnabled, VOICE_VOLUME)
    } catch {
      setError('Connexion perdue — réessaie.')
    }
  }

  async function stopSession() {
    if (!running) return
    setRunning(false)
    if (affirmationTimerRef.current !== null) clearInterval(affirmationTimerRef.current)
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    natureRef.current?.stop()

    if (!sessionId) return
    try {
      await fetch('/api/reprogramming/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          affirmations_played: Array.from(playedIdsRef.current),
        }),
      })
      toast.success('Bonne nuit. Ce que tu as posé prend racine. 🌙', { duration: 4000 })
    } catch {
      /* session locale déjà vécue, pas de message erreur alarmiste */
    }
  }

  // Expose stopSession à tick() via ref (évite stale closure RAF loop)
  useEffect(() => {
    stopSessionRef.current = stopSession
  })

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at center, ${catMeta.color}12, #05050a 70%)`,
      }}
    >
      {/* Dégradé lune subtil haut */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48"
        style={{
          background: `linear-gradient(180deg, ${catMeta.color}18, transparent)`,
        }}
      />

      {/* Header titre + category glyph */}
      <div className="z-10 flex flex-col items-center pt-16 text-center">
        <Moon className="h-6 w-6 text-white/50" />
        <h1 className="mt-3 text-xs uppercase tracking-[0.3em] text-white/60">Mode Nuit</h1>
        <div className="mt-3 flex items-center gap-2 text-2xl">
          <span>{catMeta.emoji}</span>
          <span className="font-light text-white/90">{catMeta.name}</span>
        </div>
      </div>

      {/* Affirmation courante (coeur du player) */}
      <div className="z-10 flex w-full max-w-xl flex-col items-center px-8 text-center">
        {running && currentAffirmation ? (
          <p
            key={currentAffirmation.id}
            className="text-2xl font-light leading-relaxed text-white/95 sm:text-3xl"
            style={{
              animation: 'mukti-night-affirmation-in 1.6s ease-out',
              textShadow: `0 0 30px ${catMeta.color}66`,
            }}
          >
            {currentAffirmation.text_fr}
          </p>
        ) : (
          <p className="text-base italic text-white/50">
            Choisis une catégorie et un son. L&apos;app te guide en douceur.
          </p>
        )}

        {running && (
          <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
            <span>Affirmation {currentIndex + 1} / {affirmations.length}</span>
            <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden />
            <span>{playedCount} lue{playedCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Settings + controls bottom */}
      <div className="z-10 w-full max-w-xl px-6 pb-10">
        {/* Barre progression ramp */}
        {running && rampEnabled && (
          <NightPlayerRampProgress
            volumePct={volumePct}
            rampProgress={rampProgress}
            rampRemainingSec={rampRemainingSec}
            catMetaColor={catMeta.color}
          />
        )}

        {/* Settings expandable (avant démarrage OU accessible via chevron) */}
        {!running && (
          <NightPlayerSettings
            category={category}
            setCategory={setCategory}
            natureSound={natureSound}
            setNatureSound={setNatureSound}
            voiceEnabled={voiceEnabled}
            setVoiceEnabled={setVoiceEnabled}
            rampEnabled={rampEnabled}
            setRampEnabled={setRampEnabled}
          />
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {/* Controls principaux */}
        <div className="mt-6 flex items-center justify-center gap-3">
          {!running ? (
            <button
              type="button"
              onClick={startSession}
              className="group flex items-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.color}bb)`,
                boxShadow: `0 0 30px ${catMeta.color}60`,
              }}
              aria-label="Démarrer la session nuit"
            >
              <Play className="h-4 w-4" />
              <span>Démarrer</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopSession}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-sm text-white/80 backdrop-blur-xl transition-colors hover:bg-white/[0.12]"
              aria-label="Terminer la session"
            >
              <Square className="h-3.5 w-3.5" />
              <span>Terminer</span>
            </button>
          )}
        </div>

        {running && (
          <p className="mt-4 text-center text-[10px] uppercase tracking-[0.25em] text-white/40">
            Appuie sur Terminer quand tu veux. Tu choisis le moment.
          </p>
        )}
      </div>
    </div>
  )
}
