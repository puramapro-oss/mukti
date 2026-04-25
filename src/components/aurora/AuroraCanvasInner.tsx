'use client'

// MUKTI — G5.2 AURORA Canvas interne
// Compose FractalMesh + EventHorizon + ParticleField dans un Canvas r3f.
// Piloté par un `breathState` externe (driver = useAuroraPhase en G5.3).
// Chargé UNIQUEMENT via dynamic import ssr:false (WebGL = browser only).

import { Canvas } from '@react-three/fiber'
import FractalMesh from './FractalMesh'
import EventHorizon from './EventHorizon'
import ParticleField from './ParticleField'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { BreathState } from './types'

export interface AuroraCanvasInnerProps {
  /** État courant du souffle (piloté par le parent). */
  breathState: BreathState
  /** Couleur primaire variante AURORA (hex). */
  color: string
  /** Couleur secondaire (halo event horizon). Défaut = color si omis. */
  accentColor?: string
  /** Assombrit progressivement la scène (sleep ramp-down final). 0-1. */
  darkening?: number
  /** Désactive ParticleField sur appareils faibles (param UI). */
  particlesEnabled?: boolean
  /** Classe CSS extra sur wrapper. */
  className?: string
}

export default function AuroraCanvasInner({
  breathState,
  color,
  accentColor,
  darkening = 0,
  particlesEnabled = true,
  className,
}: AuroraCanvasInnerProps) {
  const halo = accentColor ?? color
  const dark = Math.max(0, Math.min(0.85, darkening))
  const reducedMotion = useReducedMotion()
  const particlesActive = particlesEnabled && !reducedMotion
  // Overlay sombre : appliqué via un black sprite plane fullscreen à l'extérieur du Canvas pour perf.
  return (
    <div className={`relative h-full w-full ${className ?? ''}`}>
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: '#05050a' }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 3, 4]} intensity={0.8} color={color} />
        <pointLight position={[-2, -2, 3]} intensity={0.3} color={halo} />

        <FractalMesh
          color={color}
          breathPhase={breathState.phase}
          phaseProgress={breathState.progress}
        />
        <EventHorizon
          breathPhase={breathState.phase}
          phaseProgress={breathState.progress}
          accentColor={halo}
        />
        {particlesActive && (
          <ParticleField
            breathPhase={breathState.phase}
            phaseProgress={breathState.progress}
            color={halo}
          />
        )}
      </Canvas>

      {/* Overlay darkening (hors Canvas → rendu DOM plus économique que shader fullscreen) */}
      {dark > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: '#000', opacity: dark, transition: 'opacity 800ms ease-out' }}
        />
      )}
    </div>
  )
}
