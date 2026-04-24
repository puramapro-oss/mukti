'use client'

// MUKTI — G5.8 NotifyMeModal
// Portal glass modal pour "Notifie-moi quand [mode] arrive".
// POST /api/modes-avances/notify. Idempotent côté server (dédup).

import { useEffect, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { X, Bell, BellRing } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  modeId: string
  modeName: string
  modeEmoji: string
  alreadyNotified: boolean
  onNotified: (modeId: string) => void
}

export default function NotifyMeModal({
  open,
  onClose,
  modeId,
  modeName,
  modeEmoji,
  alreadyNotified,
  onNotified,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(alreadyNotified)

  useEffect(() => {
    if (open) setDone(alreadyNotified)
  }, [open, alreadyNotified])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function handleNotify() {
    startTransition(async () => {
      try {
        const resp = await fetch('/api/modes-avances/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode_id: modeId }),
        })
        if (!resp.ok) {
          const { error } = await resp.json().catch(() => ({ error: null }))
          toast.error(error ?? 'Impossible d\'enregistrer — réessaie.')
          return
        }
        const data = (await resp.json()) as { ok: true; already: boolean }
        setDone(true)
        onNotified(modeId)
        toast.success(
          data.already
            ? `Déjà noté — on t'avertit dès que ${modeName} arrive.`
            : `C'est noté. Tu seras prévenu·e en premier quand ${modeName} arrive.`,
          { duration: 3500 }
        )
      } catch {
        toast.error('Connexion perdue — réessaie.')
      }
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notify-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0F0A1E] p-6 text-white shadow-2xl backdrop-blur-xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <span className="text-3xl">{modeEmoji}</span>
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-[#A855F7]">
                  Phase Avancée
                </div>
                <h2 id="notify-modal-title" className="text-lg font-medium text-white">
                  {modeName}
                </h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-white/70">
              Cette expérience arrive bientôt. Tu seras prévenu·e en premier quand elle sera
              disponible.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/70 hover:bg-white/[0.08]"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleNotify}
                disabled={done || isPending}
                data-testid="notify-me-confirm"
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#A855F7]/50 bg-gradient-to-r from-[#7C3AED]/40 to-[#A855F7]/40 px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_25px_rgba(168,85,247,0.25)] transition-all hover:from-[#7C3AED]/60 hover:to-[#A855F7]/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {done ? (
                  <>
                    <BellRing className="h-4 w-4 text-[#DDD6FE]" />
                    Noté
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 text-[#DDD6FE]" />
                    {isPending ? 'Enregistrement…' : 'M\'avertir'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
