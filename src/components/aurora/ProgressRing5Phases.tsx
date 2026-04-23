'use client'

// MUKTI — G5.3 ProgressRing5Phases
// SVG ring 5 arcs proportionnels aux durées des phases AURORA.
// Arcs passés remplis, arc courant pulsant, arcs futurs estompés.

import { AURORA_PHASES } from '@/lib/constants'
import type { AuroraVariant, AuroraPhaseName } from '@/lib/constants'

export interface ProgressRing5PhasesProps {
  variant: AuroraVariant
  currentPhaseIndex: number // 0..4
  sessionElapsedSec: number
  sessionTotalSec: number
  color: string
  size?: number
  strokeWidth?: number
}

const GAP_DEG = 4 // espace entre arcs en degrés
const RADIUS_FACTOR = 0.42 // % du size pour rayon

export default function ProgressRing5Phases({
  variant,
  currentPhaseIndex,
  sessionElapsedSec,
  sessionTotalSec,
  color,
  size = 160,
  strokeWidth = 4,
}: ProgressRing5PhasesProps) {
  const phases = AURORA_PHASES[variant]
  const totalGap = phases.length * GAP_DEG
  const availableDeg = 360 - totalGap
  const center = size / 2
  const radius = size * RADIUS_FACTOR

  // Proportionne chaque arc à la durée de sa phase
  let cursor = -90 // départ haut (12h)
  const arcs = phases.map((p) => {
    const span = (p.duration_sec / sessionTotalSec) * availableDeg
    const start = cursor
    const end = cursor + span
    cursor = end + GAP_DEG
    return { phase: p.name, start_deg: start, end_deg: end, duration_sec: p.duration_sec }
  })

  const elapsedPct = Math.max(0, Math.min(1, sessionElapsedSec / sessionTotalSec))

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none"
      aria-hidden
    >
      {/* Arcs base (dim) */}
      {arcs.map((arc, i) => (
        <ArcPath
          key={`bg-${arc.phase}`}
          cx={center}
          cy={center}
          r={radius}
          startDeg={arc.start_deg}
          endDeg={arc.end_deg}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={i < currentPhaseIndex ? 0.55 : i === currentPhaseIndex ? 0.25 : 0.1}
        />
      ))}

      {/* Arc courant — pulse */}
      {arcs[currentPhaseIndex] && (
        <ArcPath
          cx={center}
          cy={center}
          r={radius}
          startDeg={arcs[currentPhaseIndex].start_deg}
          endDeg={arcs[currentPhaseIndex].end_deg}
          stroke={color}
          strokeWidth={strokeWidth + 1}
          opacity={1}
          animated
        />
      )}

      {/* Glyph dot à la position elapsed (sur le cercle entier) */}
      <ElapsedDot
        cx={center}
        cy={center}
        r={radius}
        pct={elapsedPct}
        color={color}
      />
    </svg>
  )
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function ArcPath({
  cx,
  cy,
  r,
  startDeg,
  endDeg,
  stroke,
  strokeWidth,
  opacity,
  animated,
}: {
  cx: number
  cy: number
  r: number
  startDeg: number
  endDeg: number
  stroke: string
  strokeWidth: number
  opacity: number
  animated?: boolean
}) {
  const start = polar(cx, cy, r, startDeg)
  const end = polar(cx, cy, r, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  const d = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
  return (
    <path
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      opacity={opacity}
      style={
        animated
          ? { filter: `drop-shadow(0 0 6px ${stroke})`, animation: 'mukti-ring-pulse 2.5s ease-in-out infinite' }
          : undefined
      }
    >
      {animated && (
        <style>{`@keyframes mukti-ring-pulse { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }`}</style>
      )}
    </path>
  )
}

function ElapsedDot({
  cx,
  cy,
  r,
  pct,
  color,
}: {
  cx: number
  cy: number
  r: number
  pct: number
  color: string
}) {
  const deg = -90 + pct * 360
  const pos = polar(cx, cy, r, deg)
  return (
    <circle
      cx={pos.x}
      cy={pos.y}
      r={4}
      fill={color}
      style={{ filter: `drop-shadow(0 0 6px ${color})` }}
    />
  )
}

/** Helper : nom FR court pour les labels au-dessus du ring. */
export function phaseLabelShort(name: AuroraPhaseName | 'idle'): string {
  switch (name) {
    case 'armement':
      return 'Armement'
    case 'double_sigh':
      return 'Double Sigh'
    case 'resonance_core':
      return 'Résonance'
    case 'omega_lock':
      return 'Omega Lock'
    case 'glide_out':
      return 'Glide Out'
    default:
      return 'Prêt·e ?'
  }
}
