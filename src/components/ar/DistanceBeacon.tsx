'use client'

// MUKTI — G4.5 Distance Beacon
// Rayon énergétique : mains (midpoint poignets 15/16) → point cible fixe à droite.
// 3 lignes parallèles + halo final + overlay HTML avec nom/emoji beacon.
// Le beam pulse, s'épaissit lorsque les mains sont proches l'une de l'autre (intensité).

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useLatestFrame } from '@/lib/ar/frame-context'

const BEAM_LINES = 5

interface Props {
  color?: string
  haloColor?: string
  /** Emoji ou glyph affiché dans l'overlay HTML final. */
  glyph?: string
  /** Nom FR du beacon à afficher. */
  label?: string
  /** Type de beacon (affiché en petit au-dessus du nom). */
  typeLabel?: string
}

export default function DistanceBeacon({
  color = '#06B6D4',
  haloColor = '#7C3AED',
  glyph = '🌱',
  label,
  typeLabel,
}: Props) {
  const frameRef = useLatestFrame()
  const { viewport } = useThree()

  const beamGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(BEAM_LINES * 2 * 3)
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    g.setDrawRange(0, 0)
    return g
  }, [])

  const targetSphereRef = useRef<THREE.Mesh | null>(null)
  const targetHaloRef = useRef<THREE.Mesh | null>(null)
  const overlayGroupRef = useRef<THREE.Group | null>(null)
  const beamOpacityRef = useRef<number>(0)

  useFrame((state) => {
    const pose = frameRef.current?.pose.landmarks
    const wrL = pose?.[15]
    const wrR = pose?.[16]

    const attr = beamGeom.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array

    const w = viewport.width
    const h = viewport.height
    // Position cible : droite de l'écran (vu en miroir = gauche de l'user), un peu plus haut
    const targetX = w * 0.38
    const targetY = h * 0.18
    const targetZ = 0.1

    // Mise à jour de la cible (toujours visible)
    if (targetSphereRef.current) {
      targetSphereRef.current.position.set(targetX, targetY, targetZ)
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1
      targetSphereRef.current.scale.setScalar(pulse)
    }
    if (targetHaloRef.current) {
      targetHaloRef.current.position.set(targetX, targetY, targetZ - 0.02)
      const pulseHalo = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.2
      targetHaloRef.current.scale.setScalar(pulseHalo * 1.8)
    }
    if (overlayGroupRef.current) {
      overlayGroupRef.current.position.set(targetX, targetY - 0.25, targetZ + 0.01)
    }

    // Beam : uniquement si les 2 poignets sont visibles
    const ready =
      wrL &&
      wrR &&
      (wrL.visibility ?? 1) >= 0.4 &&
      (wrR.visibility ?? 1) >= 0.4

    const targetOpacity = ready ? 1 : 0
    beamOpacityRef.current = THREE.MathUtils.lerp(beamOpacityRef.current, targetOpacity, 0.08)

    if (!ready || beamOpacityRef.current < 0.01) {
      beamGeom.setDrawRange(0, 0)
      attr.needsUpdate = true
      return
    }

    const midX = ((wrL.x + wrR.x) / 2 - 0.5) * w
    const midY = -((wrL.y + wrR.y) / 2 - 0.5) * h
    const midZ = 0.05
    // Proximité des mains → intensité (mains collées = forte) — mapped to beam spread
    const handDist = Math.hypot((wrL.x - wrR.x) * w, (wrL.y - wrR.y) * h)
    const intensity = THREE.MathUtils.clamp(1 - handDist * 0.5, 0.3, 1)
    const spread = 0.08 * (2 - intensity)

    for (let i = 0; i < BEAM_LINES; i++) {
      const offset = (i - (BEAM_LINES - 1) / 2) * spread
      const off = i * 6
      // Start point : midpoint wrists + petit offset orthogonal (variance)
      arr[off] = midX
      arr[off + 1] = midY + offset
      arr[off + 2] = midZ
      arr[off + 3] = targetX
      arr[off + 4] = targetY + offset * 0.2
      arr[off + 5] = targetZ
    }
    beamGeom.setDrawRange(0, BEAM_LINES * 2)
    attr.needsUpdate = true
  })

  return (
    <group>
      {/* Beam lines */}
      <lineSegments geometry={beamGeom}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Cible : sphère halo + core */}
      <mesh ref={targetHaloRef}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshBasicMaterial
          color={haloColor}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={targetSphereRef}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Overlay HTML — drei Html gère le mirror CSS global, on annule avec scale-x[-1] pour redresser */}
      <group ref={overlayGroupRef}>
        <Html
          center
          zIndexRange={[10, 0]}
          distanceFactor={3}
          style={{ pointerEvents: 'none', width: 'max-content', maxWidth: '220px' }}
        >
          <div className="scale-x-[-1] rounded-xl border border-white/15 bg-black/55 px-3 py-2 text-center shadow-lg backdrop-blur">
            <span className="text-2xl" aria-hidden="true">{glyph}</span>
            {typeLabel && (
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color }}>
                {typeLabel}
              </p>
            )}
            {label && <p className="mt-0.5 text-xs font-medium text-white/90">{label}</p>}
          </div>
        </Html>
      </group>
    </group>
  )
}
