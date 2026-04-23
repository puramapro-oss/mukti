'use client'

// MUKTI — G4.3 Mains fantômes
// 2 × (LineSegments 21 landmarks + 5 Spheres aux extrémités de doigts)
// Main gauche = cyan, main droite = violet (cohérence palette MUKTI).
// Update impératif useFrame — aucun re-render React.

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useLatestFrame } from '@/lib/ar/frame-context'
import { HAND_CONNECTIONS, type HandResult } from '@/lib/ar/types'

const HAND_SEG_COUNT = HAND_CONNECTIONS.length
const HAND_VERT_COUNT = HAND_SEG_COUNT * 2
const HAND_ARR_LEN = HAND_VERT_COUNT * 3
const FINGER_TIPS = [4, 8, 12, 16, 20] as const

const COLORS = {
  left: '#06B6D4',
  right: '#A78BFA',
} as const

export default function PhantomHands() {
  return (
    <>
      <HandTrack side="left" />
      <HandTrack side="right" />
    </>
  )
}

function HandTrack({ side }: { side: 'left' | 'right' }) {
  const frameRef = useLatestFrame()
  const { viewport } = useThree()

  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(HAND_ARR_LEN)
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    g.setDrawRange(0, 0)
    return g
  }, [])

  const tipRefs = useRef<Array<THREE.Mesh | null>>([null, null, null, null, null])

  useFrame(() => {
    const frame = frameRef.current
    const hand: HandResult | undefined = frame?.hands.hands.find((h) => h.side === side)
    const positionAttr = lineGeom.attributes.position as THREE.BufferAttribute

    if (!hand || hand.landmarks.length < 21) {
      lineGeom.setDrawRange(0, 0)
      positionAttr.needsUpdate = true
      for (const mesh of tipRefs.current) {
        if (mesh) mesh.visible = false
      }
      return
    }

    const w = viewport.width
    const h = viewport.height
    const arr = positionAttr.array as Float32Array
    let drawn = 0

    for (let i = 0; i < HAND_SEG_COUNT; i++) {
      const conn = HAND_CONNECTIONS[i]!
      const a = conn[0]
      const b = conn[1]
      const p1 = hand.landmarks[a]
      const p2 = hand.landmarks[b]
      if (!p1 || !p2) continue
      const off = drawn * 6
      arr[off] = (p1.x - 0.5) * w
      arr[off + 1] = -(p1.y - 0.5) * h
      arr[off + 2] = 0
      arr[off + 3] = (p2.x - 0.5) * w
      arr[off + 4] = -(p2.y - 0.5) * h
      arr[off + 5] = 0
      drawn++
    }
    lineGeom.setDrawRange(0, drawn * 2)
    positionAttr.needsUpdate = true

    for (let i = 0; i < FINGER_TIPS.length; i++) {
      const mesh = tipRefs.current[i]
      if (!mesh) continue
      const lm = hand.landmarks[FINGER_TIPS[i]!]
      if (!lm) {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      mesh.position.x = (lm.x - 0.5) * w
      mesh.position.y = -(lm.y - 0.5) * h
      mesh.position.z = 0.02
      // pulsation subtile via scale dependant du temps
      const t = (frame?.timestampMs ?? 0) / 1000
      const pulse = 1 + Math.sin(t * 4 + i) * 0.15
      mesh.scale.setScalar(pulse)
    }
  })

  const color = COLORS[side]

  return (
    <group>
      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      {FINGER_TIPS.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            tipRefs.current[i] = el
          }}
          visible={false}
        >
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.75}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
