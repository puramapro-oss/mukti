'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Sparkles, ThumbsUp, Loader2, CheckCircle } from 'lucide-react'

type Kind = 'feeling' | 'gratitude' | 'kind_message' | 'forum'

const KIND_LABELS: Record<Kind, { icon: typeof Heart; label: string; placeholder: string; desc: string }> = {
  feeling: {
    icon: Sparkles,
    label: 'Partager mon ressenti',
    placeholder: 'Ce que j\'ai ressenti pendant la session…',
    desc: 'Ton expérience intime. Visible uniquement pour les participants.',
  },
  gratitude: {
    icon: Heart,
    label: 'Remercier le groupe',
    placeholder: 'Merci à vous toutes et tous pour…',
    desc: 'Une gratitude pour le cercle. Visible par les participants.',
  },
  kind_message: {
    icon: ThumbsUp,
    label: 'Laisser un message bienveillant',
    placeholder: 'Un mot doux pour qui le reçoit…',
    desc: 'Message pour le cercle. Visible par les participants.',
  },
  forum: {
    icon: Sparkles,
    label: 'Publier dans le forum',
    placeholder: 'Ce que j\'ai envie de partager avec la communauté…',
    desc: 'Message public dans le forum de la catégorie.',
  },
}

export default function PostSessionForm({ circleId }: { circleId: string }) {
  const router = useRouter()
  const [kind, setKind] = useState<Kind>('gratitude')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (submitting || content.trim().length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/circles/${circleId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Envoi refusé.')
        setSubmitting(false)
        return
      }
      setSuccess(true)
      setContent('')
      setTimeout(() => setSuccess(false), 2500)
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setSubmitting(false)
    }
  }

  const cfg = KIND_LABELS[kind]
  const Icon = cfg.icon

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['feeling', 'gratitude', 'kind_message', 'forum'] as Kind[]).map((k) => {
          const item = KIND_LABELS[k]
          const ItemIcon = item.icon
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              data-testid={`kind-${k}`}
              className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left text-xs transition-all ${
                kind === k
                  ? 'border-white/30 bg-white/[0.06]'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <ItemIcon className="h-4 w-4 text-[var(--cyan)]" />
              <span className="font-medium text-white/85">{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-white/50">{cfg.desc}</p>
        <textarea
          rows={5}
          maxLength={2000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={cfg.placeholder}
          data-testid="post-session-content"
          className="resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[var(--cyan)]/60 focus:outline-none"
        />
        <p className="text-right text-[11px] text-white/40">{content.length}/2000</p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-200">
          <CheckCircle className="h-4 w-4" /> Message envoyé. Tu peux en laisser un autre ou quitter.
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/dashboard/cercles')}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
          data-testid="post-session-exit"
        >
          Quitter
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || content.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="post-session-submit"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          Envoyer
        </button>
      </div>
    </div>
  )
}
