'use client'

// MUKTI — G4.4 Species Decorations (r3f)
// 4 décorations : SpeciesEars, SpeciesTail, SpeciesWings, GuardianAura.
// Chaque décoration lit le frame courant via FrameContext et se positionne
// par rapport aux landmarks-clés (nez, épaules, hanches).

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useLatestFrame } from '@/lib/ar/frame-context'
import type { Landmark } from '@/lib/ar/types'

interface DecorationProps {
  color?: string
  opacity?: number
}

// ---------------------------------------------------------------------------
// SpeciesEars — 2 triangles pointus au-dessus du nez/tête
// Landmarks : 0=nez, 2=oeil G, 5=oeil D, 7=oreille G, 8=oreille D
// ---------------------------------------------------------------------------
export function SpeciesEars({ color = '#F59E0B', opacity = 0.85 }: DecorationProps) {
  const frameRef = useLatestFrame()
  const { viewport } = useThree()
  const leftEarRef = useRef<THREE.Mesh | null>(null)
  const rightEarRef = useRef<THREE.Mesh | null>(null)

  const triangleGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const verts = new Float32Array([
      -0.12, 0, 0,
      0.12, 0, 0,
      0, 0.28, 0,
    ])
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    g.computeVertexNormals()
    return g
  }, [])

  useFrame(() => {
    const pose = frameRef.current?.pose.landmarks
    if (!pose || pose.length < 33) {
      if (leftEarRef.current) leftEarRef.current.visible = false
      if (rightEarRef.current) rightEarRef.current.visible = false
      return
    }
    const nose = pose[0]
    const leftEar = pose[7]
    const rightEar = pose[8]
    if (!nose || !leftEar || !rightEar) return

    const w = viewport.width
    const h = viewport.height

    if (leftEarRef.current && (leftEar.visibility ?? 1) > 0.3) {
      leftEarRef.current.visible = true
      leftEarRef.current.position.set(
        (leftEar.x - 0.5) * w,
        -(leftEar.y - 0.5) * h + 0.1,
        0.05,
      )
    } else if (leftEarRef.current) {
      leftEarRef.current.visible = false
    }

    if (rightEarRef.current && (rightEar.visibility ?? 1) > 0.3) {
      rightEarRef.current.visible = true
      rightEarRef.current.position.set(
        (rightEar.x - 0.5) * w,
        -(rightEar.y - 0.5) * h + 0.1,
        0.05,
      )
    } else if (rightEarRef.current) {
      rightEarRef.current.visible = false
    }
  })

  return (
    <group>
      <mesh ref={leftEarRef} geometry={triangleGeom} visible={false}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={rightEarRef} geometry={triangleGeom} visible={false}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// SpeciesTail — courbe sinusoïdale derrière les hanches (23,24)
// ---------------------------------------------------------------------------
export function SpeciesTail({ color = '#A78BFA', opacity = 0.7 }: DecorationProps) {
  const frameRef = useLatestFrame()
  const { viewport } = useThree()
  const TAIL_POINTS = 16

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(TAIL_POINTS * 3)
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    g.setDrawRange(0, 0)
    return g
  }, [])

  useFrame((state) => {
    const pose = frameRef.current?.pose.landmarks
    const attr = geom.attributes.position as THREE.BufferAttribute
    if (!pose || pose.length < 33) {
      geom.setDrawRange(0, 0)
      attr.needsUpdate = true
      return
    }
    const hipL = pose[23]
    const hipR = pose[24]
    if (!hipL || !hipR) return
    if ((hipL.visibility ?? 0) < 0.3 && (hipR.visibility ?? 0) < 0.3) {
      geom.setDrawRange(0, 0)
      attr.needsUpdate = true
      return
    }

    const baseX = ((hipL.x + hipR.x) / 2 - 0.5) * viewport.width
    const baseY = -((hipL.y + hipR.y) / 2 - 0.5) * viewport.height
    const t = state.clock.elapsedTime
    const arr = attr.array as Float32Array

    for (let i = 0; i < TAIL_POINTS; i++) {
      const ratio = i / (TAIL_POINTS - 1)
      const distance = ratio * 1.1
      const sway = Math.sin(t * 2 + ratio * 4) * 0.18 * ratio
      arr[i * 3] = baseX + sway
      arr[i * 3 + 1] = baseY - distance
      arr[i * 3 + 2] = -0.02
    }
    geom.setDrawRange(0, TAIL_POINTS)
    attr.needsUpdate = true
  })

  return (
    <line>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </line>
  )
}

