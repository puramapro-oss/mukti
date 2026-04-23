'use client'

// MUKTI — G4.6 Hand Proximity Gauge
// Visualise la proximité des mains : plus elles se rapprochent, plus la sphère énergétique
// entre elles devient brillante et grande. Intensité mappée sur distance 2D landmarks 15/16.

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useLatestFrame } from '@/lib/ar/frame-context'

export default function HandProximityGauge() {
  const frameRef = useLatestFrame()
  const { viewport } = useThree()
  const coreRef = useRef<THREE.Mesh | null>(null)
  const haloRef = useRef<THREE.Mesh | null>(null)
  const labelGroupRef = useRef<THREE.Group | null>(null)
  const chargeRef = useRef<number>(0)

  useFrame(() => {
    const pose = frameRef.current?.pose.landmarks
    const wrL = pose?.[15]
    const wrR = pose?.[16]

    if (!wrL || !wrR || (wrL.visibility ?? 0) < 0.4 || (wrR.visibility ?? 0) < 0.4) {
      if (coreRef.current) coreRef.current.visible = false
      if (haloRef.current) haloRef.current.visible = false
      if (labelGroupRef.current) labelGroupRef.current.visible = false
      return
    }

    const w = viewport.width
    const h = viewport.height
    const midX = ((wrL.x + wrR.x) / 2 - 0.5) * w
    const midY = -((wrL.y + wrR.y) / 2 - 0.5) * h
    const handDist = Math.hypot((wrL.x - wrR.x) * w, (wrL.y - wrR.y) * h)
    // Charge = 0 quand mains loin (distance > 2 world units), = 1 quand collées (< 0.3)
    const targetCharge = THREE.MathUtils.clamp(1 - (handDist - 0.3) / 1.7, 0, 1)
    chargeRef.current = THREE.MathUtils.lerp(chargeRef.current, targetCharge, 0.1)
    const charge = chargeRef.current

    const coreScale = 0.4 + charge * 1.1
    const haloScale = coreScale * 1.8

    if (coreRef.current) {
      coreRef.current.visible = true
      coreRef.current.position.set(midX, midY, 0.06)
      coreRef.current.scale.setScalar(coreScale)
      const mat = coreRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.3 + charge * 0.6
    }
    if (haloRef.current) {
      haloRef.current.visible = true
      haloRef.current.position.set(midX, midY, 0.04)
      haloRef.current.scale.setScalar(haloScale)
      const mat = haloRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.15 + charge * 0.25
    }
    if (labelGroupRef.current) {
      labelGroupRef.current.visible = true
      labelGroupRef.current.position.set(midX, midY - 0.5, 0.08)
      labelGroupRef.current.scale.setScalar(0.9 + charge * 0.3)
    }
  })

  return (
    <group>
      <mesh ref={haloRef} visible={false}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshBasicMaterial color="#7C3AED" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={coreRef} visible={false}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshBasicMaterial color="#F59E0B" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <group ref={labelGroupRef} visible={false}>
        <Html center zIndexRange={[5, 0]} distanceFactor={4} style={{ pointerEvents: 'none' }}>
          <ChargeLabel chargeRef={chargeRef} />
        </Html>
      </group>
    </group>
  )
}

// Label %charge — évite re-renders inutiles en lisant le ref tous les 16ms
function ChargeLabel({ chargeRef }: { chargeRef: React.MutableRefObject<number> }) {
  return (
    <div className="scale-x-[-1] rounded-full border border-white/15 bg-black/55 px-3 py-1 text-center backdrop-blur">
      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/50">Charge</p>
      <ChargePercent chargeRef={chargeRef} />
    </div>
  )
}

// ChargePercent lit le ref via une boucle rAF DOM (hors R3F useFrame — car le composant
// rendu par <Html> est portailé dans le DOM, useFrame depuis r3f y fonctionne mais reste
// couplé à l'arbre Canvas ; cette approche DOM pure est plus sobre ici).
function ChargePercent({ chargeRef }: { chargeRef: React.MutableRefObject<number> }) {
  const spanRef = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    let running = true
    let raf: number | null = null
    const tick = () => {
      if (!running) return
      if (spanRef.current) {
        spanRef.current.textContent = `${Math.round(chargeRef.current * 100)}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      running = false
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [chargeRef])
  return <span ref={spanRef} className="text-sm font-medium text-white">0%</span>
}
