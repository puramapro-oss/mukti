'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, Check } from 'lucide-react'
import { prefersReducedMotion } from '@/lib/a11y'

interface Props {
  themeColor: string
  onComplete: (minutes: number) => void
  minutesTarget?: number
}

export function RituelTimer({ themeColor, onComplete, minutesTarget = 10 }: Props) {
  const [remaining, setRemaining] = useState(minutesTarget * 60)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setReducedMotion(prefersReducedMotion())
  }, [])

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current!)
          setRunning(false)
          setDone(true)
          onComplete(minutesTarget)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running, minutesTarget, onComplete])

  function toggle() {
    if (done) return
    setRunning(r => !r)
  }

  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
    setDone(false)
    setRemaining(minutesTarget * 60)
  }

  const mm = Math.floor(remaining / 60).toString().padStart(2, '0')
  const ss = (remaining % 60).toString().padStart(2, '0')
  const progress = 1 - remaining / (minutesTarget * 60)

  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
      <div className="relative flex h-56 w-56 items-center justify-center">
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx={50}
            cy={50}
            r={46}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={3}
            fill="none"
          />
          <circle
            cx={50}
            cy={50}
            r={46}
            stroke={themeColor}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={289}
            strokeDashoffset={289 * (1 - progress)}
            style={{
              transition: reducedMotion ? 'none' : 'stroke-dashoffset 1s linear',
            }}
          />
        </svg>
        <div className="text-center">
          <p
            className="font-mono text-5xl font-semibold text-white"
            aria-live="polite"
            aria-label={`${mm} minutes ${ss} secondes restantes`}
          >
            {mm}:{ss}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
            {done ? 'Terminé' : running ? 'En cours' : 'Prêt'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={done}
          data-testid="rituel-timer-toggle"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={running ? 'Pause' : done ? 'Terminé' : 'Démarrer'}
        >
          {done ? <Check className="h-4 w-4" aria-hidden="true" /> : running ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          {done ? 'Terminé' : running ? 'Pause' : 'Démarrer'}
        </button>
        <button
          type="button"
          onClick={reset}
          data-testid="rituel-timer-reset"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/70 hover:border-white/40 hover:text-white"
          aria-label="Réinitialiser"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Recommencer
        </button>
      </div>
    </div>
  )
}
