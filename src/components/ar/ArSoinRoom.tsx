'use client'

// MUKTI — G4.4 Soin AR room
// Flux complet : pick species → pick durée → session AR (ARCanvas + SpeciesMorph + countdown) → rating 1-5 → done.
// Fallback mode imaginaire : sans caméra, la silhouette est absente mais le timer + species morph tournent pour le rituel intérieur.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Eye, Loader2, Play, Square, Sparkles } from 'lucide-react'
import { useCameraPermission } from '@/hooks/useCameraPermission'
import ARCanvas from '@/components/ar/ARCanvas'
import SpeciesMorph from '@/components/ar/SpeciesMorph'
import SpeciesPicker, { type SpeciesPickerSpecies } from '@/components/ar/SpeciesPicker'
import CalibrationOverlay from '@/components/ar/CalibrationOverlay'
import { AR_SESSION_DURATIONS_SEC, type ArSpeciesSlug } from '@/lib/constants'
import { SPECIES_RIGS } from '@/lib/ar/species-rigs'

type Phase = 'pick' | 'in-session' | 'completed'

interface Props {
  species: SpeciesPickerSpecies[]
}

export default function ArSoinRoom({ species }: Props) {
  const cam = useCameraPermission('user')
  const [selectedSpecies, setSelectedSpecies] = useState<ArSpeciesSlug>('humain')
  const [durationSec, setDurationSec] = useState<number>(300)
  const [phase, setPhase] = useState<Phase>('pick')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [startingSession, setStartingSession] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number>(0)
  const [intensity, setIntensity] = useState<number | null>(null)
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [completionMsg, setCompletionMsg] = useState<string | null>(null)
  const [showCalibration, setShowCalibration] = useState(false)
  const sessionStartRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  // Tick countdown
  useEffect(() => {
    if (phase !== 'in-session' || sessionStartRef.current === null) return
    const tick = () => {
      if (sessionStartRef.current === null) return
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000)
      const left = Math.max(0, durationSec - elapsed)
      setRemaining(left)
      if (left <= 0) {
        handleComplete(durationSec, null)
      }
    }
    tick()
    timerRef.current = window.setInterval(tick, 500)
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, durationSec])

  const handleStart = useCallback(async () => {
    setStartError(null)
    setStartingSession(true)
    try {
      const res = await fetch('/api/ar/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'soin',
          species_slug: selectedSpecies,
          fallback_imaginary: cam.status !== 'granted',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setStartError(data.error ?? 'Impossible de démarrer la session.')
        setStartingSession(false)
        return
      }
      setSessionId(data.session.id)
      sessionStartRef.current = Date.now()
      setRemaining(durationSec)
      setPhase('in-session')
    } catch {
      setStartError('Erreur réseau. Réessaie.')
    } finally {
      setStartingSession(false)
    }
  }, [selectedSpecies, cam.status, durationSec])

  const handleComplete = useCallback(
    async (durationUsed: number, intensityVal: number | null) => {
      if (!sessionId) return
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      setPhase('completed')
      setCompletionStatus('saving')
      setCompletionMsg(null)
      try {
        const res = await fetch(`/api/ar/sessions/${sessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            duration_sec: durationUsed,
            intensity_1_5: intensityVal ?? undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          setCompletionStatus('error')
          setCompletionMsg(data.error ?? 'Impossible de clôturer la session.')
          return
        }
        setCompletionStatus('saved')
        setCompletionMsg('Session enregistrée ✨')
      } catch {
        setCompletionStatus('error')
        setCompletionMsg('Erreur réseau. Ta session locale reste valide.')
      }
    },
    [sessionId],
  )

  const handleStopEarly = () => {
    if (sessionStartRef.current === null) return
    const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000)
    handleComplete(elapsed, null)
  }

  const handleSubmitRating = (value: number) => {
    setIntensity(value)
    if (!sessionId || sessionStartRef.current === null) return
    const elapsed = Math.min(durationSec, Math.floor((Date.now() - sessionStartRef.current) / 1000))
    handleComplete(elapsed, value)
  }

  const handleRetry = () => {
    setSessionId(null)
    sessionStartRef.current = null
    setRemaining(0)
    setIntensity(null)
    setCompletionStatus('idle')
    setCompletionMsg(null)
    setPhase('pick')
  }

  // ===========================
  // PHASE : pick
  // ===========================
  if (phase === 'pick') {
    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Choisis une espèce</h2>
          <SpeciesPicker species={species} value={selectedSpecies} onChange={setSelectedSpecies} />
          <p className="text-xs italic text-white/45" data-testid="species-tagline">
            {SPECIES_RIGS[selectedSpecies].tagline_fr}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Combien de temps ?</h2>
          <div className="grid grid-cols-3 gap-2">
            {AR_SESSION_DURATIONS_SEC.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDurationSec(s)}
                data-testid={`duration-${s}`}
                className={`rounded-xl border px-4 py-3 text-sm transition-all ${
                  durationSec === s
                    ? 'border-[var(--cyan)]/60 bg-[var(--cyan)]/10 text-white'
                    : 'border-white/10 bg-white/[0.02] text-white/65 hover:bg-white/[0.05]'
                }`}
              >
                {Math.floor(s / 60)} min
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/60">
          {cam.status === 'granted' && <CameraLine icon="on" text="Caméra active — mode miroir." />}
          {cam.status === 'idle' && <CameraLine icon="off" text="La caméra n'est pas encore activée. Tu peux l'autoriser ou continuer en mode imaginaire." />}
          {(cam.status === 'denied' || cam.status === 'unavailable') && <CameraLine icon="off" text={cam.error ?? 'Caméra indisponible.'} />}
          {cam.status === 'imaginary' && <CameraLine icon="imaginary" text="Mode imaginaire — la silhouette sera intérieure." />}
          <div className="mt-3 flex flex-wrap gap-2">
            {cam.status !== 'granted' && (
              <button
                type="button"
                onClick={cam.request}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 transition-colors hover:bg-white/10"
              >
                Activer la caméra
              </button>
            )}
            {cam.status !== 'imaginary' && cam.status !== 'granted' && (
              <button
                type="button"
                onClick={cam.useImaginaryMode}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 transition-colors hover:bg-white/10"
              >
                Mode imaginaire
              </button>
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={handleStart}
          disabled={startingSession || (cam.status !== 'granted' && cam.status !== 'imaginary')}
          data-testid="soin-start"
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {startingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Commencer la session
        </button>
        {startError && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {startError}
          </div>
        )}
      </div>
    )
  }

  // ===========================
  // PHASE : in-session
  // ===========================
  if (phase === 'in-session') {
    return (
      <div className="flex flex-col gap-4">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-black sm:aspect-video">
          <ARCanvas
            stream={cam.status === 'granted' ? cam.stream : null}
            enabled={cam.status === 'granted'}
            overlay={(frameRef) =>
              showCalibration ? (
                <CalibrationOverlay
                  frameRef={frameRef}
                  onComplete={() => setShowCalibration(false)}
                  onSkip={() => setShowCalibration(false)}
                />
              ) : null
            }
          >
            <SpeciesMorph species={selectedSpecies} showHands={cam.status === 'granted'} />
          </ARCanvas>
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-xs font-mono text-white backdrop-blur">
            {formatTime(remaining)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCalibration((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition-colors hover:bg-white/10"
          >
            {showCalibration ? 'Fermer calibration' : 'Calibrer'}
          </button>
          <button
            type="button"
            onClick={handleStopEarly}
            data-testid="soin-stop"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition-colors hover:bg-white/10"
          >
            <Square className="h-3.5 w-3.5" /> Terminer maintenant
          </button>
        </div>
      </div>
    )
  }

  // ===========================
  // PHASE : completed
  // ===========================
  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center">
      <Sparkles className="h-10 w-10 text-[var(--cyan)]" />
      <div>
        <h2 className="text-xl font-semibold text-white">Session terminée</h2>
        <p className="mt-1 text-sm text-white/60">Merci à toi. Comment te sens-tu ?</p>
      </div>

      {intensity === null && completionStatus !== 'saved' && (
        <div role="radiogroup" aria-label="Intensité ressentie" className="flex gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => handleSubmitRating(v)}
              data-testid={`intensity-${v}`}
              className="h-11 w-11 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-white/80 transition-all hover:scale-110 hover:bg-white/10"
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {completionStatus === 'saving' && (
        <p className="text-xs text-white/50">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Enregistrement…
        </p>
      )}
      {completionMsg && (
        <p
          role={completionStatus === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-3 py-2 text-xs ${
            completionStatus === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {completionMsg}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm text-white/85 transition-colors hover:bg-white/10"
        >
          Nouvelle session
        </button>
        <a
          href="/dashboard/ar"
          className="rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2 text-sm text-white transition-opacity hover:opacity-90"
        >
          Retour au miroir
        </a>
      </div>
    </div>
  )
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function CameraLine({ icon, text }: { icon: 'on' | 'off' | 'imaginary'; text: string }) {
  const Icon = icon === 'on' ? Camera : icon === 'imaginary' ? Eye : CameraOff
  return (
    <p className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/70" />
      <span>{text}</span>
    </p>
  )
}
