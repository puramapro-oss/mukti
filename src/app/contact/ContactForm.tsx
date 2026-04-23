'use client'

import { useState } from 'react'

type FormState = {
  name: string
  email: string
  subject: string
  message: string
  website: string // honeypot
}

const INITIAL: FormState = { name: '', email: '', subject: '', message: '', website: '' }

const SUBJECTS = [
  'Question sur le scanner',
  'Problème de paiement / abonnement',
  'Question sur le wallet / retrait',
  'Bug ou erreur technique',
  'Suggestion / amélioration',
  'RGPD / suppression de données',
  'Partenariat',
  'Autre',
]

export default function ContactForm() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setError(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Envoi impossible.')
      }
      setStatus('sent')
      setForm(INITIAL)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Erreur réseau.')
    }
  }

  if (status === 'sent') {
    return (
      <div className="text-center py-10" data-testid="contact-success">
        <div className="mb-4 text-5xl">✅</div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--text-primary)] mb-2">
          Message envoyé !
        </h2>
        <p className="text-[var(--text-muted)] mb-6">
          On a bien reçu ton message. Réponse sous 24h ouvrées sur l&apos;email indiqué.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-[var(--text-secondary)] hover:bg-white/10 transition-colors"
        >
          Envoyer un autre message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Honeypot — hidden from users, bots will fill it */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={(e) => update('website', e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Ton nom" htmlFor="contact-name">
          <input
            id="contact-name"
            type="text"
            required
            minLength={2}
            maxLength={80}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]/40"
            data-testid="contact-name"
            placeholder="Camille Martin"
          />
        </Field>

        <Field label="Ton email" htmlFor="contact-email">
          <input
            id="contact-email"
            type="email"
            required
            maxLength={180}
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]/40"
            data-testid="contact-email"
            placeholder="camille@exemple.fr"
          />
        </Field>
      </div>

      <Field label="Sujet" htmlFor="contact-subject">
        <select
          id="contact-subject"
          required
          value={form.subject}
          onChange={(e) => update('subject', e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]/40"
          data-testid="contact-subject"
        >
          <option value="" disabled>
            Choisis un sujet…
          </option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s} className="bg-[#0A0A0F]">
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Ton message" htmlFor="contact-message">
        <textarea
          id="contact-message"
          required
          minLength={10}
          maxLength={4000}
          rows={7}
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]/40 resize-y"
          data-testid="contact-message"
          placeholder="Décris ta question ou ton problème en quelques lignes…"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">{form.message.length} / 4000</p>
      </Field>

      {error && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          data-testid="contact-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-full bg-[var(--cyan)] px-6 py-3.5 text-sm font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="contact-submit"
      >
        {status === 'sending' ? 'Envoi en cours…' : 'Envoyer le message'}
      </button>

      <p className="text-center text-xs text-[var(--text-muted)]">
        En envoyant ce message, tu acceptes notre{' '}
        <a href="/politique-confidentialite" className="hover:text-[var(--cyan)] underline">
          politique de confidentialité
        </a>
        .
      </p>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </label>
      {children}
    </div>
  )
}
