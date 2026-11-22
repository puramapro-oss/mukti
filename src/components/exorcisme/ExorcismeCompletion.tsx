'use client'

import { useEffect, useRef } from 'react'

interface Props {
  saving: boolean
  error: string | null
  onRetry: () => void
  onLeave: () => void
}

export default function ExorcismeCompletion({ saving, error, onRetry, onLeave }: Props) {
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => { title.current?.focus() }, [])
  return (
    <div className="fixed inset-0 z-[40] flex items-center justify-center overflow-y-auto bg-[#050308] px-6 py-10 text-white">
      <section className="w-full max-w-xl space-y-5 text-center" aria-label="Fin de la séance">
        <h1 ref={title} tabIndex={-1} className="text-2xl font-medium">Séance arrêtée</h1>
        <p role="status" aria-live="polite">
          {saving ? 'Enregistrement en cours…' : 'L’enregistrement n’a pas été confirmé.'}
        </p>
        {error && <p role="alert" className="text-rose-200">{error}</p>}
        <p className="text-sm text-white/80">Tu peux réessayer depuis cette page ou revenir au tableau de bord.</p>
        <div className="flex flex-wrap justify-center gap-3">
          {error && <button type="button" onClick={onRetry} disabled={saving}
            className="min-h-11 rounded-full bg-violet-700 px-6 py-3 disabled:opacity-50">Réessayer l’enregistrement</button>}
          <button type="button" onClick={onLeave}
            className="min-h-11 rounded-full border border-white/40 px-6 py-3">Quitter sans confirmation</button>
        </div>
      </section>
    </div>
  )
}
