'use client'

import { motion } from 'framer-motion'

interface Props {
  affirmationFr: string | null
  affirmationLoading: boolean
  affirmationError: string | null
}

export default function ExorcismePhaseReprogrammation({
  affirmationFr,
  affirmationLoading,
  affirmationError,
}: Props) {
  return (
    <motion.div
      key="reprogrammation"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.7 }}
      className="max-w-2xl text-center"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-white/45">Phase 4 · Reprogrammation</p>

      {affirmationLoading && !affirmationFr && (
        <div className="mt-8 flex flex-col items-center gap-2 text-white/60">
          <div className="h-8 w-8 animate-pulse rounded-full bg-[#F59E0B]/40" />
          <p className="text-xs uppercase tracking-[0.25em]">L&apos;affirmation arrive…</p>
        </div>
      )}

      {affirmationFr && (
        <motion.blockquote
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9 }}
          className="mt-8 font-serif text-2xl italic text-[#FBBF24] sm:text-3xl"
        >
          « {affirmationFr} »
        </motion.blockquote>
      )}

      {affirmationError && (
        <p className="mt-4 text-xs text-white/40">
          Le générateur contextuel est en pause — nous utilisons une formule universelle.
        </p>
      )}

      <p className="mt-8 text-sm text-white/55">
        Lis-la 3 fois en silence. Laisse-la s&apos;installer.
      </p>
    </motion.div>
  )
}
