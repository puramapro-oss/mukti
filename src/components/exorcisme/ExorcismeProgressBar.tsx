'use client'

import { EXORCISME_PHASES, type ExorcismePhaseName } from '@/lib/exorcisme-utils'

interface Props {
  phase: ExorcismePhaseName
}

export default function ExorcismeProgressBar({ phase }: Props) {
  const progress = ((EXORCISME_PHASES.findIndex(p => p.name === phase) + 1) / EXORCISME_PHASES.length) * 100

  return (
    <div aria-hidden className="absolute left-0 right-0 top-0 z-20 h-1 bg-white/[0.04]">
      <div
        className="h-full bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#FFD700] transition-[width]"
        style={{
          width: `${progress}%`,
          transitionDuration: '600ms',
        }}
      />
    </div>
  )
}
