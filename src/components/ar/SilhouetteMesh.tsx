'use client'

// MUKTI — G4.3 Silhouette énergétique
// Dessine les 33 POSE_CONNECTIONS en lignes additives dans le Canvas r3f.
// Mapping landmark [0,1] → viewport world. Glow via blending AdditiveBlending + 2 passes (core + halo).
// Les vertices invisibles (visibility < 0.3) sont écroulés à l'origine — pas de segment rendu.

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useLatestFrame } from '@/lib/ar/frame-context'
import { POSE_CONNECTIONS } from '@/lib/ar/types'

const SEG_COUNT = POSE_CONNECTIONS.length
const VERT_COUNT = SEG_COUNT * 2
const ARR_LEN = VERT_COUNT * 3

interface Props {
  color?: string
  haloColor?: string
  coreOpacity?: number
  haloOpacity?: number
  visibilityThreshold?: number
}

export default function SilhouetteMesh({
  color = '#06B6D4',
  haloColor = '#7C3AED',
  coreOpacity = 0.95,
  haloOpacity = 0.35,
  visibilityThreshold = 0.3,
}: Props) {
  const frameRef = useLatestFrame()
  const { viewport } = useThree()

  // Deux géométries partagées : core (cyan) + halo (violet translucide)
  const coreGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(ARR_LEN)
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    g.setDrawRange(0, 0)
    return g
  }, [])

  const haloGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(ARR_LEN)
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    g.setDrawRange(0, 0)
    return g
  }, [])

  const coreAttrRef = useRef<THREE.BufferAttribute | null>(null)
  const haloAttrRef = useRef<THREE.BufferAttribute | null>(null)

  useFrame(() => {
    const core = coreGeom.attributes.position as THREE.BufferAttribute
    const halo = haloGeom.attributes.position as THREE.BufferAttribute
    coreAttrRef.current = core
    haloAttrRef.current = halo

    const pose = frameRef.current?.pose.landmarks
    if (!pose || pose.length < 33) {
      coreGeom.setDrawRange(0, 0)
      haloGeom.setDrawRange(0, 0)
      core.needsUpdate = true
      halo.needsUpdate = true
      return
    }

    const w = viewport.width
    const h = viewport.height
    const coreArr = core.array as Float32Array
    const haloArr = halo.array as Float32Array

    let drawn = 0
    for (let i = 0; i < SEG_COUNT; i++) {
      const conn = POSE_CONNECTIONS[i]!
      const a = conn[0]
      const b = conn[1]
      const p1 = pose[a]
      const p2 = pose[b]
      if (!p1 || !p2) continue
      if ((p1.visibility ?? 1) < visibilityThreshold) continue
      if ((p2.visibility ?? 1) < visibilityThreshold) continue

      const off = drawn * 6
      const x1 = (p1.x - 0.5) * w
      const y1 = -(p1.y - 0.5) * h
      const x2 = (p2.x - 0.5) * w
      const y2 = -(p2.y - 0.5) * h

      coreArr[off] = x1
      coreArr[off + 1] = y1
      coreArr[off + 2] = 0
      coreArr[off + 3] = x2
      coreArr[off + 4] = y2
      coreArr[off + 5] = 0

      // halo légèrement décalé pour créer un effet de profondeur
      haloArr[off] = x1
      haloArr[off + 1] = y1
      haloArr[off + 2] = -0.01
      haloArr[off + 3] = x2
      haloArr[off + 4] = y2
      haloArr[off + 5] = -0.01

      drawn++
    }

    coreGeom.setDrawRange(0, drawn * 2)
    haloGeom.setDrawRange(0, drawn * 2)
    core.needsUpdate = true
    halo.needsUpdate = true
  })

  return (
    <group>
      {/* Halo violet (plus large, transparent) */}
      <lineSegments geometry={haloGeom}>
        <lineBasicMaterial
          color={haloColor}
          transparent
          opacity={haloOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          linewidth={2}
        />
      </lineSegments>
      {/* Core cyan (brillant) */}
      <lineSegments geometry={coreGeom}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={coreOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          linewidth={1}
        />
      </lineSegments>
    </group>
  )
}
