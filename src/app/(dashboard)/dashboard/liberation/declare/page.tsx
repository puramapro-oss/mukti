import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import AddictionDeclarationForm from '@/components/liberation/AddictionDeclarationForm'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { MAX_ACTIVE_ADDICTIONS } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Déclarer une libération — MUKTI',
  description:
    'Déclare ce qui pèse sur toi. MUKTI génère un programme 90 jours personnalisé, sans jugement, pour t\'accompagner vers la libération.',
}

export const dynamic = 'force-dynamic'

export default async function DeclarePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()

  if (!user) redirect('/login?next=/dashboard/liberation/declare')

  const { count } = await sb
    .from('addictions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  const activeCount = count ?? 0
  const atLimit = activeCount >= MAX_ACTIVE_ADDICTIONS

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <Link
        href="/dashboard/liberation"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" /> Retour au module Libération
      </Link>

      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cyan)]">
          Libération addictions
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-[var(--text-primary)] sm:text-5xl">
          Nomme ce qui pèse.
          <br />
          Ta libération commence ici.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--text-secondary)]">
          En 4 étapes, tu crées les fondations d&apos;un programme 90 jours entièrement personnalisé. Zéro
          jugement. Zéro promesse médicale. Juste un espace d&apos;accompagnement respectueux.
        </p>
      </header>

      {atLimit ? (
        <section className="mx-auto w-full max-w-xl rounded-3xl border border-[var(--border)] bg-white/5 p-8 text-center">
          <p className="text-4xl" aria-hidden>
            🌱
          </p>
          <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">
            Tu as déjà {MAX_ACTIVE_ADDICTIONS} libérations actives
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Pour préserver ta concentration, MUKTI limite à {MAX_ACTIVE_ADDICTIONS} libérations simultanées.
            Termine ou pause l&apos;une d&apos;elles pour en ajouter une nouvelle.
          </p>
          <Link
            href="/dashboard/liberation"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Voir mes libérations en cours
          </Link>
        </section>
      ) : (
        <AddictionDeclarationForm />
      )}

      <p className="mx-auto max-w-md text-center text-xs text-[var(--text-muted)]">
        🔒 Tes informations sont chiffrées, jamais revendues. Voir{' '}
        <Link href="/politique-confidentialite" className="underline hover:text-[var(--text-secondary)]">
          notre politique de confidentialité
        </Link>
        .
      </p>
    </div>
  )
}
