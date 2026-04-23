'use client'

// MUKTI — G5.3 SessionControls
// Panneau de contrôle unifié : Start/Pause/Resume/Stop + Dizzy + Voice toggle + Power switch.
// Affiché en bas de l'écran session. Voice OFF par défaut (décision Tissma G5.1).

import { Play, Pause, Square, AlertTriangle, Volume2, VolumeX } from 'lucide-react'
import { AURORA_POWER_SWITCHES, type AuroraPowerSwitch } from '@/lib/constants'

export interface SessionControlsProps {
  running: boolean
  paused: boolean
  accentColor: string
  voiceEnabled: boolean
  onVoiceToggle: (next: boolean) => void
  powerSwitch: AuroraPowerSwitch
  onPowerSwitchChange: (next: AuroraPowerSwitch) => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onDizzy: () => void
  disabled?: boolean
}

export default function SessionControls({
  running,
  paused,
  accentColor,
  voiceEnabled,
  onVoiceToggle,
  powerSwitch,
  onPowerSwitchChange,
  onStart,
  onPause,
  onResume,
  onStop,
  onDizzy,
  disabled,
}: SessionControlsProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-3 px-5 pb-10">
      {/* Ligne 1 : boutons principaux */}
      <div className="flex items-center gap-3">
        {!running ? (
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className="group flex items-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
              boxShadow: `0 0 30px ${accentColor}60`,
            }}
            aria-label="Démarrer la session"
          >
            <Play className="h-4 w-4" />
            <span>Démarrer</span>
          </button>
        ) : paused ? (
          <button
            type="button"
            onClick={onResume}
            className="flex items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.08] px-5 py-3 text-sm font-medium text-white backdrop-blur-xl transition-all hover:bg-white/[0.16] active:scale-95"
            aria-label="Reprendre la session"
          >
            <Play className="h-4 w-4" />
            <span>Reprendre</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-3 text-xs uppercase tracking-widest text-white/80 backdrop-blur-xl transition-colors hover:bg-white/[0.12]"
            aria-label="Mettre en pause"
          >
            <Pause className="h-3.5 w-3.5" />
            <span>Pause</span>
          </button>
        )}

        {running && (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-widest text-white/80 backdrop-blur-xl transition-colors hover:bg-white/[0.1]"
            aria-label="Arrêter la session"
          >
            <Square className="h-3.5 w-3.5" />
            <span>Arrêt</span>
          </button>
        )}

        {running && (
          <button
            type="button"
            onClick={onDizzy}
            className="flex items-center gap-2 rounded-full border px-4 py-3 text-xs uppercase tracking-widest backdrop-blur-xl transition-colors hover:bg-white/[0.1]"
            style={{ borderColor: '#F59E0B55', color: '#F59E0B', background: '#F59E0B10' }}
            aria-label="Je ressens des vertiges — stop sécurité"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Vertiges</span>
          </button>
        )}
      </div>

      {/* Ligne 2 : toggles (voix + power switch) — discrets */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
        {/* Voice toggle */}
        <button
          type="button"
          onClick={() => onVoiceToggle(!voiceEnabled)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur transition-colors ${
            voiceEnabled ? 'border-white/30 bg-white/[0.08] text-white' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
          }`}
          aria-label={voiceEnabled ? 'Désactiver le guidage vocal' : 'Activer le guidage vocal'}
        >
          {voiceEnabled ? (
            <Volume2 className="h-3 w-3" />
          ) : (
            <VolumeX className="h-3 w-3" />
          )}
          <span>Voix</span>
        </button>

        {/* Power switch selector */}
        <div className="flex items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.02] backdrop-blur">
          {AURORA_POWER_SWITCHES.map((ps) => {
            const selected = powerSwitch === ps.id
            return (
              <button
                key={ps.id}
                type="button"
                onClick={() => onPowerSwitchChange(ps.id)}
                className={`px-3 py-1.5 transition-colors ${
                  selected ? 'bg-white/[0.12] text-white' : 'text-white/60 hover:bg-white/[0.05]'
                }`}
                aria-label={`Power switch ${ps.name} — ${ps.description_fr}`}
                title={ps.description_fr}
              >
                {ps.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
