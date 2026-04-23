'use client'

import { useEffect, useState } from 'react'

interface BreathSyncModeProps {
  startedAt: string | null
  accentColor?: string
}

// 4-7-8 respiration : inspire 4s, retention 7s, expire 8s. Cycle total 19s.
const PHASES = [
  { name: 'Inspire', dur: 4, scale: 1.3, color: '#06B6D4' },
  { name: 'Retiens', dur: 7, scale: 1.3, color: '#7C3AED' },
  { name: 'Expire', dur: 8, scale: 0.75, color: '#10B981' },
] as const
const CYCLE_SEC = PHASES.reduce((s, p) => s + p.dur, 0)

export default function BreathSyncMode({ startedAt, accentColor = '#7C3AED' }: BreathSyncModeProps) {
  const [phase, setPhase] = useState<{ name: string; remaining: number; scale: number; color: string }>({
    name: 'Inspire',
    remaining: 4,
    scale: 1,
    color: accentColor,
  })

  useEffect(() => {
    const startMs = startedAt ? new Date(startedAt).getTime() : Date.now()
    function update() {
      const elapsedSec = (Date.now() - startMs) / 1000
      const inCycle = elapsedSec % CYCLE_SEC
      let acc = 0
      for (const p of PHASES) {
        if (inCycle < acc + p.dur) {
          const r = acc + p.dur - inCycle
          setPhase({ name: p.name, remaining: Math.ceil(r), scale: p.scale, color: p.color })
          return
        }
        acc += p.dur
      }
    }
    update()
    const id = setInterval(update, 250)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-4">
      <div className="relative flex h-52 w-52 items-center justify-center sm:h-60 sm:w-60">
        <div
          className="absolute inset-0 rounded-full transition-transform duration-1000 ease-in-out"
          style={{
            transform: `scale(${phase.scale})`,
            background: `radial-gradient(circle, ${phase.color}40 0%, transparent 70%)`,
          }}
          aria-hidden
        />
        <div
          className="absolute inset-8 rounded-full border transition-transform duration-1000 ease-in-out"
          style={{
            transform: `scale(${phase.scale})`,
            borderColor: phase.color,
            boxShadow: `0 0 40px ${phase.color}60`,
          }}
          aria-hidden
        />
        <div className="relative text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-white/60">{phase.name}</p>
          <p className="mt-1 text-5xl font-light text-white">{phase.remaining}</p>
        </div>
      </div>
      <p className="text-xs text-white/40">Respiration 4-7-8 — synchronisée avec tous les participants</p>
    </div>
  )
}
