'use client'

import { useState } from 'react'
import { RituelTimer } from './RituelTimer'
import { RituelJournalForm } from './RituelJournalForm'

interface Props {
  themeColor: string
  themeSlug: string
  weekIso: string
  participantsCount: number
  totalMinutes: number
}

export function RituelHebdoClient({ themeColor, themeSlug, weekIso, participantsCount, totalMinutes }: Props) {
  const [minutesCompleted, setMinutesCompleted] = useState(0)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <RituelTimer
        themeColor={themeColor}
        onComplete={m => setMinutesCompleted(m)}
      />
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Cette semaine</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-2xl font-semibold text-white" data-testid="rituel-participants-count">{participantsCount}</p>
              <p className="text-xs text-white/50">participant{participantsCount > 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{totalMinutes}</p>
              <p className="text-xs text-white/50">minutes offertes au monde</p>
            </div>
          </div>
        </div>

        {minutesCompleted > 0 ? (
          <RituelJournalForm
            minutesPracticed={minutesCompleted}
            weekIso={weekIso}
            themeSlug={themeSlug}
          />
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/60 backdrop-blur-xl">
            <p>
              Quand tu auras terminé le temps, tu pourras poser une intention et rejoindre le rituel du monde.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
