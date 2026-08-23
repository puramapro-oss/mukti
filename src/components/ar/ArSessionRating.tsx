'use client'

import { Loader2 } from 'lucide-react'

interface ArSessionRatingProps {
  intensity: number | null
  completionStatus: 'idle' | 'saving' | 'saved' | 'error'
  completionMsg: string | null
  onSubmitRating: (value: number) => void
}

export default function ArSessionRating({
  intensity,
  completionStatus,
  completionMsg,
  onSubmitRating,
}: ArSessionRatingProps) {
  return (
    <>
      {intensity === null && completionStatus !== 'saved' && (
        <div role="radiogroup" aria-label="Intensité ressentie" className="flex gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onSubmitRating(v)}
              data-testid={`intensity-${v}`}
              className="h-11 w-11 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-white/80 transition-all hover:scale-110 hover:bg-white/10"
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {completionStatus === 'saving' && (
        <p className="text-xs text-white/50">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Enregistrement…
        </p>
      )}
      {completionMsg && (
        <p
          role={completionStatus === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-3 py-2 text-xs ${
            completionStatus === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {completionMsg}
        </p>
      )}
    </>
  )
}
