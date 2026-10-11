'use client'

// MUKTI — G5.2 Pulse of Safety
// Micro-vague horizontale qui traverse l'écran à chaque expire longue.
// Repère visuel facultatif, sans effet thérapeutique établi.
// Purement CSS, aucun shader.

import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { BreathPhase } from './types'

export interface PulseOfSafetyProps {
  breathPhase: BreathPhase
  color: string
}

export default function PulseOfSafety({ breathPhase, color }: PulseOfSafetyProps) {
  const reducedMotion = useReducedMotion()
  if (breathPhase !== 'expire' || reducedMotion) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ mixBlendMode: 'screen' }}
    >
      <span
        className="mukti-aurora-pulse"
        style={{ ['--pulse-color' as string]: color }}
      />
      <style jsx>{`
        .mukti-aurora-pulse {
          position: absolute;
          inset: 50% 0 auto 0;
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--pulse-color) 50%,
            transparent 100%
          );
          opacity: 0;
          transform: translateY(-50%) scaleX(0.4);
          animation: aurora-pulse 3.2s ease-out forwards;
          filter: blur(1px);
        }
        @keyframes aurora-pulse {
          0% {
            opacity: 0;
            transform: translateY(-50%) scaleX(0.2);
          }
          20% {
            opacity: 0.7;
          }
          100% {
            opacity: 0;
            transform: translateY(-50%) scaleX(1.2);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .mukti-aurora-pulse {
            animation: none;
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
