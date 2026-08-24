'use client'

// MUKTI — G4.5 Manifestation AR room
// Flux : pick-beacon → pick-species → in-session (ARCanvas + SpeciesMorph + DistanceBeacon + AuraPet + countdown) → completed.

import { useMemo, useState } from 'react'
import { ArrowRight, Loader2, Play, Square, Sparkles } from 'lucide-react'
import { useCameraPermission } from '@/hooks/useCameraPermission'
import { useArSession } from '@/components/ar/hooks/useArSession'
import ARCanvas from '@/components/ar/ARCanvas'
import SpeciesMorph from '@/components/ar/SpeciesMorph'
import SpeciesPicker, { type SpeciesPickerSpecies } from '@/components/ar/SpeciesPicker'
import BeaconPicker from '@/components/ar/BeaconPicker'
import DistanceBeacon from '@/components/ar/DistanceBeacon'
import AuraPet, { type AuraIntention } from '@/components/ar/AuraPet'
import CameraLine from '@/components/ar/CameraLine'
import ArSessionRating from '@/components/ar/ArSessionRating'
import type { ArBeacon } from '@/lib/ar'
import { AR_SESSION_DURATIONS_SEC, type ArSpeciesSlug } from '@/lib/constants'
import { SPECIES_RIGS } from '@/lib/ar/species-rigs'
import { BEACON_TYPE_EMOJI, BEACON_TYPE_LABEL } from '@/lib/ar/beacon-constants'
import { formatTime } from '@/components/ar/ar-helpers'

type Phase = 'pick-beacon' | 'pick-species' | 'in-session' | 'completed'

interface Props {
  beacons: ArBeacon[]
  species: SpeciesPickerSpecies[]
}

