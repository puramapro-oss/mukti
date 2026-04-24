'use client'

import { useState } from 'react'
import { Quote, Loader2, Send } from 'lucide-react'

interface Testimonial {
  id: string
  content: string
  created_at: string
}

interface Props {
  initial: Testimonial[]
}

export function TestimonialWall({ initial }: Props) {
  const [items] = useState<Testimonial[]>(initial)
  const [composing, setComposing] = useState(false)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<null | 'sent' | 'error'>(null)

  async function send() {
    if (content.trim().length < 20) {
      setResult('error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/accompagnants/testimonial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), anonymous: true }),
      })
      if (!res.ok) {
        setResult('error')
        return
      }
      setResult('sent')
      setContent('')
      setTimeout(() => setComposing(false), 2000)
    } catch {
      setResult('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="testimonials-title" className="mt-12">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 id="testimonials-title" className="text-2xl font-semibold text-white">
            Voix d'aidants
          </h2>
          <p className="mt-1 text-sm text-white/60">
            D'autres, anonymement, te tendent la main. Tu peux leur répondre.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposing(v => !v)}
          data-testid="testimonial-compose-btn"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/50 hover:text-white"
        >
          {composing ? 'Annuler' : 'Partager un mot'}
        </button>
      </div>

      {composing && (
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              Ton message — restera anonyme, modéré avant publication
            </span>
            <textarea
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value.slice(0, 2000))}
              placeholder="Ce que j'aurais aimé entendre quand je commençais…"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
              aria-label="Ton témoignage"
              data-testid="testimonial-textarea"
            />
          </label>
          <div className="mt-3 flex items-center justify-between text-xs text-white/40">
            <span>{content.trim().length}/2000 caractères (min. 20)</span>
            <button
              type="button"
              onClick={send}
              disabled={submitting || content.trim().length < 20}
              data-testid="testimonial-send-btn"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              Envoyer
            </button>
          </div>
          {result === 'error' && (
            <p role="alert" className="mt-3 text-xs text-red-300">
              Ton message doit faire au moins 20 caractères et moins de 2000.
            </p>
          )}
          {result === 'sent' && (
            <p role="status" className="mt-3 text-xs text-emerald-300">
              Reçu. Après un regard bienveillant, il rejoindra le mur.
            </p>
          )}
        </div>
      )}

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {items.length === 0 ? (
          <li className="col-span-full rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
            Les premiers mots arrivent. Tu peux être la première voix.
          </li>
        ) : (
          items.map(t => (
            <li
              key={t.id}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
            >
              <Quote className="h-5 w-5 text-white/30" aria-hidden="true" />
              <p className="mt-3 text-sm leading-relaxed text-white/80">{t.content}</p>
              <p className="mt-4 text-xs text-white/40">
                {new Date(t.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
