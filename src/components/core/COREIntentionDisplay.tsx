'use client'

// MUKTI — COREIntentionDisplay : mot unique géant + pulse synchronisé.

import { motion } from 'framer-motion'

interface Props {
  intention: string
  live?: boolean
}

export default function COREIntentionDisplay({ intention, live = false }: Props) {
  const word = intention.trim().split(/\s+/)[0]?.toUpperCase() ?? intention

  return (
    <div
      className="relative flex items-center justify-center py-10"
      data-testid="core-intention-display"
    >
      {live && (
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-3xl bg-[#7c3aed]/20 blur-3xl"
          animate={{ opacity: [0.2, 0.6, 0.2], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.h2
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="relative bg-gradient-to-b from-white via-[#DDD6FE] to-[#7c3aed] bg-clip-text text-center text-5xl font-light uppercase tracking-[0.2em] text-transparent sm:text-7xl"
      >
        {word}
      </motion.h2>
    </div>
  )
}