export default function ArManifestationRoom({ beacons, species }: Props) {
  const cam = useCameraPermission('user')
  const [phase, setPhase] = useState<Phase>('pick-beacon')
  const [selectedBeacon, setSelectedBeacon] = useState<string | null>(null)
  const [selectedSpecies, setSelectedSpecies] = useState<ArSpeciesSlug>('humain')
  const [durationSec, setDurationSec] = useState<number>(300)
  const [intensity, setIntensity] = useState<number | null>(null)

  const session = useArSession(durationSec)

  const beaconData = useMemo(
    () => beacons.find((b) => b.slug === selectedBeacon) ?? null,
    [beacons, selectedBeacon],
  )

  const intention = (beaconData?.intention_hint ?? 'paix') as AuraIntention

  const handleStartSession = async () => {
    if (!selectedBeacon) return
    const success = await session.handleStart({
      mode: 'manifestation',
      species_slug: selectedSpecies,
      beacon_slug: selectedBeacon,
      fallback_imaginary: cam.status !== 'granted',
    })
    if (success) {
      setPhase('in-session')
    }
  }

  const handleCompleteSession = async (durationUsed: number, intensityVal: number | null) => {
    await session.handleComplete(durationUsed, intensityVal)
    setPhase('completed')
  }

  const handleSubmitRating = (value: number) => {
    setIntensity(value)
    handleCompleteSession(durationSec, value)
  }

  const handleRetrySession = () => {
    session.handleRetry()
    setIntensity(null)
    setPhase('pick-beacon')
  }

  // ===========================
  // PHASE : pick-beacon
  // ===========================
  if (phase === 'pick-beacon') {
    return (
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">À qui envoies-tu ?</h2>
          <BeaconPicker beacons={beacons} value={selectedBeacon} onChange={setSelectedBeacon} />
        </section>
        <button
          type="button"
          onClick={() => setPhase('pick-species')}
          disabled={!selectedBeacon}
          data-testid="manifestation-continue-to-species"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continuer <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // ===========================
  // PHASE : pick-species
  // ===========================
  if (phase === 'pick-species') {
    return (
      <div className="flex flex-col gap-5">
        {beaconData && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/70">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Cible choisie</p>
            <p className="mt-1 flex items-center gap-2 text-base font-medium text-white">
              <span aria-hidden="true">{BEACON_TYPE_EMOJI[beaconData.type]}</span>
              {beaconData.name_fr}
            </p>
            <p className="mt-1 text-xs text-white/55">{beaconData.description_fr}</p>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Sous quelle forme ?</h2>
          <SpeciesPicker species={species} value={selectedSpecies} onChange={setSelectedSpecies} />
          <p className="text-xs italic text-white/45" data-testid="species-tagline">
            {SPECIES_RIGS[selectedSpecies].tagline_fr}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Durée</h2>
          <div className="grid grid-cols-3 gap-2">
            {AR_SESSION_DURATIONS_SEC.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDurationSec(s)}
                data-testid={`mf-duration-${s}`}
                className={`rounded-xl border px-4 py-3 text-sm transition-all ${
                  durationSec === s
                    ? 'border-[var(--purple)]/60 bg-[var(--purple)]/10 text-white'
                    : 'border-white/10 bg-white/[0.02] text-white/65 hover:bg-white/[0.05]'
                }`}
              >
                {Math.floor(s / 60)} min
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/60">
          {cam.status === 'granted' && <CameraLine icon="on" text="Caméra active — le rayon partira de tes mains." />}
          {cam.status === 'idle' && <CameraLine icon="off" text="Tu peux activer la caméra ou continuer en mode imaginaire." />}
          {(cam.status === 'denied' || cam.status === 'unavailable') && <CameraLine icon="off" text={cam.error ?? 'Caméra indisponible.'} />}
          {cam.status === 'imaginary' && <CameraLine icon="imaginary" text="Mode imaginaire — tu visualises le rayon intérieurement." />}
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPhase('pick-beacon')}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
          >
            Changer de cible
          </button>
          <button
            type="button"
            onClick={handleStartSession}
            disabled={session.startingSession || (cam.status !== 'granted' && cam.status !== 'imaginary')}
            data-testid="manifestation-start"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {session.startingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Émettre le rayon
          </button>
        </div>

        {session.startError && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {session.startError}
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
          >
            <SpeciesMorph species={selectedSpecies} showHands={cam.status === 'granted'} />
            <AuraPet intention={intention} />
            {beaconData && (
              <DistanceBeacon
                color={SPECIES_RIGS[selectedSpecies].color}
                haloColor={SPECIES_RIGS[selectedSpecies].haloColor}
                glyph={BEACON_TYPE_EMOJI[beaconData.type] ?? '✨'}
                label={beaconData.name_fr}
                typeLabel={BEACON_TYPE_LABEL[beaconData.type] ?? ''}
              />
            )}
          </ARCanvas>
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-xs font-mono text-white backdrop-blur">
            {formatTime(session.remaining)}
          </div>
          {cam.status !== 'granted' && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 w-[min(88vw,360px)] -translate-x-1/2 rounded-xl border border-white/10 bg-black/55 p-3 text-center text-xs text-white/75 backdrop-blur">
              Mode imaginaire — ferme les yeux si tu veux, le rayon voyage quand même.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={session.handleStopEarly}
          data-testid="manifestation-stop"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 transition-colors hover:bg-white/10"
        >
          <Square className="h-3.5 w-3.5" /> Sceller maintenant
        </button>
      </div>
    )
  }

  // ===========================
  // PHASE : completed
  // ===========================
  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center">
      <Sparkles className="h-10 w-10 text-[var(--purple)]" />
      <div>
        <h2 className="text-xl font-semibold text-white">Rayon scellé</h2>
        {beaconData && (
          <p className="mt-1 text-sm text-white/60">
            Envoyé à <span className="text-white/85">{beaconData.name_fr}</span>.
          </p>
        )}
      </div>

      <ArSessionRating
        intensity={intensity}
        completionStatus={session.completionStatus}
        completionMsg={session.completionMsg}
        onSubmitRating={handleSubmitRating}
      />

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={handleRetrySession}
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm text-white/85 transition-colors hover:bg-white/10"
        >
          Nouvel envoi
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
