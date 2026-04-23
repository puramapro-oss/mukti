'use client'

// MUKTI — G4.6 Breath Guide (4-7-8)
// 3 phases cycliques : inspire 4s → hold 7s → expire 8s. Total cycle = 19s.
// Render : 2 anneaux concentriques + texte phase via drei Html.

import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useLatestFrame } from '@/lib/ar/frame-context'

const INHALE_SEC = 4
const HOLD_SEC = 7
const EXHALE_SEC = 8
const CYCLE_SEC = INHALE_SEC + HOLD_SEC + EXHALE_SEC

type Phase = 'inhale' | 'hold' | 'exhale'

export default function BreathGuide() {
  const frameRef = useLatestFrame()
  const { viewport } = useThree()
  const ringOuterRef = useRef<THREE.Mesh | null>(null)
  const ringInnerRef = useRef<THREE.Mesh | null>(null)
  const [phaseLabel, setPhaseLabel] = useState<Phase>('inhale')

  const ringOuterGeom = useMemo(() => new THREE.RingGeometry(0.85, 0.9, 64), [])
  const ringInnerGeom = useMemo(() => new THREE.RingGeometry(0.55, 0.6, 64), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime % CYCLE_SEC
    let phase: Phase
    let scale: number
    if (t < INHALE_SEC) {
      phase = 'inhale'
      scale = 0.5 + (t / INHALE_SEC) * 0.7
    } else if (t < INHALE_SEC + HOLD_SEC) {
      phase = 'hold'
      scale = 1.2
    } else {
      phase = 'exhale'
      const p = (t - INHALE_SEC - HOLD_SEC) / EXHALE_SEC
      scale = 1.2 - p * 0.7
    }
    if (phaseLabel !== phase) setPhaseLabel(phase)

    // Centre : buste (entre épaules)
    const pose = frameRef.current?.pose.landmarks
    let cx = 0
    let cy = 0
    if (pose && pose.length >= 33) {
      const shL = pose[11]
      const shR = pose[12]
      if (shL && shR) {
        cx = ((shL.x + shR.x) / 2 - 0.5) * viewport.width
        cy = -((shL.y + shR.y) / 2 - 0.5) * viewport.height
      }
    }

    if (ringOuterRef.current) {
      ringOuterRef.current.position.set(cx, cy, -0.08)
      ringOuterRef.current.scale.setScalar(scale)
    }
    if (ringInnerRef.current) {
      ringInnerRef.current.position.set(cx, cy, -0.07)
      ringInnerRef.current.scale.setScalar(scale * 0.75)
    }
  })

  return (
    <group>
      <mesh ref={ringOuterRef} geometry={ringOuterGeom}>
        <meshBasicMaterial
          color="#06B6D4"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={ringInnerRef} geometry={ringInnerGeom}>
        <meshBasicMaterial
          color="#7C3AED"
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Html center zIndexRange={[5, 0]} distanceFactor={4} style={{ pointerEvents: 'none' }}>
        <div className="scale-x-[-1] rounded-full border border-white/15 bg-black/55 px-4 py-1.5 text-center backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
            Respiration 4-7-8
          </p>
          <p className="mt-0.5 text-sm font-medium text-white">
            {phaseLabel === 'inhale' && 'Inspire…'}
            {phaseLabel === 'hold' && 'Retiens…'}
            {phaseLabel === 'exhale' && 'Expire…'}
          </p>
        </div>
      </Html>
    </group>
  )
}
