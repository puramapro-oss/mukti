'use client'

import { motion } from 'framer-motion'

interface Props {
  sealing: boolean
  onSeal: () => void
}

export default function ExorcismePhaseScellement({ sealing, onSeal }: Props) {
  return (
    <motion.div
      key="scellement"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-xl text-center"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-white/45">Phase 5 · Scellement</p>
      <h2 className="mt-6 text-3xl font-light tracking-tight sm:text-4xl">
        Scelle cette libération.
      </h2>
      <p className="mt-3 text-sm text-white/60">
        Un tap pour sceller. La séance se termine.
      </p>
      <button
        type="button"
        onClick={onSeal}
        disabled={sealing}
        className="mt-10 rounded-full border border-[#FFD700]/50 bg-gradient-to-r from-[#F59E0B]/30 to-[#FFD700]/30 px-10 py-4 text-base font-medium text-white shadow-[0_0_60px_rgba(255,215,0,0.3)] transition-all hover:from-[#F59E0B]/50 hover:to-[#FFD700]/50 disabled:opacity-50"
      >
        Sceller
      </button>
    </motion.div>
  )
}
