// MUKTI — COREPhaseIndicator : affiche la phase courante du Moment Z.

import { CORE_PHASES, type CorePhase } from '@/lib/constants'

interface Props {
  currentPhase: CorePhase | 'finished'
}

export default function COREPhaseIndicator({ currentPhase }: Props) {
  const idx = CORE_PHASES.findIndex(p => p.id === currentPhase)
  const isFinished = currentPhase === 'finished'

  return (
    <div className="w-full" data-testid="core-phase-indicator">
      <div className="flex justify-between gap-1">
        {CORE_PHASES.map((p, i) => {
          const active = !isFinished && i === idx
          const past = isFinished || i < idx
          return (
            <div
              key={p.id}
              className={`flex-1 rounded-full h-1.5 transition-colors ${
                active
                  ? 'bg-[#7c3aed]'
                  : past
                    ? 'bg-[#06b6d4]/70'
                    : 'bg-white/10'
              }`}
              aria-label={p.name}
            />
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/55">
        <span>
          {isFinished
            ? 'Terminé'
            : idx >= 0
              ? CORE_PHASES[idx]?.name
              : CORE_PHASES[0]?.name}
        </span>
        <span className="text-white/35">
          {isFinished ? '—' : `${idx + 1} / ${CORE_PHASES.length}`}
        </span>
      </div>
    </div>
  )
}
