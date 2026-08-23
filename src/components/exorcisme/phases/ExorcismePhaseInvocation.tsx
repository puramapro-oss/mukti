'use client'

import { motion } from 'framer-motion'

export default function ExorcismePhaseInvocation() {
  return (
    <motion.div
      key="invocation"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="max-w-xl text-center"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-white/45">Phase 1 · Invocation</p>
      <h2 className="mt-6 text-4xl font-light tracking-tight sm:text-5xl">
        Pose ton téléphone.
      </h2>
      <p className="mt-4 text-lg text-white/70">Prépare-toi. Ça va durer quelques minutes.</p>
    </motion.div>
  )
}
