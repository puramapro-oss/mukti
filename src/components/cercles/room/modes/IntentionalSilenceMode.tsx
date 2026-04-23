'use client'

interface IntentionalSilenceModeProps {
  focusedName: string | null
  secondsRemaining: number
}

export default function IntentionalSilenceMode({ focusedName, secondsRemaining }: IntentionalSilenceModeProps) {
  const mm = Math.floor(secondsRemaining / 60)
  const ss = secondsRemaining % 60
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">Silence intentionnel</p>
      {focusedName && (
        <p className="text-3xl font-light text-white/90 sm:text-4xl">{focusedName}</p>
      )}
      <p className="font-mono text-5xl font-light text-white/60 sm:text-6xl">
        {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
      </p>
    </div>
  )
}
