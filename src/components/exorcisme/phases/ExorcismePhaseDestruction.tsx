'use client'

import { motion } from 'framer-motion'
import { EXORCISME_SHATTER_TAPS } from '@/lib/exorcisme-utils'

interface Props {
  session: { id: string; possessionText: string }
  taps: number
  destructionProgress: number
  onTap: () => void
}

export default function ExorcismePhaseDestruction({
  session,
  taps,
  destructionProgress,
  onTap,
}: Props) {
  return (
    <motion.div
      key="destruction"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl text-center"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-white/45">Phase 3 · Destruction</p>
      <p className="mt-3 text-sm text-white/60">
        Frappe {EXORCISME_SHATTER_TAPS} fois pour briser.
      </p>

      <button
        type="button"
        onClick={onTap}
        disabled={taps >= EXORCISME_SHATTER_TAPS}
        className="group mt-10 block w-full rounded-3xl border border-rose-500/30 bg-black/40 px-6 py-10 backdrop-blur transition-all hover:border-rose-400/60 hover:bg-rose-900/20 active:scale-95 disabled:opacity-50"
        aria-label="Frapper pour briser"
      >
        <span
          className={`inline-block font-serif text-2xl font-medium text-white transition-all sm:text-4xl ${
            taps > 0 ? 'italic' : ''
          }`}
          style={{
            opacity: 1 - destructionProgress * 0.85,
            transform: `scale(${1 - destructionProgress * 0.4}) rotate(${destructionProgress * 8 - 4}deg)`,
            filter: `blur(${destructionProgress * 6}px)`,
          }}
        >
          « {session.possessionText} »
        </span>
      </button>

      <div className="mt-6 flex items-center justify-center gap-2">
        {Array.from({ length: EXORCISME_SHATTER_TAPS }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className={`h-2 w-8 rounded-full transition-colors duration-300 ${
              i < taps ? 'bg-rose-400/80' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </motion.div>
  )
}
