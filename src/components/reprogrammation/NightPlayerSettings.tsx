'use client'

// MUKTI — G5.4 NightPlayer Settings Panel
// Extrait de NightPlayer.tsx pour respecter max-lines

import { useState } from 'react'
import { Volume2, VolumeX, ChevronDown } from 'lucide-react'
import { REPROG_CATEGORIES, NATURE_SOUNDS, type ReprogCategory, type NatureSound } from '@/lib/constants'

interface NightPlayerSettingsProps {
  category: ReprogCategory
  setCategory: (c: ReprogCategory) => void
  natureSound: NatureSound
  setNatureSound: (s: NatureSound) => void
  voiceEnabled: boolean
  setVoiceEnabled: (v: boolean) => void
  rampEnabled: boolean
  setRampEnabled: (v: boolean) => void
}

export default function NightPlayerSettings({
  category,
  setCategory,
  natureSound,
  setNatureSound,
  voiceEnabled,
  setVoiceEnabled,
  rampEnabled,
  setRampEnabled,
}: NightPlayerSettingsProps) {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
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

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] uppercase tracking-[0.2em]">
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
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

            <button
              type="button"
              onClick={() => setRampEnabled(!rampEnabled)}
              className={`rounded-full border px-3 py-1.5 backdrop-blur transition-colors ${
                rampEnabled
                  ? 'border-white/30 bg-white/[0.12] text-white'
                  : 'border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]'
              }`}
              aria-label="Ramp volume 30 minutes"
            >
              Ramp 30min {rampEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
