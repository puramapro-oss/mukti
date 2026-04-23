'use client'

// MUKTI — G4.6 Formation AR
// 5 étapes par mode (soin / manifestation). Scene AR adaptée par étape :
//   Soin           : 1 silhouette → 2 mains → 3 breath 4-7-8 → 4 imposition → 5 gratitude
//   Manifestation  : 1 intention → 2 visualiser → 3 charger (proximity) → 4 émettre beam → 5 sceller
// Pas de sauvegarde session AR (mode 'training' dédié si besoin plus tard).

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Camera, CameraOff, Check, Eye, Sparkles } from 'lucide-react'
import { useCameraPermission } from '@/hooks/useCameraPermission'
import ARCanvas from '@/components/ar/ARCanvas'
import SilhouetteMesh from '@/components/ar/SilhouetteMesh'
import PhantomHands from '@/components/ar/PhantomHands'
import BreathGuide from '@/components/ar/BreathGuide'
import HandProximityGauge from '@/components/ar/HandProximityGauge'
import DistanceBeacon from '@/components/ar/DistanceBeacon'
import TrainingOverlay from '@/components/ar/TrainingOverlay'
import type { ArTrainingMode } from '@/lib/constants'

type StepNum = 1 | 2 | 3 | 4 | 5

interface Props {
  mode: ArTrainingMode
  initialStep?: StepNum
  savedSteps?: number[]
}

export default function ArTrainingRoom({ mode, initialStep = 1, savedSteps = [] }: Props) {
  const cam = useCameraPermission('user')
  const [step, setStep] = useState<StepNum>(initialStep)
  const [completed, setCompleted] = useState(false)

  const handleNext = useCallback(() => {
    setStep((prev) => (prev < 5 ? ((prev + 1) as StepNum) : prev))
  }, [])

  const handleComplete = useCallback(() => {
    setCompleted(true)
  }, [])

  // Phase complete : petite cérémonie + lien retour
  if (completed) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-gradient-to-br from-[var(--cyan)]/10 to-[var(--purple)]/10 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl">
          <Check className="h-7 w-7 text-[var(--cyan)]" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-white">
            Initiation {mode === 'soin' ? 'Soin' : 'Manifestation'} débloquée
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/65">
            Tu connais désormais les 5 gestes. Reviens aussi souvent que tu veux — cette formation reste
            disponible, et la pratique réelle t&apos;attend au miroir.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href={mode === 'soin' ? '/dashboard/ar/soin' : '/dashboard/ar/manifestation'}
            data-testid="training-goto-practice"
            className="rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Sparkles className="mr-1.5 inline h-4 w-4" />
            {mode === 'soin' ? 'Pratiquer : Soin pour moi' : 'Pratiquer : Envoyer un rayon'}
          </Link>
          <button
            type="button"
            onClick={() => {
              setStep(1)
              setCompleted(false)
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/85 transition-colors hover:bg-white/10"
          >
            Recommencer
          </button>
          <Link
            href="/dashboard/ar"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/85 transition-colors hover:bg-white/10"
          >
            Retour au miroir
          </Link>
        </div>
      </div>
    )
  }

  // Gate permission caméra (identique aux pages soin/manifestation, simplifié)
  const gateVisible =
    cam.status === 'idle' || cam.status === 'denied' || cam.status === 'unavailable'

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-black sm:aspect-video">
        <ARCanvas
          stream={cam.status === 'granted' ? cam.stream : null}
          enabled={cam.status === 'granted'}
          overlay={
            <TrainingOverlay
              mode={mode}
              step={step}
              onNext={handleNext}
              onComplete={handleComplete}
              savedSteps={savedSteps}
            />
          }
        >
          <TrainingScene mode={mode} step={step} />
        </ARCanvas>

        {gateVisible && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-4 bg-black/75 p-6 text-center backdrop-blur">
            {cam.status === 'idle' && (
              <>
                <Camera className="h-10 w-10 text-white/70" />
                <p className="max-w-sm text-sm text-white/80">
                  Autorise la caméra pour suivre les gestes. Tu peux aussi continuer en mode imaginaire.
                </p>
                <button
                  type="button"
                  onClick={cam.request}
                  data-testid="training-request-cam"
                  className="rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Autoriser la caméra
                </button>
                <button
                  type="button"
                  onClick={cam.useImaginaryMode}
                  className="text-xs text-white/60 underline-offset-4 hover:underline"
                >
                  Mode imaginaire
                </button>
              </>
            )}
            {(cam.status === 'denied' || cam.status === 'unavailable') && (
              <>
                <CameraOff className="h-10 w-10 text-white/70" />
                <p className="max-w-sm text-sm text-white/80">{cam.error}</p>
                <button
                  type="button"
                  onClick={cam.useImaginaryMode}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/85 transition-colors hover:bg-white/10"
                >
                  Mode imaginaire
                </button>
              </>
            )}
          </div>
        )}

        {cam.status === 'imaginary' && (
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-white/60 backdrop-blur">
            <Eye className="mr-1 inline h-3 w-3" /> mode imaginaire
          </div>
        )}
      </div>
    </div>
  )
}

// Scene r3f dépendante du mode et de l'étape
function TrainingScene({ mode, step }: { mode: ArTrainingMode; step: StepNum }) {
  // Soin : 1=silhouette, 2=silhouette+hands, 3=silhouette+hands+breath, 4=silhouette+hands (imposition), 5=silhouette+aura légère
  if (mode === 'soin') {
    return (
      <>
        <SilhouetteMesh color="#06B6D4" haloColor="#7C3AED" />
        {step >= 2 && <PhantomHands />}
        {step === 3 && <BreathGuide />}
      </>
    )
  }

  // Manifestation : 1=silhouette seule (fixer intention), 2=silhouette+hands+auraTarget implicite, 3=proximity, 4=beam, 5=silhouette+hands
  return (
    <>
      <SilhouetteMesh color="#06B6D4" haloColor="#D946EF" />
      {step >= 2 && <PhantomHands />}
      {step === 3 && <HandProximityGauge />}
      {step === 4 && (
        <DistanceBeacon
          color="#D946EF"
          haloColor="#F0ABFC"
          glyph="✨"
          label="Ta cible"
          typeLabel="Exemple"
        />
      )}
    </>
  )
}
