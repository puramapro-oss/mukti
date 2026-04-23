'use client'

interface PureIntentionModeProps {
  focusedName: string | null
  intentionWord: string
  secondsRemaining: number
}

export default function PureIntentionMode({ focusedName, intentionWord, secondsRemaining }: PureIntentionModeProps) {
  const mm = Math.floor(secondsRemaining / 60)
  const ss = secondsRemaining % 60
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-[10px] uppercase tracking-[0.4em] text-white/30">Intention pure</p>
      <p
        className="text-5xl font-light uppercase tracking-[0.3em] text-white/90 sm:text-6xl"
        style={{ letterSpacing: '0.3em' }}
      >
        {intentionWord}
      </p>
      {focusedName && (
        <p className="text-sm text-white/40">pour <span className="text-white/70">{focusedName}</span></p>
      )}
      <p className="mt-2 font-mono text-4xl font-light text-white/45">
        {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
      </p>
    </div>
  )
}
