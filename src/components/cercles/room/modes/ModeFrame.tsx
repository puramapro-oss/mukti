'use client'

import type { ReactNode } from 'react'

interface ModeFrameProps {
  children: ReactNode
  timerLabel?: string
  progressPercent: number
  accentColor?: string
}

export default function ModeFrame({ children, timerLabel, progressPercent, accentColor = '#7C3AED' }: ModeFrameProps) {
  return (
    <div className="relative flex w-full flex-col items-center gap-6 rounded-3xl border border-white/[0.06] bg-black/30 p-6 sm:p-8">
      {/* Progress ring */}
      {timerLabel !== undefined && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear"
              style={{
                width: `${progressPercent}%`,
                background: `linear-gradient(90deg, ${accentColor}, #06B6D4)`,
              }}
            />
          </div>
          <span className="text-[11px] font-mono text-white/55">{timerLabel}</span>
        </div>
      )}
      {children}
    </div>
  )
}
