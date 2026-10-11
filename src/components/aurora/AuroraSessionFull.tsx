'use client'

// MUKTI — G5.3 AURORA Session Full
// Intègre : useAuroraPhase (engine 5 phases) + AuroraCanvas (visuel) + audio + haptic
//           + ProgressRing5Phases + SessionControls + persistence API.
// Remplace AuroraSessionPreview (G5.2). Preview kept for standalone demos.

import { useCallback, useMemo, useState } from 'react'
import AuroraCanvas from './AuroraCanvas'
import PulseOfSafety from './PulseOfSafety'
import ProgressRing5Phases, { phaseLabelShort } from './ProgressRing5Phases'
import SessionControls from './SessionControls'
import { useAuroraSession } from './useAuroraSession'
import { AURORA_VARIANTS, type AuroraVariant } from '@/lib/constants'

export interface AuroraSessionFullProps {
  variant: AuroraVariant
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${String(m).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export default function AuroraSessionFull({ variant }: AuroraSessionFullProps) {
  const meta = AURORA_VARIANTS.find((v) => v.id === variant)!
  const session = useAuroraSession(variant)
  const { engine, voiceEnabled, setVoiceEnabled, powerSwitch, setPowerSwitch, persistError, completedInfo } = session
  const [particlesOn, setParticlesOn] = useState(true)

  // Darkening pour variant sleep (progressif sur la session)
  const darkeningByVariant = useCallback(
    (elapsedPct: number): number => {
      if (variant !== 'sleep') return 0
      return Math.max(0, Math.min(0.55, elapsedPct * 0.6))
    },
    [variant]
  )

  // --- UI ---
  const elapsedPct = engine.meta.sessionTotalSec > 0 ? engine.meta.sessionElapsedSec / engine.meta.sessionTotalSec : 0
  const animating = engine.meta.running && !engine.meta.paused
  const phaseLabel = session.starting
    ? (engine.meta.running ? 'Reprise…' : 'Démarrage…')
    : session.saving
      ? 'Enregistrement…'
      : engine.meta.paused
        ? 'En pause'
        : engine.meta.running
          ? phaseLabelShort(engine.meta.currentPhaseName as Parameters<typeof phaseLabelShort>[0])
          : engine.meta.stoppedReason === 'glide_out_complete'
            ? 'Session terminée'
            : engine.meta.stoppedReason ? 'Session arrêtée' : 'Prêt·e ?'
  const phaseElapsedSec = Math.max(0, engine.meta.sessionElapsedSec - engine.meta.phaseStartSec)
  const phaseRemainingSec = Math.max(0, engine.meta.phaseDurationSec - phaseElapsedSec)
  const sessionRemainingSec = Math.max(0, engine.meta.sessionTotalSec - engine.meta.sessionElapsedSec)

  const coherenceDisplay = useMemo(() => {
    const score = Math.round(engine.meta.coherence * 100)
    return `${score}%`
  }, [engine.meta.coherence])

  return (
    <div className="relative h-screen w-full">
      <AuroraCanvas
        breathState={engine.state}
        color={meta.color}
        particlesEnabled={particlesOn}
        animationEnabled={animating}
        darkening={darkeningByVariant(elapsedPct)}
      />

      {animating && <PulseOfSafety breathPhase={engine.state.phase} color={meta.color} />}

      {/* Ring + labels */}
      <div className="pointer-events-none absolute left-1/2 top-24 z-20 flex -translate-x-1/2 flex-col items-center">
        <ProgressRing5Phases
          variant={variant}
          currentPhaseIndex={engine.meta.currentPhaseIndex}
          sessionElapsedSec={engine.meta.sessionElapsedSec}
          sessionTotalSec={engine.meta.sessionTotalSec}
          color={meta.color}
          size={160}
        />
        <div className="mt-3 text-center">
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/50">
            Phase {engine.meta.currentPhaseIndex + 1}/5
          </div>
          <div role="status" className="mt-1 text-xl font-light" style={{ color: meta.color }}>
            {phaseLabel}
          </div>
          {engine.meta.running && (
            <div className="mt-0.5 text-[11px] text-white/50">
              Reste {formatTime(phaseRemainingSec)} / Session {formatTime(sessionRemainingSec)}
            </div>
          )}
        </div>
      </div>

      {/* Indicateur souffle central bas + cohérence */}
      {animating && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
          <div
            className="rounded-full border border-white/15 bg-black/30 px-6 py-2.5 backdrop-blur-xl"
            style={{ boxShadow: `0 0 30px ${meta.color}40` }}
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">Souffle</div>
            <div
              className="mt-0.5 text-base font-light transition-colors duration-300"
              style={{ color: meta.color }}
            >
              {engine.state.phase === 'inspire'
                ? 'Inspire'
                : engine.state.phase === 'expire'
                  ? 'Expire'
                  : engine.state.phase === 'hold'
                    ? 'Pause'
                    : '—'}
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            Régularité du guidage {coherenceDisplay} · {engine.meta.breathsCounted} cycle{engine.meta.breathsCounted > 1 ? 's' : ''} guidé{engine.meta.breathsCounted > 1 ? 's' : ''}
          </div>
        </div>
      )}

      {engine.meta.paused && (
        <p className="absolute bottom-36 left-0 right-0 z-20 px-6 text-center text-sm text-white/80">
          Respire naturellement. Reprends quand tu le souhaites.
        </p>
      )}

      {/* Feedback final si session complétée */}
      {completedInfo && !engine.meta.running && (
        <div className="pointer-events-none absolute bottom-36 left-1/2 z-20 -translate-x-1/2 text-center">
          <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.3em] text-white/60">Niveau</div>
            <div className="mt-0.5 text-lg font-light capitalize" style={{ color: meta.color }}>
              {completedInfo.level ?? 'Aucun niveau atteint'}
            </div>
            <div className="text-xs text-white/60">
              Streak {completedInfo.streak} jour{completedInfo.streak > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Persist error banner */}
      {persistError && (
        <div role="alert" className="absolute top-24 left-1/2 z-30 -translate-x-1/2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200 backdrop-blur">
          {persistError}
        </div>
      )}

      {/* Particles toggle (en haut à droite, petit) */}
      <button
        type="button"
        onClick={() => setParticlesOn((p) => !p)}
        className="absolute right-5 top-24 z-20 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/60 backdrop-blur transition-colors hover:bg-white/[0.08]"
        aria-label={particlesOn ? 'Masquer les particules' : 'Afficher les particules'}
        aria-pressed={particlesOn}
      >
        {particlesOn ? 'Particules on' : 'Particules off'}
      </button>

      <SessionControls
        running={engine.meta.running}
        paused={engine.meta.paused}
        accentColor={meta.color}
        voiceEnabled={voiceEnabled}
        onVoiceToggle={setVoiceEnabled}
        powerSwitch={powerSwitch}
        onPowerSwitchChange={setPowerSwitch}
        onStart={() => void session.start()}
        starting={session.starting}
        disabled={session.starting || session.saving}
        onPause={session.pause}
        onResume={() => void session.resume()}
        onStop={() => session.stop()}
        onDizzy={() => session.stop('dizzy')}
      />
    </div>
  )
}
