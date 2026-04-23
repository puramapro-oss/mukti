'use client'

// MUKTI — G5.2 AURORA Event Horizon
// Anneau noir élégant au centre : aspire la fractale et les particules sur expire.
// Halo cristallin lumineux qui pulse sur hold. Invisible sur inspire (off-screen arrière).
// Composé de : sphere noire centrale + ring additive + glow sprite.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { BreathPhase } from './types'

export interface EventHorizonProps {
  /** Phase de souffle courante (contrôle l'intensité du halo). */
  breathPhase: BreathPhase
  /** 0-1 progression dans la phase. */
  phaseProgress: number
  /** Couleur du halo (variante AURORA). */
  accentColor: string
  /** Rayon de la sphère noire centrale. */
  radius?: number
}

export default function EventHorizon({
  breathPhase,
  phaseProgress,
  accentColor,
  radius = 0.28,
}: EventHorizonProps) {
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const group = groupRef.current
    const ring = ringRef.current
    const halo = haloRef.current
    if (!group || !ring || !halo) return

    const t = Math.max(0, Math.min(1, phaseProgress))

    // Scale du halo selon phase :
    // expire : 0.8 → 1.4 (aspiration croissante, halo s'étend)
    // hold : pulse stable 1.0 ± 0.08
    // inspire : 0.4 (réduit, discret)
    // idle : 0.9 respiration auto
    let targetHaloScale = 0.9
    let haloOpacity = 0.35
    let ringOpacity = 0.7
    if (breathPhase === 'expire') {
      targetHaloScale = 0.8 + t * 0.6
      haloOpacity = 0.3 + t * 0.45
      ringOpacity = 0.6 + t * 0.3
    } else if (breathPhase === 'hold') {
      const pulse = Math.sin(state.clock.getElapsedTime() * 2.5) * 0.08
      targetHaloScale = 1 + pulse
      haloOpacity = 0.5 + pulse * 0.3
      ringOpacity = 0.85
    } else if (breathPhase === 'inspire') {
      targetHaloScale = 0.4 + t * 0.05
      haloOpacity = 0.15
      ringOpacity = 0.4
    } else {
      const breath = Math.sin(state.clock.getElapsedTime() * 0.6)
      targetHaloScale = 0.85 + breath * 0.05
    }

    halo.scale.lerp(
      new THREE.Vector3(targetHaloScale, targetHaloScale, targetHaloScale),
      0.1
    )
    const haloMat = halo.material as THREE.MeshBasicMaterial
    haloMat.opacity += (haloOpacity - haloMat.opacity) * 0.1
    const ringMat = ring.material as THREE.MeshBasicMaterial
    ringMat.opacity += (ringOpacity - ringMat.opacity) * 0.1

    // Rotation contra de l'anneau pour signature "aurore"
    ring.rotation.z += 0.003
    group.rotation.y += 0.0005
  })

  return (
    <group ref={groupRef}>
      {/* Sphere noire centrale (absorbe la lumière) */}
      <mesh>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Anneau glow additive autour */}
      <mesh ref={ringRef}>
        <ringGeometry args={[radius * 1.15, radius * 1.35, 64]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Halo sprite extérieur — 3 plans croisés pour volume sans instancing */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[radius * 2.2, 32, 32]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.35}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
