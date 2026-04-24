'use client'

import { useState } from 'react'
import { Loader2, Send, Share2 } from 'lucide-react'

interface Props {
  minutesPracticed: number
  weekIso: string
  themeSlug: string
  onSaved?: () => void
}

export function RituelJournalForm({ minutesPracticed, weekIso, themeSlug, onSaved }: Props) {
  const [intention, setIntention] = useState('')
  const [shared, setShared] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setErr(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/rituel-hebdo/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          minutes_practiced: minutesPracticed,
          intention_text: intention.trim() || undefined,
          shared,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }))
        setErr(j.error ?? 'Enregistrement impossible pour le moment.')
        return
      }
      setSavedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
      onSaved?.()
    } catch {
      setErr('Réseau indisponible. Réessaie dans un instant.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
      data-testid="rituel-journal-form"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
        Journal — {themeSlug} · semaine {weekIso}
      </p>
      <label className="mt-3 block">
        <span className="text-sm text-white/80">
          Ton intention (optionnelle, privée sauf si tu cliques "partager")
        </span>
        <textarea
          rows={3}
          value={intention}
          onChange={e => setIntention(e.target.value.slice(0, 500))}
          placeholder="Ce que j'ouvre en moi cette semaine…"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
          data-testid="rituel-intention"
          aria-label="Ton intention pour cette semaine"
        />
      </label>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          checked={shared}
          onChange={e => setShared(e.target.checked)}
          className="accent-purple-400"
          data-testid="rituel-share-checkbox"
        />
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
        Partager anonymement pour inspirer d'autres
      </label>

      {err && (
        <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {err}
        </p>
      )}
      {savedAt && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          Enregistré à {savedAt}. Ton rituel de la semaine est inscrit dans ton fil.
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={submitting || savedAt !== null}
        data-testid="rituel-save-btn"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {savedAt ? 'Enregistré' : `Enregistrer (${minutesPracticed} min)`}
      </button>
    </div>
  )
}
