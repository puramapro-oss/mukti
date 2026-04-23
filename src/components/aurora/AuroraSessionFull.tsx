'use client'

// MUKTI — G5.3 AURORA Session Full
// Intègre : useAuroraPhase (engine 5 phases) + AuroraCanvas (visuel) + audio + haptic
//           + ProgressRing5Phases + SessionControls + persistence API.
// Remplace AuroraSessionPreview (G5.2). Preview kept for standalone demos.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuroraCanvas from './AuroraCanvas'
import PulseOfSafety from './PulseOfSafety'
import ProgressRing5Phases, { phaseLabelShort } from './ProgressRing5Phases'
import SessionControls from './SessionControls'
import { useAuroraPhase, type StoppedReason } from './useAuroraPhase'
import { createAuroraAudio, type AuroraAudioHandle } from '@/lib/aurora-audio'
import { createAuroraHaptic, type AuroraHapticHandle } from '@/lib/aurora-haptic'
import { AURORA_VARIANTS, type AuroraVariant, type AuroraPowerSwitch } from '@/lib/constants'
import { toast } from 'sonner'

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
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [powerSwitch, setPowerSwitch] = useState<AuroraPowerSwitch>('core')
  const [particlesOn, setParticlesOn] = useState(true)
  const [persistError, setPersistError] = useState<string | null>(null)
  const [completedInfo, setCompletedInfo] = useState<{ level: string | null; streak: number } | null>(null)

  const sessionIdRef = useRef<string | null>(null)
  const audioRef = useRef<AuroraAudioHandle | null>(null)
  const hapticRef = useRef<AuroraHapticHandle | null>(null)

  // Darkening pour variant sleep (progressif sur la session)
  const darkeningByVariant = useCallback(
    (elapsedPct: number): number => {
      if (variant !== 'sleep') return 0
      return Math.max(0, Math.min(0.55, elapsedPct * 0.6))
    },
    [variant]
  )

  // Lazy init audio + haptic une seule fois
  const ensureEngines = useCallback(() => {
    if (!audioRef.current) audioRef.current = createAuroraAudio()
    if (!hapticRef.current) hapticRef.current = createAuroraHaptic()
  }, [])

  // --- useAuroraPhase handlers ---
  const handlePhaseChange = useCallback(
    (phase: string) => {
      if (voiceEnabled && audioRef.current) {
        const cue =
          phase === 'armement'
            ? 'Armement. Respire doucement.'
            : phase === 'double_sigh'
              ? 'Double soupape. Laisse tomber.'
              : phase === 'resonance_core'
                ? 'Résonance. Inspire, expire longuement.'
                : phase === 'omega_lock'
                  ? 'Omega Lock. Maîtrise.'
                  : phase === 'glide_out'
                    ? 'Glide Out. Tu ralentis.'
                    : ''
        if (cue) audioRef.current.speakPhaseCue(cue)
      }
    },
    [voiceEnabled]
  )

  const handleBreathStep = useCallback((sub: 'inspire' | 'expire' | 'hold' | 'idle') => {
    audioRef.current?.setPhase(sub)
    hapticRef.current?.pulse(sub)
  }, [])

  const handleComplete = useCallback(
    async (m: { phasesCompleted: typeof engine.meta.phasesCompleted; coherence: number; sessionElapsedSec: number }) => {
      audioRef.current?.stop()
      hapticRef.current?.cancel()
      await persistComplete({
        stoppedReason: 'glide_out_complete',
        phases: m.phasesCompleted,
        coherence: m.coherence,
        totalSec: m.sessionElapsedSec,
      })
      toast.success('Session complète — ta fractale est ancrée. ✨', { duration: 4000 })
    },
    // persistComplete défini plus bas (closure stable via sessionIdRef)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleStop = useCallback(
    async (
      reason: StoppedReason,
      m: { phasesCompleted: typeof engine.meta.phasesCompleted; coherence: number; sessionElapsedSec: number }
    ) => {
      audioRef.current?.stop()
      hapticRef.current?.cancel()
      await persistComplete({
        stoppedReason: reason,
        phases: m.phasesCompleted,
        coherence: m.coherence,
        totalSec: m.sessionElapsedSec,
      })
      if (reason === 'dizzy') {
        toast.info('Arrêt sécurité. Repasse en SOFT la prochaine fois. 💙', { duration: 5000 })
      } else {
        toast.info('Session arrêtée. Ce que tu as fait compte.', { duration: 3500 })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const engine = useAuroraPhase({
    variant,
    onPhaseChange: handlePhaseChange,
    onBreathStep: handleBreathStep,
    onComplete: (m) => void handleComplete({ phasesCompleted: m.phasesCompleted, coherence: m.coherence, sessionElapsedSec: m.sessionElapsedSec }),
    onStop: (reason, m) => void handleStop(reason, { phasesCompleted: m.phasesCompleted, coherence: m.coherence, sessionElapsedSec: m.sessionElapsedSec }),
  })

  // Toggle voix pendant la session
  useEffect(() => {
    audioRef.current?.setVoiceGuidance(voiceEnabled)
  }, [voiceEnabled])

  // Cleanup à l'unmount (dispose audio, cancel haptic)
  useEffect(() => {
    return () => {
      audioRef.current?.dispose()
      hapticRef.current?.cancel()
    }
  }, [])

  // --- persistence helpers ---
  async function persistStart(): Promise<boolean> {
    try {
      const resp = await fetch('/api/aurora/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant, voice_guidance: voiceEnabled, power_switch: powerSwitch }),
      })
      if (!resp.ok) {
        const { error } = await resp.json().catch(() => ({ error: null }))
        setPersistError(error ?? 'Impossible de démarrer la session. Réessaie.')
        return false
      }
      const data = (await resp.json()) as { ok: boolean; session_id: string }
      sessionIdRef.current = data.session_id
      setPersistError(null)
      return true
    } catch {
      setPersistError('Connexion perdue — ta session ne sera pas sauvée.')
      return false
    }
  }

  async function persistComplete(input: {
    stoppedReason: StoppedReason
    phases: Array<{ phase: string; duration_sec: number; breaths_counted: number; coherence: number | null }>
    coherence: number
    totalSec: number
  }) {
    const id = sessionIdRef.current
    if (!id) return
    try {
      const resp = await fetch(`/api/aurora/session/${id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phases_completed: input.phases,
          coherence_score: input.coherence,
          stopped_reason: input.stoppedReason,
          total_duration_sec: input.totalSec,
        }),
      })
      if (resp.ok) {
        const data = (await resp.json()) as { ok: boolean; level_reached: string | null; streak_days: number }
        setCompletedInfo({ level: data.level_reached, streak: data.streak_days })
      }
    } catch {
      /* silencieux — l'utilisateur a déjà vécu la session */
    }
  }

  // --- actions ---
  const onStart = useCallback(async () => {
    ensureEngines()
    audioRef.current?.setVoiceGuidance(voiceEnabled)
    audioRef.current?.start()
    const ok = await persistStart()
    if (!ok) return // reste en idle
    engine.actions.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.actions, ensureEngines, voiceEnabled])

  const onStop = useCallback(() => {
    engine.actions.stop('user_stop')
  }, [engine.actions])

  const onDizzy = useCallback(() => {
    engine.actions.markDizzy()
  }, [engine.actions])

  // --- UI ---
  const elapsedPct = engine.meta.sessionTotalSec > 0 ? engine.meta.sessionElapsedSec / engine.meta.sessionTotalSec : 0
  const phaseLabel = engine.meta.running
    ? phaseLabelShort(engine.meta.currentPhaseName as Parameters<typeof phaseLabelShort>[0])
    : 'Prêt·e ?'
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
        darkening={darkeningByVariant(elapsedPct)}
      />

      {engine.meta.running && <PulseOfSafety breathPhase={engine.state.phase} color={meta.color} />}

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
          <div className="mt-1 text-xl font-light" style={{ color: meta.color }}>
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
      {engine.meta.running && (
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
            Cohérence {coherenceDisplay} · {engine.meta.breathsCounted} souffle{engine.meta.breathsCounted > 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Feedback final si session complétée */}
      {completedInfo && !engine.meta.running && (
        <div className="pointer-events-none absolute bottom-36 left-1/2 z-20 -translate-x-1/2 text-center">
          <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.3em] text-white/60">Niveau</div>
            <div className="mt-0.5 text-lg font-light capitalize" style={{ color: meta.color }}>
              {completedInfo.level ?? 'Brume'}
            </div>
            <div className="text-xs text-white/60">
              Streak {completedInfo.streak} jour{completedInfo.streak > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Persist error banner */}
      {persistError && (
        <div className="absolute top-24 left-1/2 z-30 -translate-x-1/2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200 backdrop-blur">
          {persistError}
        </div>
      )}

      {/* Particles toggle (en haut à droite, petit) */}
      <button
        type="button"
        onClick={() => setParticlesOn((p) => !p)}
        className="absolute right-5 top-24 z-20 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/60 backdrop-blur transition-colors hover:bg-white/[0.08]"
        aria-label={particlesOn ? 'Masquer les particules' : 'Afficher les particules'}
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
        onStart={onStart}
        onPause={engine.actions.pause}
        onResume={engine.actions.resume}
        onStop={onStop}
        onDizzy={onDizzy}
      />
    </div>
  )
}
