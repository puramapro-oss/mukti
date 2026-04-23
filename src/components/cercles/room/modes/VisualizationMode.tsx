'use client'

import { useEffect, useState } from 'react'

interface VisualizationModeProps {
  startedAt: string | null
  accentColor?: string
}

/** Géométrie sacrée pulsante (fleur de vie simplifiée), synchronisée via startedAt. */
export default function VisualizationMode({ startedAt, accentColor = '#7C3AED' }: VisualizationModeProps) {
  const [pulse, setPulse] = useState(1)

  useEffect(() => {
    const startMs = startedAt ? new Date(startedAt).getTime() : Date.now()
    function update() {
      const elapsedSec = (Date.now() - startMs) / 1000
      // cycle pulsation 8s
      const phase = (elapsedSec % 8) / 8
      const p = 0.85 + Math.sin(phase * Math.PI * 2) * 0.1
      setPulse(p)
    }
    update()
    const id = setInterval(update, 60)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-4">
      <svg
        width="220"
        height="220"
        viewBox="-100 -100 200 200"
        style={{ transform: `scale(${pulse})`, transition: 'transform 0.1s linear' }}
        aria-hidden
      >
        <defs>
          <radialGradient id="sacredGrad">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.7" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Cercle central */}
        <circle cx="0" cy="0" r="30" fill="url(#sacredGrad)" />
        <circle cx="0" cy="0" r="30" fill="none" stroke={accentColor} strokeOpacity="0.6" strokeWidth="1" />
        {/* 6 cercles autour (fleur de vie) */}
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 6
          const cx = Math.cos(angle) * 30
          const cy = Math.sin(angle) * 30
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="30"
              fill="none"
              stroke={accentColor}
              strokeOpacity="0.4"
              strokeWidth="1"
            />
          )
        })}
        {/* Couronne externe */}
        <circle cx="0" cy="0" r="80" fill="none" stroke={accentColor} strokeOpacity="0.25" strokeWidth="1" />
        <circle cx="0" cy="0" r="90" fill="none" stroke={accentColor} strokeOpacity="0.15" strokeWidth="0.5" />
      </svg>
      <p className="text-xs text-white/40">Visualisation commune — respire avec la forme</p>
    </div>
  )
}
