'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { LifeBuoy, X, Phone } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SOS_RESOURCES_FR } from '@/lib/constants'

const HIDE_ON = ['/login', '/signup', '/forgot-password', '/auth/callback']

export default function SOSButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close on Esc
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!mounted) return null
  if (HIDE_ON.some((p) => pathname?.startsWith(p))) return null

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.5 }}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-2xl shadow-red-500/40 ring-2 ring-white/10 transition-transform hover:scale-110 lg:bottom-8 lg:right-8"
        aria-label="Ouvrir les ressources d'urgence"
        data-testid="sos-button"
      >
        <LifeBuoy className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-labelledby="sos-modal-title"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/[0.08] bg-[#0e0e16] p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 id="sos-modal-title" className="font-[family-name:var(--font-display)] text-xl font-bold text-white">
                    Tu n&apos;es pas seul·e
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    Si la situation est urgente, appelle dès maintenant. Ces lignes sont gratuites, anonymes et tenues par des humains formés.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="rounded-full p-1.5 text-white/60 transition hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ul className="space-y-2">
                {SOS_RESOURCES_FR.map((r) => (
                  <li key={r.number}>
                    <a
                      href={`tel:${r.number.replace(/\s/g, '')}`}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-rose-400/30 hover:bg-rose-500/5"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-300">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                          {r.name} <span className="ml-1 font-mono text-rose-300">{r.number}</span>
                        </p>
                        <p className="text-xs text-white/50">{r.description}</p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>

              <p className="mt-5 text-center text-[11px] text-white/40">
                MUKTI propose une expérience spirituelle, pas un soin médical. Pour toute urgence, contacte un professionnel.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
