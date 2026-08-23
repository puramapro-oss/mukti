'use client'

import { motion } from 'framer-motion'

export default function CinematicIntro({ onSkip }: { onSkip: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-void)]"
      role="dialog"
      aria-label="Cinématique d'introduction"
    >
      <motion.button
        type="button"
        onClick={onSkip}
        className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 backdrop-blur hover:bg-white/10"
        whileHover={{ scale: 1.05 }}
      >
        Passer
      </motion.button>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
          className="text-7xl sm:text-9xl"
          aria-hidden
        >
          🕉️
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-6 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-white sm:text-6xl"
        >
          MUKTI
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mt-3 text-sm text-white/60"
        >
          मुक्ति · Libération
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
