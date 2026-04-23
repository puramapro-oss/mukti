'use client'

// MUKTI — G4.7 CeremonyCountdown
// Composant d'affichage du temps restant avant/pendant la cérémonie.
// Format :
//   upcoming : HH:MM:SS avant début
//   starting : grand chiffre 3 / 2 / 1
//   live     : MM:SS restants
//   finished : "terminée" + durée totale
//   cancelled: "annulée"

import type { CeremonyPhase } from '@/hooks/useCeremonySync'

interface Props {
  phase: CeremonyPhase
  secondsUntilStart: number
  secondsRemaining: number
  className?: string
}

export default function CeremonyCountdown({
  phase,
  secondsUntilStart,
  secondsRemaining,
  className,
}: Props) {
  if (phase === 'starting') {
    const n = Math.max(1, Math.min(3, secondsUntilStart || 1))
    return (
      <div
        role="timer"
        aria-live="assertive"
        data-testid="ceremony-starting"
        className={`flex flex-col items-center gap-2 ${className ?? ''}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--cyan)]">
          Ça commence
        </p>
        <p key={n} className="animate-pulse text-7xl font-bold text-white sm:text-8xl">
          {n}
        </p>
      </div>
    )
  }

  if (phase === 'live') {
    return (
      <div
        role="timer"
        aria-live="polite"
        data-testid="ceremony-live"
        className={`flex flex-col items-center gap-1 ${className ?? ''}`}
      >
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
          En direct
        </p>
        <p className="text-4xl font-bold tabular-nums text-white sm:text-5xl">
          {formatMinutes(secondsRemaining)}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-white/45">restant</p>
      </div>
    )
  }

  if (phase === 'upcoming') {
    return (
      <div
        role="timer"
        data-testid="ceremony-upcoming"
        className={`flex flex-col items-center gap-1 ${className ?? ''}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
          Ouverture dans
        </p>
        <p className="text-3xl font-bold tabular-nums text-white sm:text-4xl">
          {formatHours(secondsUntilStart)}
        </p>
      </div>
    )
  }

  if (phase === 'finished') {
    return (
      <div className={`flex flex-col items-center gap-1 ${className ?? ''}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Terminée</p>
        <p className="text-2xl font-medium text-white/70">🌿</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-1 ${className ?? ''}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-300">Annulée</p>
    </div>
  )
}

function formatMinutes(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatHours(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${s}s`
}
