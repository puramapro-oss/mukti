'use client'

import { motion } from 'framer-motion'
import { Flame, Trophy } from 'lucide-react'
import { MILESTONES, type MilestoneId } from '@/lib/constants'

interface Props {
  currentDays: number
  bestDays: number
  nextMilestone: MilestoneId | null
  daysAway: number | null
}

export default function StreakCounter({ currentDays, bestDays, nextMilestone, daysAway }: Props) {
  const milestoneTarget = MILESTONES.find(m => m.id === nextMilestone)?.days ?? null
  const progressPercent =
    milestoneTarget && daysAway !== null
      ? Math.max(0, Math.min(100, ((milestoneTarget - daysAway) / milestoneTarget) * 100))
      : 100

  const size = 220
  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (progressPercent / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-6" data-testid="streak-counter">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 drop-shadow-[0_0_30px_rgba(124,58,237,0.35)]">
          <defs>
            <linearGradient id="streak-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#streak-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="flex items-baseline gap-1"
          >
            <span className="text-6xl font-semibold text-[var(--text-primary)]">{currentDays}</span>
            <span className="text-lg text-[var(--text-muted)]">j</span>
          </motion.div>
          <p className="mt-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">libre</p>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Trophy className="h-4 w-4 text-[var(--gold,#F59E0B)]" />
          <span>
            Meilleure&nbsp;: <strong className="text-[var(--text-primary)]">{bestDays}j</strong>
          </span>
        </div>
        {nextMilestone && daysAway !== null && daysAway > 0 && (
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Flame className="h-4 w-4 text-[var(--purple,#7C3AED)]" />
            <span>
              Palier <strong className="text-[var(--text-primary)]">{nextMilestone}</strong> dans {daysAway}j
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
