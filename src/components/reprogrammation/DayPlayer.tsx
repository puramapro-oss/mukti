'use client'

// MUKTI — G5.5 DayPlayer
// Mode Journée : affirmations rythmées (8s) + son nature opt-in silencieux par défaut
// + volume fixe user-controlled + SpeechSynthesis éveillante (rate 0.95 pitch 1.0) opt-in OFF.
// Pas de ramp auto, pas d'auto-stop — user ferme quand il veut.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square, Sun, Volume2, VolumeX, ChevronDown, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { createNatureSoundEngine, type NatureSoundHandle } from '@/lib/nature-sounds'
import {
  NATURE_SOUNDS,
  REPROG_CATEGORIES,
  type NatureSound,
  type ReprogCategory,
} from '@/lib/constants'

interface AffirmationItem {
  id: string
  text_fr: string
  text_en: string | null
  source: 'purama' | 'user' | 'community'
}

export interface DayPlayerProps {
  initialCategory?: ReprogCategory
  initialNatureSound?: NatureSound
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${String(m).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

// Intervalle plus court que la nuit (8s) — journée = rythme éveillé
const AFFIRMATION_INTERVAL_SEC = 8
// Volume fixe pendant la session (user ajustable via OS)
const NATURE_FIXED_VOLUME = 0.38
const VOICE_VOLUME = 0.7

export default function DayPlayer({
  initialCategory = 'confiance',
  initialNatureSound = 'silence',
}: DayPlayerProps) {
  const [category, setCategory] = useState<ReprogCategory>(initialCategory)
  const [natureSound, setNatureSound] = useState<NatureSound>(initialNatureSound)
  const [voiceEnabled, setVoiceEnabled] = useState(false)

  const [running, setRunning] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [affirmations, setAffirmations] = useState<AffirmationItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const natureRef = useRef<NatureSoundHandle | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTsRef = useRef<number>(0)
  const affirmationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playedIdsRef = useRef<Set<string>>(new Set())

  const catMeta = useMemo(() => REPROG_CATEGORIES.find((c) => c.id === category)!, [category])
  const currentAffirmation = affirmations[currentIndex]

  // --- Lifecycle nature engine ---
  const ensureNature = useCallback(() => {
    if (!natureRef.current) natureRef.current = createNatureSoundEngine()
  }, [])

  useEffect(() => {
    return () => {
      natureRef.current?.dispose()
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (affirmationTimerRef.current !== null) clearInterval(affirmationTimerRef.current)
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    }
  }, [])

  // --- Loop elapsed tick (pas de ramp journée) ---
  const tick = useCallback(() => {
    if (!running) return
    const elapsed = (performance.now() - startTsRef.current) / 1000
    setElapsedSec(elapsed)
    rafRef.current = requestAnimationFrame(tick)
  }, [running])

  useEffect(() => {
    if (running) {
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [running, tick])

  // --- Affirmation rotation ---
  useEffect(() => {
    if (!running || affirmations.length === 0) return
    const interval = setInterval(() => {
      setCurrentIndex((i) => {
        const next = (i + 1) % affirmations.length
        const a = affirmations[next]
        if (a) playedIdsRef.current.add(a.id.replace(/^custom-/, ''))
        speakIfEnabled(a)
        return next
      })
    }, AFFIRMATION_INTERVAL_SEC * 1000)
    affirmationTimerRef.current = interval
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, affirmations])

  function speakIfEnabled(a: AffirmationItem | undefined) {
    if (!voiceEnabled || !a || typeof window === 'undefined') return
    if (!window.speechSynthesis) return
    const u = new SpeechSynthesisUtterance(a.text_fr)
    u.lang = 'fr-FR'
    u.rate = 0.95
    u.pitch = 1.0
    u.volume = VOICE_VOLUME
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  // --- Session actions ---
  async function startSession() {
    setError(null)
    ensureNature()
    try {
      const resp = await fetch('/api/reprogramming/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'day',
          category,
          nature_sound: natureSound,
          volume_profile: 'fixed',
          voice_guidance: voiceEnabled,
        }),
      })
      if (!resp.ok) {
        const { error: apiErr } = await resp.json().catch(() => ({ error: null }))
        setError(apiErr ?? 'Impossible de démarrer la session.')
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
      playedIdsRef.current = new Set([data.affirmations[0].id.replace(/^custom-/, '')])
      setRunning(true)
      startTsRef.current = performance.now()
      setShowSettings(false)

      if (natureSound !== 'silence') {
        natureRef.current?.setSound(natureSound)
        natureRef.current?.start()
        natureRef.current?.setVolume(NATURE_FIXED_VOLUME)
      }

      speakIfEnabled(data.affirmations[0])
    } catch {
      setError('Connexion perdue — réessaie.')
    }
  }

  async function stopSession() {
    if (!running) return
    setRunning(false)
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
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
      toast.success(`Bien posé. ${playedIdsRef.current.size} affirmation${playedIdsRef.current.size > 1 ? 's' : ''} reçue${playedIdsRef.current.size > 1 ? 's' : ''}. ☀️`, { duration: 4000 })
    } catch {
      /* session locale déjà vécue, pas de message erreur alarmiste */
    }
  }

  // --- UI ---
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at top, ${catMeta.color}18, #0A0A0F 65%)`,
      }}
    >
      {/* Halo solaire haut */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background: `linear-gradient(180deg, ${catMeta.color}22, transparent)`,
        }}
      />

      {/* Header */}
      <div className="z-10 flex flex-col items-center pt-20 text-center">
        <Sun className="h-6 w-6" style={{ color: catMeta.color }} />
        <h1 className="mt-3 text-xs uppercase tracking-[0.3em] text-white/60">Mode Journée</h1>
        <div className="mt-3 flex items-center gap-2 text-2xl">
          <span>{catMeta.emoji}</span>
          <span className="font-light text-white/90">{catMeta.name}</span>
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/40">
          {catMeta.solfeggio_hz} Hz
        </div>
      </div>

      {/* Affirmation centrale */}
      <div className="z-10 flex w-full max-w-xl flex-col items-center px-8 text-center">
        {running && currentAffirmation ? (
          <p
            key={currentAffirmation.id}
            className="text-2xl font-light leading-relaxed text-white/95 sm:text-3xl"
            style={{
              animation: 'mukti-day-affirmation-in 1.2s ease-out',
              textShadow: `0 0 30px ${catMeta.color}55`,
            }}
          >
            {currentAffirmation.text_fr}
          </p>
        ) : (
          <p className="text-base italic text-white/50">
            Choisis une catégorie. Une pause de 5 à 10 minutes suffit pour poser quelques affirmations.
          </p>
        )}

        {running && (
          <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
            <span>Affirmation {currentIndex + 1} / {affirmations.length}</span>
            <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden />
            <span>{formatTime(elapsedSec)}</span>
            <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden />
            <span>{playedIdsRef.current.size} posée{playedIdsRef.current.size > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Controls bottom */}
      <div className="z-10 w-full max-w-xl px-6 pb-10">
        {/* Settings expandable (avant démarrage) */}
        {!running && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="flex w-full items-center justify-between text-xs uppercase tracking-[0.25em] text-white/70"
              aria-expanded={showSettings}
            >
              <span>Réglages</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showSettings ? 'rotate-180' : ''}`}
              />
            </button>

            {showSettings && (
              <div className="mt-4 space-y-4 text-sm">
                {/* Catégorie */}
                <div>
                  <label className="text-[11px] uppercase tracking-[0.25em] text-white/50">
                    Catégorie
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {REPROG_CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          category === c.id
                            ? 'border-white/30 bg-white/[0.12] text-white'
                            : 'border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="mr-1">{c.emoji}</span>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Son nature */}
                <div>
                  <label className="text-[11px] uppercase tracking-[0.25em] text-white/50">
                    Son nature
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {NATURE_SOUNDS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setNatureSound(s.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          natureSound === s.id
                            ? 'border-white/30 bg-white/[0.12] text-white'
                            : 'border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="mr-1">{s.emoji}</span>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voix toggle */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] uppercase tracking-[0.2em]">
                  <button
                    type="button"
                    onClick={() => setVoiceEnabled((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur transition-colors ${
                      voiceEnabled
                        ? 'border-white/30 bg-white/[0.12] text-white'
                        : 'border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]'
                    }`}
                  >
                    {voiceEnabled ? (
                      <Volume2 className="h-3 w-3" />
                    ) : (
                      <VolumeX className="h-3 w-3" />
                    )}
                    <span>Voix</span>
                  </button>

                  <Link
                    href="/dashboard/subconscient/mes-affirmations"
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-white/60 backdrop-blur transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Mes affirmations</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
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
              aria-label="Démarrer la session journée"
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
            Tu peux continuer à naviguer. L&apos;app tourne en fond — Terminer quand tu veux.
          </p>
        )}
      </div>

      <style jsx>{`
        @keyframes mukti-day-affirmation-in {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
