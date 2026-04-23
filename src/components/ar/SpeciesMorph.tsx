'use client'

// MUKTI — G4.4 SpeciesMorph
// Compose SilhouetteMesh + décorations r3f selon l'espèce choisie.
// Cross-fade opacité 800ms à chaque changement d'espèce.

import { useEffect, useMemo, useRef, useState } from 'react'
import SilhouetteMesh from './SilhouetteMesh'
import PhantomHands from './PhantomHands'
import { GuardianAura, SpeciesEars, SpeciesTail, SpeciesWings } from './SpeciesDecorations'
import { getSpeciesRig, type SpeciesRigConfig } from '@/lib/ar/species-rigs'
import type { ArSpeciesSlug } from '@/lib/constants'

interface Props {
  species: ArSpeciesSlug
  /** Affiche aussi les mains fantômes (défaut true). */
  showHands?: boolean
}

const TRANSITION_MS = 800

export default function SpeciesMorph({ species, showHands = true }: Props) {
  const [activeRig, setActiveRig] = useState<SpeciesRigConfig>(() => getSpeciesRig(species))
  const [opacity, setOpacity] = useState(1)
  const pendingRigRef = useRef<SpeciesRigConfig | null>(null)

  useEffect(() => {
    const newRig = getSpeciesRig(species)
    if (newRig.slug === activeRig.slug) return
    // fade out → swap → fade in
    pendingRigRef.current = newRig
    setOpacity(0)
    const outT = window.setTimeout(() => {
      setActiveRig(pendingRigRef.current ?? newRig)
      setOpacity(1)
    }, TRANSITION_MS / 2)
    return () => window.clearTimeout(outT)
  }, [species, activeRig.slug])

  const effectiveOpacity = useMemo(() => activeRig.silhouetteOpacity * opacity, [activeRig, opacity])

  return (
    <group>
      {/* Silhouette recolorée */}
      <SilhouetteMesh
        color={activeRig.color}
        haloColor={activeRig.haloColor}
        coreOpacity={effectiveOpacity}
        haloOpacity={effectiveOpacity * 0.35}
      />

      {/* Mains fantômes — couleurs fixes (gauche cyan / droite violet) car représentent antennes */}
      {showHands && <PhantomHands />}

      {/* Decorations par espèce */}
      {renderDecoration(activeRig.decoration, activeRig, opacity)}
      {activeRig.secondary && renderDecoration(activeRig.secondary, activeRig, opacity)}
    </group>
  )
}

function renderDecoration(
  deco: 'ears' | 'tail' | 'wings' | 'aura' | 'none',
  rig: SpeciesRigConfig,
  fade: number,
) {
  if (deco === 'none') return null
  if (deco === 'ears') {
    return <SpeciesEars color={rig.haloColor} opacity={0.85 * fade} />
  }
  if (deco === 'tail') {
    return <SpeciesTail color={rig.haloColor} opacity={0.7 * fade} />
  }
  if (deco === 'wings') {
    return <SpeciesWings color={rig.color} opacity={0.55 * fade} />
  }
  if (deco === 'aura') {
    return <GuardianAura color={rig.color} opacity={0.4 * fade} />
  }
  return null
}
