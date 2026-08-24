'use client'

// MUKTI — G5.5 DayPlayer Settings Panel
// Extrait de DayPlayer.tsx pour respecter max-lines

import { useState } from 'react'
import { Volume2, VolumeX, ChevronDown, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { REPROG_CATEGORIES, NATURE_SOUNDS, type ReprogCategory, type NatureSound } from '@/lib/constants'

interface DayPlayerSettingsProps {
  category: ReprogCategory
  setCategory: (c: ReprogCategory) => void
  natureSound: NatureSound
  setNatureSound: (s: NatureSound) => void
  voiceEnabled: boolean
  setVoiceEnabled: (v: boolean) => void
}

export default function DayPlayerSettings({
  category,
  setCategory,
  natureSound,
  setNatureSound,
  voiceEnabled,
  setVoiceEnabled,
}: DayPlayerSettingsProps) {
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
                  {c.emoji} {c.name}
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
                  {s.emoji} {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs backdrop-blur transition-colors ${
                voiceEnabled
                  ? 'border-white/30 bg-white/[0.12] text-white'
                  : 'border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.06]'
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
  )
}
