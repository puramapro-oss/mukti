'use client'

// MUKTI — G5.2 AURORA Fractale
// Sphere distordue via MeshDistortMaterial (drei) — coeur visuel de la respiration.
// Distort/speed modulés par la phase de souffle (inspire/expire/hold).
// Piloté par l'extérieur via props (driver = useAuroraPhase en G5.3).

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import type { BreathPhase } from './types'

export interface FractalMeshProps {
  /** Couleur primaire (hex). Définie par la variante AURORA. */
  color: string
  /** Phase de souffle courante. Pilote distort + speed + scale. */
  breathPhase: BreathPhase
  /** Progression 0-1 de la phase courante (0 = début, 1 = fin). */
  phaseProgress: number
  /** Rayon de base. */
  radius?: number
}

/**
 * Courbes d'animation :
 * - inspire : scale 0.9 → 1.15 (croissance), distort 0.30 → 0.55, speed 1.0 → 2.5
 * - expire  : scale 1.15 → 0.85 (aspiration), distort 0.55 → 0.15, speed 2.5 → 0.8
 * - hold    : scale stable 1.0, distort micro-wobble 0.25 ± 0.05, speed 0.4 (quasi-figé)
 */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

export default function FractalMesh({
  color,
  breathPhase,
  phaseProgress,
  radius = 1,
}: FractalMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const mat = mesh.material as THREE.MeshPhysicalMaterial & { distort?: number; speed?: number }
    if (!mat) return

    const t = Math.max(0, Math.min(1, phaseProgress))
    const et = easeInOut(t)

    let targetScale = 1
    let targetDistort = 0.3
    let targetSpeed = 1.2

    if (breathPhase === 'inspire') {
      targetScale = 0.9 + et * 0.25
      targetDistort = 0.3 + et * 0.25
      targetSpeed = 1 + et * 1.5
    } else if (breathPhase === 'expire') {
      targetScale = 1.15 - et * 0.3
      targetDistort = 0.55 - et * 0.4
      targetSpeed = 2.5 - et * 1.7
    } else if (breathPhase === 'hold') {
      targetScale = 1
      targetDistort = 0.25 + Math.sin(state.clock.getElapsedTime() * 1.5) * 0.05
      targetSpeed = 0.4
    } else {
      // idle : respiration douce automatique
      const breath = Math.sin(state.clock.getElapsedTime() * 0.6)
      targetScale = 1 + breath * 0.04
      targetDistort = 0.3 + breath * 0.05
      targetSpeed = 1
    }

    // Lerp lisse pour éviter les à-coups
    mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08)
    if (typeof mat.distort === 'number') mat.distort += (targetDistort - mat.distort) * 0.08
    if (typeof mat.speed === 'number') mat.speed += (targetSpeed - mat.speed) * 0.08

    // Rotation légère globale pour dynamisme
    mesh.rotation.y += 0.0015
    mesh.rotation.x += 0.0008
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 96, 96]} />
      <MeshDistortMaterial
        color={color}
        distort={0.3}
        speed={1.2}
        roughness={0.35}
        metalness={0.2}
        transparent
        opacity={0.88}
      />
    </mesh>
  )
}
