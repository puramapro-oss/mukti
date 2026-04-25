'use client'

// MUKTI — COREPulseVisualizer : onde collective (particules selon participants_count).

import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface Props {
  participantsCount: number
  live?: boolean
}

export default function COREPulseVisualizer({ participantsCount, live = true }: Props) {
  const reducedMotion = useReducedMotion()
  const rings = useMemo(() => {
    const n = Math.min(6, 2 + Math.floor(Math.log10(Math.max(1, participantsCount)) * 2))
    return Array.from({ length: n })
  }, [participantsCount])

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-xs"
      data-testid="core-pulse-visualizer"
    >
      {rings.map((_, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute inset-0 rounded-full border border-[#7c3aed]/30"
          animate={
            reducedMotion
              ? { scale: 1, opacity: 0.25 }
              : live
                ? { scale: [0.4, 1.2], opacity: [0.6, 0] }
                : { scale: 1, opacity: 0.15 }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 4, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }
          }
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] shadow-[0_0_60px_rgba(124,58,237,0.5)]">
          <span className="text-center text-sm font-medium text-white">
            <span className="block text-2xl font-light">{participantsCount}</span>
            <span className="text-[10px] uppercase tracking-widest opacity-80">
              synchro
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
