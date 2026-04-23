'use client'

// MUKTI — G5.2 Pulse of Safety
// Micro-vague horizontale qui traverse l'écran à chaque expire longue.
// Ancrage neurologique subtil (brief section 5) — effet calme profond.
// Purement CSS + state React, aucun shader (perf friendly).

import { useEffect, useState } from 'react'
import type { BreathPhase } from './types'

export interface PulseOfSafetyProps {
  breathPhase: BreathPhase
  color: string
}

export default function PulseOfSafety({ breathPhase, color }: PulseOfSafetyProps) {
  const [pulseKey, setPulseKey] = useState(0)

  useEffect(() => {
    if (breathPhase === 'expire') {
      setPulseKey((k) => k + 1)
    }
  }, [breathPhase])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ mixBlendMode: 'screen' }}
    >
      <span
        key={pulseKey}
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
      `}</style>
    </div>
  )
}
