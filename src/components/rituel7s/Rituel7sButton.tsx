'use client'

// MUKTI — G5.6 Floating button Rituel 7s
// Fixed bottom-6 right-24 (à gauche du SOS rouge bottom-6 right-6).
// Icône Zap ambre + pulse douce quand idle. Caché sur routes publiques.

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRituel7s } from './Rituel7sProvider'

const HIDE_ON = ['/login', '/signup', '/forgot-password', '/auth/callback']

export default function Rituel7sButton() {
  const pathname = usePathname()
  const { isOpen, openRituel } = useRituel7s()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null
  if (HIDE_ON.some((p) => pathname?.startsWith(p))) return null
  if (isOpen) return null

  return (
    <motion.button
      type="button"
      onClick={() => openRituel('button')}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.6 }}
      className="group fixed bottom-6 right-24 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white shadow-2xl shadow-[#F59E0B]/30 ring-2 ring-white/10 transition-transform hover:scale-110 lg:bottom-8 lg:right-28"
      aria-label="Lancer le Rituel 7 Secondes"
      data-testid="rituel7s-button"
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-[#F59E0B] opacity-40 motion-safe:animate-ping"
      />
      <Zap className="relative h-5 w-5" strokeWidth={2.2} />
      <span className="pointer-events-none absolute -top-8 right-0 rounded-md bg-black/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
        7s
      </span>
    </motion.button>
  )
}
