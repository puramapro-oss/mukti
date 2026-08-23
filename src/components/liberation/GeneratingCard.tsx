'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

type Phase = 'idle' | 'initializing' | 'streaming' | 'persisting' | 'done' | 'error'

interface GeneratingCardProps {
  phase: Phase
  status: string
  chars: number
  outputTokens: number
  compact?: boolean
}

export default function GeneratingCard({ phase, status, chars, outputTokens, compact }: GeneratingCardProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border border-[var(--cyan)]/30 bg-gradient-to-br from-[var(--cyan)]/10 to-[var(--purple)]/10 ${
        compact ? 'w-full max-w-xs p-4' : 'w-full max-w-sm p-6'
      }`}
      data-testid="generating-card"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"
      >
        <Sparkles className="h-5 w-5 text-[var(--cyan)]" />
      </motion.div>
      <p className="text-center text-sm font-medium text-[var(--text-primary)]">{status}</p>
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span>
          <strong className="text-[var(--cyan)]">{chars.toLocaleString('fr-FR')}</strong> caractères
        </span>
        <span className="text-white/20">·</span>
        <span>
          <strong className="text-[var(--purple)]">{outputTokens.toLocaleString('fr-FR')}</strong> tokens
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
        {phase === 'persisting' ? 'sauvegarde' : phase === 'streaming' ? 'composition' : 'préparation'}
      </p>
    </div>
  )
}
