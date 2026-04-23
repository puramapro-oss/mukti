'use client'

// MUKTI — G4.5 Aura Pet
// Orbe énergétique orbitant autour de la tête (landmark 0 = nez).
// Couleur basée sur l'intention sélectionnée. Trail subtil via sphère halo.

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useLatestFrame } from '@/lib/ar/frame-context'

export type AuraIntention =
  | 'abondance'
  | 'amour_soi'
  | 'apaisement'
  | 'motivation'
  | 'renouveau'
  | 'confiance'
  | 'protection'
  | 'alignement'
  | 'paix'
  | 'ancrage'
  | 'clarte'
  | 'gratitude'
  | 'liberation'
  | 'manifestation'

const INTENTION_COLORS: Record<AuraIntention, { core: string; halo: string }> = {
  abondance:     { core: '#F59E0B', halo: '#FCD34D' },
  amour_soi:     { core: '#EC4899', halo: '#F9A8D4' },
  apaisement:    { core: '#06B6D4', halo: '#67E8F9' },
  motivation:    { core: '#EF4444', halo: '#FCA5A5' },
  renouveau:     { core: '#10B981', halo: '#6EE7B7' },
  confiance:     { core: '#7C3AED', halo: '#C4B5FD' },
  protection:    { core: '#14B8A6', halo: '#5EEAD4' },
  alignement:    { core: '#3B82F6', halo: '#93C5FD' },
  paix:          { core: '#06B6D4', halo: '#A5F3FC' },
  ancrage:       { core: '#A16207', halo: '#FDE68A' },
  clarte:        { core: '#8B5CF6', halo: '#DDD6FE' },
  gratitude:     { core: '#F97316', halo: '#FDBA74' },
  liberation:    { core: '#22C55E', halo: '#86EFAC' },
  manifestation: { core: '#D946EF', halo: '#F0ABFC' },
}

interface Props {
  intention?: AuraIntention
  /** Rayon d'orbite autour de la tête (world units). */
  orbitRadius?: number
  /** Vitesse angulaire (rad/s). */
  orbitSpeed?: number
}

export default function AuraPet({
  intention = 'paix',
  orbitRadius = 0.7,
  orbitSpeed = 0.9,
}: Props) {
  const frameRef = useLatestFrame()
  const { viewport } = useThree()
  const coreRef = useRef<THREE.Mesh | null>(null)
  const haloRef = useRef<THREE.Mesh | null>(null)
  const trailRef = useRef<THREE.Mesh | null>(null)

  const palette = useMemo(() => INTENTION_COLORS[intention] ?? INTENTION_COLORS.paix, [intention])

  useFrame((state) => {
    const pose = frameRef.current?.pose.landmarks
    if (!pose || pose.length < 33) {
      if (coreRef.current) coreRef.current.visible = false
      if (haloRef.current) haloRef.current.visible = false
      if (trailRef.current) trailRef.current.visible = false
      return
    }
    const nose = pose[0]
    if (!nose || (nose.visibility ?? 1) < 0.3) return

    const t = state.clock.elapsedTime
    const angle = t * orbitSpeed
    const headX = (nose.x - 0.5) * viewport.width
    const headY = -(nose.y - 0.5) * viewport.height + 0.15
    const orbitX = headX + Math.cos(angle) * orbitRadius
    const orbitY = headY + Math.sin(angle) * orbitRadius * 0.55

    const pulse = 1 + Math.sin(t * 3) * 0.12

    if (coreRef.current) {
      coreRef.current.visible = true
      coreRef.current.position.set(orbitX, orbitY, 0.08)
      coreRef.current.scale.setScalar(pulse)
    }
    if (haloRef.current) {
      haloRef.current.visible = true
      haloRef.current.position.set(orbitX, orbitY, 0.05)
      haloRef.current.scale.setScalar(pulse * 1.9)
    }
    if (trailRef.current) {
      // trail un quart de cycle en arrière
      const trailAngle = angle - 0.6
      const trailX = headX + Math.cos(trailAngle) * orbitRadius
      const trailY = headY + Math.sin(trailAngle) * orbitRadius * 0.55
      trailRef.current.visible = true
      trailRef.current.position.set(trailX, trailY, 0.03)
      trailRef.current.scale.setScalar(pulse * 1.2)
    }
  })

  return (
    <group>
      <mesh ref={haloRef} visible={false}>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshBasicMaterial
          color={palette.halo}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={trailRef} visible={false}>
        <sphereGeometry args={[0.04, 18, 18]} />
        <meshBasicMaterial
          color={palette.halo}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={coreRef} visible={false}>
        <sphereGeometry args={[0.06, 24, 24]} />
        <meshBasicMaterial
          color={palette.core}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
