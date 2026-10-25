'use client'

// MUKTI — G5.4 NightPlayer
// Mode Nuit : affirmations lentes + son nature synthétisé + volume ramp 30min linéaire
// + user-controlled début/fin. SpeechSynthesis opt-in OFF par défaut.

import { useMemo, useState } from 'react'
import { Play, Square, Moon } from 'lucide-react'
import { REPROG_CATEGORIES, type NatureSound, type ReprogCategory } from '@/lib/constants'
import NightPlayerSettings from './NightPlayerSettings'
import { useNightPlayerVolume } from './useNightPlayerVolume'
import { useNightPlayerSession } from './useNightPlayerSession'
import NightPlayerRampProgress from './NightPlayerRampProgress'

export interface NightPlayerProps {
  initialCategory?: ReprogCategory
  initialNatureSound?: NatureSound
}

export default function NightPlayer({
  initialCategory = 'sommeil-reparateur',
  initialNatureSound = 'ocean',
}: NightPlayerProps) {
  const [category, setCategory] = useState<ReprogCategory>(initialCategory)
  const [natureSound, setNatureSound] = useState<NatureSound>(initialNatureSound)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [rampEnabled, setRampEnabled] = useState(true)

  const { status, running, affirmations, currentIndex, playedCount, error,
    startSession, stopSession, cancelStart, setVolume } = useNightPlayerSession({
    category, natureSound, voiceEnabled, rampEnabled,
  })
  const { volumePct, rampProgress, rampRemainingSec } = useNightPlayerVolume({
    running, rampEnabled, onVolumeChange: setVolume, onAutoStop: stopSession,
  })
  const catMeta = useMemo(() => REPROG_CATEGORIES.find((c) => c.id === category)!, [category])
  const currentAffirmation = affirmations[currentIndex]

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

        {/* Settings remain stable while preparing, playing or saving. */}
        {status === 'idle' && (
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
              disabled={status !== 'idle'}
              className="group flex items-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.color}bb)`,
                boxShadow: `0 0 30px ${catMeta.color}60`,
              }}
              aria-label="Démarrer la session nuit"
            >
              <Play className="h-4 w-4" />
              <span>{status === 'starting' ? 'Préparation…' : status === 'saving' ? 'Enregistrement…' : 'Démarrer'}</span>
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

        {status === 'starting' && (
          <button type="button" onClick={cancelStart} aria-label="Annuler le démarrage"
            className="mt-4 rounded-full border border-white/20 px-5 py-3 text-sm text-white">
            Annuler le démarrage
          </button>
        )}
        {status === 'saving' && (
          <p role="status" className="mt-4 text-center text-sm text-white/70">
            Séance arrêtée. Enregistrement en cours…
          </p>
        )}
        {running && (
          <p className="mt-4 text-center text-[10px] uppercase tracking-[0.25em] text-white/40">
            Appuie sur Terminer quand tu veux. Tu choisis le moment.
          </p>
        )}
      </div>
    </div>
  )
}
