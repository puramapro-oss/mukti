'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageCircleQuestion, X, AlertCircle } from 'lucide-react'

export function HelpBubble() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir l'aide IA"
        data-testid="help-bubble-trigger"
        className="fixed bottom-20 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 text-white shadow-lg shadow-purple-500/30 transition hover:scale-105 active:scale-95 md:bottom-6"
      >
        <MessageCircleQuestion className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-bubble-title"
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm md:items-center md:p-6"
          onClick={e => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            className="flex h-full w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0A0A0F] md:h-auto md:max-h-[85vh] md:rounded-3xl"
            data-testid="help-bubble-panel"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 id="help-bubble-title" className="text-sm font-semibold text-white">
                Besoin d'aide ?
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="rounded-full p-1 text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="flex flex-col gap-3 p-5">
              <Link
                href="/dashboard/aide-ia"
                onClick={() => setOpen(false)}
                data-testid="help-bubble-open-ai"
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/40"
              >
                <MessageCircleQuestion className="mt-0.5 h-5 w-5 text-cyan-300" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-white">Poser une question à MUKTI</p>
                  <p className="mt-1 text-xs text-white/55">
                    Addictions, app, rituels, soutien — je t'écoute sans jugement.
                  </p>
                </div>
              </Link>

              <Link
                href="/dashboard/aide-ia?signal=distress"
                onClick={() => setOpen(false)}
                data-testid="help-bubble-distress"
                className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 transition hover:border-red-400/60"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 text-red-300" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-red-100">Je ne me sens pas bien</p>
                  <p className="mt-1 text-xs text-red-200/80">
                    Accède immédiatement aux ressources d'urgence de ton pays.
                  </p>
                </div>
              </Link>

              <Link
                href="/aide"
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/40"
              >
                <div className="mt-0.5 text-lg" aria-hidden="true">📚</div>
                <div>
                  <p className="text-sm font-semibold text-white">Centre d'aide</p>
                  <p className="mt-1 text-xs text-white/55">FAQ, guides, articles.</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
