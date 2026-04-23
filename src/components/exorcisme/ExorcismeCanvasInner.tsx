'use client'

// MUKTI — G5.7 Exorcisme WebGL canvas (inner, client only).
// Fond noir → violet profond, particles sombres, core central pulsant.
// Varie avec la phase : invocation (convergence), destruction (burst), reprogrammation (warm), scellement (golden sphere).

import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ExorcismePhaseName } from '@/lib/exorcisme-utils'

export interface ExorcismeCanvasInnerProps {
  phase: ExorcismePhaseName
  /** 0→1 progress du shatter (nb taps / total) pendant phase 'destruction'. */
  destructionProgress?: number
  /** True pendant flash final du scellement. */
  sealing?: boolean
}

function ParticleField({ phase, destructionProgress }: { phase: ExorcismePhaseName; destructionProgress: number }) {
  const pointsRef = useRef<THREE.Points>(null)
  const COUNT = 1400

  const [positions, initialPositions] = useMemo(() => {
    const pos = new Float32Array(COUNT * 3)
    const init = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      const r = 2 + Math.random() * 6
      const phi = Math.random() * Math.PI * 2
      const costh = Math.random() * 2 - 1
      const sinth = Math.sqrt(1 - costh * costh)
      const x = r * sinth * Math.cos(phi)
      const y = r * sinth * Math.sin(phi) * 0.7
      const z = r * costh * 0.5
      pos[i * 3 + 0] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      init[i * 3 + 0] = x
      init[i * 3 + 1] = y
      init[i * 3 + 2] = z
    }
    return [pos, init] as const
  }, [])

  useFrame((state, delta) => {
    const pts = pointsRef.current
    if (!pts) return
    const attr = pts.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const t = state.clock.elapsedTime

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      const iy = i * 3 + 1
      const iz = i * 3 + 2
      const x0 = initialPositions[ix]!
      const y0 = initialPositions[iy]!
      const z0 = initialPositions[iz]!
      const dist = Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0)

      if (phase === 'invocation') {
        // convergence douce vers centre
        const k = 1 - Math.min(1, t / 10) * 0.55
        arr[ix] = x0 * k + Math.sin(t * 0.7 + i) * 0.04
        arr[iy] = y0 * k + Math.cos(t * 0.6 + i * 0.3) * 0.04
        arr[iz] = z0 * k + Math.sin(t * 0.5 + i * 0.2) * 0.03
      } else if (phase === 'destruction') {
        // burst radial basé sur destructionProgress
        const burst = destructionProgress * 3.2
        const dx = arr[ix]!
        const dy = arr[iy]!
        const dz = arr[iz]!
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
        arr[ix] = dx + (dx / len) * delta * burst * 1.4
        arr[iy] = dy + (dy / len) * delta * burst * 1.4
        arr[iz] = dz + (dz / len) * delta * burst * 1.4
      } else if (phase === 'reprogrammation') {
        // mouvement doux ascensionnel (chaleur)
        arr[iy] = y0 + Math.sin(t * 0.5 + dist) * 0.15
        arr[ix] = x0 + Math.cos(t * 0.3 + i * 0.1) * 0.08
        arr[iz] = z0 + Math.sin(t * 0.4 + i * 0.05) * 0.05
      } else if (phase === 'scellement') {
        // orbite lente autour du centre
        const angle = t * 0.25 + i * 0.01
        const radius = dist * 0.55
        arr[ix] = Math.cos(angle) * radius
        arr[iy] = y0 * 0.6 + Math.sin(angle * 0.7) * 0.1
        arr[iz] = Math.sin(angle) * radius
      } else {
        // revelation / fallback : léger drift
        arr[ix] = x0 + Math.sin(t * 0.4 + i) * 0.05
        arr[iy] = y0 + Math.cos(t * 0.3 + i * 0.2) * 0.05
        arr[iz] = z0
      }
    }
    attr.needsUpdate = true
  })

  const color =
    phase === 'reprogrammation'
      ? '#F59E0B'
      : phase === 'scellement'
        ? '#FFD700'
        : '#7C3AED'

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={COUNT}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color={color}
        transparent
        opacity={phase === 'invocation' ? 0.6 : phase === 'destruction' ? 0.45 : 0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

function CentralCore({ phase, destructionProgress, sealing }: { phase: ExorcismePhaseName; destructionProgress: number; sealing: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime
    let scale = 1
    if (phase === 'invocation') scale = 0.9 + Math.sin(t * 0.8) * 0.12
    else if (phase === 'revelation') scale = 0.75 + Math.sin(t * 0.6) * 0.06
    else if (phase === 'destruction') scale = Math.max(0.2, 1 - destructionProgress * 0.8 + Math.sin(t * 2) * 0.08)
    else if (phase === 'reprogrammation') scale = 0.9 + Math.sin(t * 0.9) * 0.15
    else if (phase === 'scellement') scale = sealing ? 2.8 : 1 + Math.sin(t * 1.2) * 0.25

    meshRef.current.scale.setScalar(scale)
    meshRef.current.rotation.y = t * 0.25
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.2
  })

  const color =
    phase === 'reprogrammation'
      ? '#F59E0B'
      : phase === 'scellement'
        ? '#FFD700'
        : phase === 'destruction'
          ? '#4C1D95'
          : '#6D28D9'

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[0.9, 2]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
    </mesh>
  )
}

export default function ExorcismeCanvasInner({
  phase,
  destructionProgress = 0,
  sealing = false,
}: ExorcismeCanvasInnerProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 55 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#050308']} />
      <fog attach="fog" args={['#050308', 4, 14]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 4]} intensity={0.5} color="#7C3AED" />
      <CentralCore phase={phase} destructionProgress={destructionProgress} sealing={sealing} />
      <ParticleField phase={phase} destructionProgress={destructionProgress} />
    </Canvas>
  )
}