// ---------------------------------------------------------------------------
// SpeciesWings — 2 fans triangulaires depuis les épaules (11,12), flottent au rythme
// ---------------------------------------------------------------------------
export function SpeciesWings({ color = '#10B981', opacity = 0.55 }: DecorationProps) {
  const frameRef = useLatestFrame()
  const { viewport } = useThree()

  // 8 rayons par aile
  const RAY_COUNT = 8
  const POINTS_PER_WING = RAY_COUNT * 2 // segments (base, tip) par rayon

  const leftGeom = useMemo(() => makeLineGeom(POINTS_PER_WING), [POINTS_PER_WING])
  const rightGeom = useMemo(() => makeLineGeom(POINTS_PER_WING), [POINTS_PER_WING])

  useFrame((state) => {
    const pose = frameRef.current?.pose.landmarks
    if (!pose || pose.length < 33) {
      leftGeom.setDrawRange(0, 0)
      rightGeom.setDrawRange(0, 0)
      ;(leftGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true
      ;(rightGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true
      return
    }
    const t = state.clock.elapsedTime
    const w = viewport.width
    const h = viewport.height
    const shL = pose[11]
    const shR = pose[12]
    const elL = pose[13]
    const elR = pose[14]
    const wrL = pose[15]
    const wrR = pose[16]
    if (!shL || !shR || !elL || !elR || !wrL || !wrR) return

    updateWing(leftGeom, RAY_COUNT, shL, elL, wrL, w, h, t, true)
    updateWing(rightGeom, RAY_COUNT, shR, elR, wrR, w, h, t, false)
  })

  return (
    <group>
      <lineSegments geometry={leftGeom}>
        <lineBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={rightGeom}>
        <lineBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
    </group>
  )
}

function makeLineGeom(vertCount: number) {
  const g = new THREE.BufferGeometry()
  const arr = new Float32Array(vertCount * 3)
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  g.setDrawRange(0, 0)
  return g
}

function updateWing(
  geom: THREE.BufferGeometry,
  rayCount: number,
  shoulder: Landmark,
  elbow: Landmark,
  wrist: Landmark,
  w: number,
  h: number,
  t: number,
  isLeft: boolean,
) {
  const attr = geom.attributes.position as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  const sX = (shoulder.x - 0.5) * w
  const sY = -(shoulder.y - 0.5) * h
  const wX = (wrist.x - 0.5) * w
  const wY = -(wrist.y - 0.5) * h
  const extent = Math.hypot(wX - sX, wY - sY)
  const flap = Math.sin(t * 3) * 0.25
  const dirX = isLeft ? -1 : 1

  for (let i = 0; i < rayCount; i++) {
    const ratio = i / (rayCount - 1)
    const baseX = sX
    const baseY = sY - ratio * extent * 0.3
    const tipAngle = (isLeft ? -1 : 1) * (ratio * 1.3 + flap)
    const tipX = baseX + dirX * extent * Math.cos(tipAngle)
    const tipY = baseY - extent * Math.sin(Math.abs(tipAngle)) * 0.6 - elbow.x * 0
    const off = i * 6
    arr[off] = baseX
    arr[off + 1] = baseY
    arr[off + 2] = -0.03
    arr[off + 3] = tipX
    arr[off + 4] = tipY
    arr[off + 5] = -0.03
  }
  geom.setDrawRange(0, rayCount * 2)
  attr.needsUpdate = true
}

// ---------------------------------------------------------------------------
// GuardianAura — gros anneau protecteur autour du centre de masse
// ---------------------------------------------------------------------------
export function GuardianAura({ color = '#14B8A6', opacity = 0.35 }: DecorationProps) {
  const frameRef = useLatestFrame()
  const { viewport } = useThree()
  const ringRef = useRef<THREE.Mesh | null>(null)
  const innerRef = useRef<THREE.Mesh | null>(null)

  useFrame((state) => {
    const pose = frameRef.current?.pose.landmarks
    if (!pose || pose.length < 33) {
      if (ringRef.current) ringRef.current.visible = false
      if (innerRef.current) innerRef.current.visible = false
      return
    }
    const hipL = pose[23]
    const hipR = pose[24]
    const shL = pose[11]
    const shR = pose[12]
    if (!hipL || !hipR || !shL || !shR) return

    const cx = ((hipL.x + hipR.x + shL.x + shR.x) / 4 - 0.5) * viewport.width
    const cy = -((hipL.y + hipR.y + shL.y + shR.y) / 4 - 0.5) * viewport.height
    const t = state.clock.elapsedTime
    const pulse = 1 + Math.sin(t * 1.5) * 0.04

    if (ringRef.current) {
      ringRef.current.visible = true
      ringRef.current.position.set(cx, cy, -0.05)
      ringRef.current.scale.setScalar(pulse)
      ringRef.current.rotation.z = t * 0.05
    }
    if (innerRef.current) {
      innerRef.current.visible = true
      innerRef.current.position.set(cx, cy, -0.04)
      innerRef.current.scale.setScalar(pulse * 0.75)
      innerRef.current.rotation.z = -t * 0.08
    }
  })

  return (
    <group>
      <mesh ref={ringRef} visible={false}>
        <ringGeometry args={[1.35, 1.5, 64]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={innerRef} visible={false}>
        <ringGeometry args={[1.15, 1.2, 64]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}
