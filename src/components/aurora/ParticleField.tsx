'use client'

// MUKTI — G5.2 AURORA Particle Field
// 500 particules instanced (1 draw call) : spirale vers EventHorizon sur expire,
// éjectées en gerbe sur inspire, wobble subtil sur hold.
// Performance 60fps cible mobile.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { BreathPhase } from './types'

const PARTICLE_COUNT = 500
const MAX_RADIUS = 3.5
const MIN_RADIUS = 0.35

interface ParticleState {
  // Position polaire
  angle: number
  radius: number
  azimuth: number
  // Vitesse radiale de référence
  baseSpeed: number
  // Lifetime pour respawn
  seed: number
}

export interface ParticleFieldProps {
  breathPhase: BreathPhase
  phaseProgress: number
  /** Couleur des particules (variante AURORA). */
  color: string
}

export default function ParticleField({
  breathPhase,
  phaseProgress,
  color,
}: ParticleFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const tmpMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tmpPos = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat = useMemo(() => new THREE.Quaternion(), [])
  const tmpScale = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  const colorObj = useMemo(() => new THREE.Color(color), [color])

  // Init états particules (positions stables entre renders)
  const particlesRef = useRef<ParticleState[]>(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: Math.random() * Math.PI * 2,
      radius: MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS),
      azimuth: (Math.random() - 0.5) * Math.PI * 0.5,
      baseSpeed: 0.3 + Math.random() * 0.7,
      seed: i,
    }))
  )

  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const dt = Math.min(delta, 0.05) // cap large jumps
    const time = state.clock.getElapsedTime()
    const t = Math.max(0, Math.min(1, phaseProgress))

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particlesRef.current[i]

      let radialDelta = 0
      let angleSpeed = 0.25
      let particleSize = 0.045

      if (breathPhase === 'expire') {
        // aspiration vers le centre, spirale accélérée
        radialDelta = -p.baseSpeed * dt * (0.6 + t * 1.2)
        angleSpeed = 0.9 + t * 1.5
        particleSize = 0.045 + t * 0.02
        if (p.radius < MIN_RADIUS) {
          // absorbée par l'Event Horizon → respawn extérieur pour la prochaine expire
          p.radius = MAX_RADIUS * (0.7 + Math.random() * 0.3)
          p.angle = Math.random() * Math.PI * 2
          p.azimuth = (Math.random() - 0.5) * Math.PI * 0.5
        }
      } else if (breathPhase === 'inspire') {
        // éjection depuis le centre en gerbe
        radialDelta = p.baseSpeed * dt * (0.8 + t * 1.0)
        angleSpeed = 0.5
        particleSize = 0.04 + (1 - t) * 0.015
        if (p.radius > MAX_RADIUS) {
          p.radius = MIN_RADIUS + Math.random() * 0.5
        }
      } else if (breathPhase === 'hold') {
        // wobble statique autour position actuelle
        radialDelta = Math.sin(time * 1.5 + p.seed) * 0.002
        angleSpeed = 0.1
        particleSize = 0.05 + Math.sin(time * 2 + p.seed) * 0.008
      } else {
        // idle : flottement doux
        radialDelta = Math.sin(time * 0.5 + p.seed) * 0.003
        angleSpeed = 0.2
        particleSize = 0.04
      }

      p.radius = Math.max(MIN_RADIUS * 0.8, Math.min(MAX_RADIUS * 1.1, p.radius + radialDelta))
      p.angle += angleSpeed * dt

      // Conversion polaire sphérique → cartésien
      const cosAz = Math.cos(p.azimuth)
      tmpPos.set(
        Math.cos(p.angle) * p.radius * cosAz,
        Math.sin(p.azimuth) * p.radius,
        Math.sin(p.angle) * p.radius * cosAz
      )
      tmpScale.setScalar(particleSize)
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMatrix)
    }

    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        color={colorObj}
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  )
}
