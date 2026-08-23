'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}

export default function CollapsibleSection({ title, icon, count, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/5 p-5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="mb-3 flex w-full items-center justify-between gap-3"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          {icon} {title}
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-[var(--text-muted)]">{count}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
