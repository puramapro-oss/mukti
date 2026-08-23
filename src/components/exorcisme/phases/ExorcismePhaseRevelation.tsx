'use client'

import { motion } from 'framer-motion'
import { EXORCISME_MAX_TEXT_LENGTH } from '@/lib/exorcisme-utils'

interface Props {
  possessionDraft: string
  setPossessionDraft: (text: string) => void
  startError: string | null
  onSubmit: () => void
}

export default function ExorcismePhaseRevelation({
  possessionDraft,
  setPossessionDraft,
  startError,
  onSubmit,
}: Props) {
  return (
    <motion.div
      key="revelation"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-xl text-center"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-white/45">Phase 2 · Révélation</p>
      <h2 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl">
        Ce qui me possède :
      </h2>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
        <textarea
          value={possessionDraft}
          onChange={e => setPossessionDraft(e.target.value.slice(0, EXORCISME_MAX_TEXT_LENGTH))}
          maxLength={EXORCISME_MAX_TEXT_LENGTH}
          rows={2}
          placeholder="Ex : la dépendance au sucre après 18h"
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-center text-base text-white placeholder:text-white/30 focus:border-[#A855F7]/60 focus:outline-none"
          aria-label="Ce qui me possède"
          autoFocus
        />
        <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-widest text-white/40">
          <span>{possessionDraft.length}/{EXORCISME_MAX_TEXT_LENGTH}</span>
          <span>Concis, direct.</span>
        </div>
      </div>

      {startError && (
        <p className="mt-3 text-sm text-rose-300/90">{startError}</p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={possessionDraft.trim().length === 0}
        className="mt-6 rounded-full border border-[#A855F7]/50 bg-gradient-to-r from-[#7C3AED]/30 to-[#A855F7]/30 px-8 py-3 text-sm font-medium text-white shadow-[0_0_40px_rgba(168,85,247,0.25)] transition-all hover:from-[#7C3AED]/50 hover:to-[#A855F7]/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Nommer
      </button>
    </motion.div>
  )
}
