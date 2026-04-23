import type { Metadata } from 'next'
import Link from 'next/link'
import AideClient from './AideClient'

export const metadata: Metadata = {
  title: 'Centre d\'aide — MUKTI',
  description:
    'Réponses aux questions sur MUKTI : scanner financier, démarches automatiques, wallet IBAN, parrainage, sécurité, premium. Assistance MUKTI 24/7.',
  alternates: { canonical: 'https://mukti.purama.dev/aide' },
}

export default function AidePage() {
  return (
    <div className="relative z-10 min-h-screen px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--cyan)] transition-colors"
        >
          ← Retour à l&apos;accueil
        </Link>

        <header className="mb-10 text-center">
          <h1 className="gradient-text font-[family-name:var(--font-display)] text-3xl md:text-5xl font-bold mb-3">
            Centre d&apos;aide
          </h1>
          <p className="mx-auto max-w-2xl text-[var(--text-muted)]">
            Une question sur MUKTI ? Cherche dans la FAQ ou demande directement à MUKTI — réponse instantanée 24/7.
          </p>
        </header>

        <AideClient />

        <div className="mt-16 glass rounded-3xl p-8 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-primary)] mb-2">
            Ta question n&apos;est pas dans la liste ?
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-5">
            Écris-nous : on répond sous 24h ouvrées (souvent moins).
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--cyan)] px-6 py-3 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
            data-testid="aide-contact-cta"
          >
            Nous contacter →
          </Link>
        </div>
      </div>
    </div>
  )
}
