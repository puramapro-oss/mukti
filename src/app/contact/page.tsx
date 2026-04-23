import type { Metadata } from 'next'
import Link from 'next/link'
import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: 'Nous contacter — MUKTI',
  description:
    'Une question, un bug, une suggestion ? Écris-nous : on répond sous 24h ouvrées. Support MUKTI par email contact@purama.dev.',
  alternates: { canonical: 'https://mukti.purama.dev/contact' },
}

export default function ContactPage() {
  return (
    <div className="relative z-10 min-h-screen px-4 py-20">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/aide"
          className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--cyan)] transition-colors"
        >
          ← Centre d&apos;aide
        </Link>

        <header className="mb-10 text-center">
          <h1 className="gradient-text font-[family-name:var(--font-display)] text-3xl md:text-5xl font-bold mb-3">
            Nous contacter
          </h1>
          <p className="mx-auto max-w-xl text-[var(--text-muted)]">
            Une question, un bug, une suggestion ? On répond sous 24h ouvrées (souvent moins).
            Avant d&apos;écrire, jette un œil à la{' '}
            <Link href="/aide" className="text-[var(--cyan)] hover:underline">
              FAQ
            </Link>{' '}
            — la réponse y est peut-être déjà.
          </p>
        </header>

        <div className="glass rounded-3xl p-6 md:p-10">
          <ContactForm />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <p className="mb-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">Email direct</p>
            <a
              href="mailto:contact@purama.dev"
              className="text-base font-semibold text-[var(--cyan)] hover:underline"
              data-testid="contact-email-direct"
            >
              contact@purama.dev
            </a>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="mb-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">Société</p>
            <p className="text-sm text-[var(--text-secondary)]">
              SASU PURAMA · 8 Rue de la Chapelle, 25560 Frasne, France
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
