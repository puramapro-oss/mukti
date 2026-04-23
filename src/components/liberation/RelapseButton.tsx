'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { HeartCrack, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'

interface Props {
  addictionId: string
  currentDays: number
}

export default function RelapseButton({ addictionId, currentDays }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [triggerNote, setTriggerNote] = useState('')
  const [mood, setMood] = useState<number | null>(null)
  const [insight, setInsight] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/streak/relapse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addiction_id: addictionId,
          trigger_note: triggerNote.trim() || undefined,
          mood_before: mood ?? undefined,
        }),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; message?: string }
        | null

      if (!res.ok || !json?.ok) {
        toast.error(json?.error ?? 'Impossible d\'enregistrer — réessaie.')
        setSubmitting(false)
        return
      }
      setInsight(json.message ?? 'Un nouveau départ commence maintenant. 🌱')
    } catch {
      toast.error('Erreur réseau.')
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setTriggerNote('')
    setMood(null)
    setInsight(null)
    setSubmitting(false)
    startTransition(() => router.refresh())
  }

  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => setOpen(true)}
        icon={<HeartCrack className="h-4 w-4" />}
        data-testid="relapse-open"
      >
        J&apos;ai rechuté
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass relative w-full max-w-lg rounded-3xl border border-[var(--border)] p-6 sm:p-8"
            >
              <button
                type="button"
                onClick={handleClose}
                className="absolute right-4 top-4 rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
                aria-label="Fermer"
                data-testid="relapse-close"
              >
                <X className="h-5 w-5" />
              </button>

              {!insight ? (
                <>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--purple,#7C3AED)]/10 text-3xl">
                      🌊
                    </div>
                    <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
                      Tu es là. C&apos;est déjà un acte courageux.
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {currentDays > 0
                        ? `${currentDays} jour${currentDays > 1 ? 's' : ''} de libération — ça ne s'efface pas. Ça t'appartient.`
                        : 'Chaque moment peut redevenir le premier.'}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="relapse-note" className="text-sm text-[var(--text-secondary)]">
                        Qu&apos;est-ce qui s&apos;est passé ? <span className="text-[var(--text-muted)]">(optionnel)</span>
                      </label>
                      <textarea
                        id="relapse-note"
                        rows={3}
                        maxLength={500}
                        value={triggerNote}
                        onChange={e => setTriggerNote(e.target.value)}
                        placeholder="Un déclencheur, une émotion, un contexte…"
                        className="w-full resize-none rounded-xl border border-[var(--border)] bg-white/5 p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--cyan)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]/30"
                        data-testid="relapse-note"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-[var(--text-secondary)]">Humeur juste avant</span>
                        <span className="text-sm text-[var(--cyan)]">{mood ?? '—'}/10</span>
                      </div>
                      <div className="flex gap-1" role="radiogroup" aria-label="Humeur avant rechute">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(v => (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={mood === v}
                            onClick={() => setMood(mood === v ? null : v)}
                            className={`h-8 flex-1 rounded-md border text-xs transition-all ${
                              mood === v
                                ? 'border-[var(--cyan)] bg-[var(--cyan)]/20 text-[var(--cyan)]'
                                : 'border-[var(--border)] bg-white/5 text-[var(--text-muted)] hover:border-[var(--border-glow)]'
                            }`}
                            data-testid={`mood-${v}`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
                        Annuler
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleSubmit}
                        loading={submitting}
                        className="flex-1"
                        data-testid="relapse-submit"
                      >
                        Enregistrer sans jugement
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--cyan)]/30 to-[var(--purple)]/30 text-4xl"
                  >
                    🌱
                  </motion.div>
                  <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Un nouveau départ</h2>
                  <p className="rounded-2xl border border-[var(--purple)]/20 bg-[var(--purple)]/5 p-4 text-left text-sm leading-relaxed text-[var(--text-primary)]">
                    <Sparkles className="mr-1 inline h-4 w-4 text-[var(--purple)]" />
                    {insight}
                  </p>
                  <Button type="button" variant="primary" onClick={handleClose} className="w-full" data-testid="relapse-continue">
                    Continuer
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
