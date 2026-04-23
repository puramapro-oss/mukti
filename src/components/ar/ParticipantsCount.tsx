'use client'

// MUKTI — G4.7 ParticipantsCount
// Compteur live de participants présents dans une cérémonie.
// Pulse discret quand le nombre change.

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'

interface Props {
  count: number
  className?: string
}

export default function ParticipantsCount({ count, className }: Props) {
  const [justChanged, setJustChanged] = useState(false)

  useEffect(() => {
    if (count === 0) return
    setJustChanged(true)
    const t = window.setTimeout(() => setJustChanged(false), 600)
    return () => window.clearTimeout(t)
  }, [count])

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm backdrop-blur transition-all ${
        justChanged ? 'scale-[1.05] border-[var(--cyan)]/50 bg-[var(--cyan)]/10' : ''
      } ${className ?? ''}`}
      role="status"
      aria-live="polite"
      data-testid="participants-count"
    >
      <Users className="h-3.5 w-3.5 text-[var(--cyan)]" />
      <span className="font-mono tabular-nums text-white">{count}</span>
      <span className="text-xs text-white/55">{count > 1 ? 'présences' : 'présence'}</span>
    </div>
  )
}
