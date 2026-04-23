import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Sparkles } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { CIRCLE_CATEGORIES } from '@/lib/constants'
import CircleCategoryGrid from '@/components/cercles/CircleCategoryGrid'

export const metadata: Metadata = {
  title: 'Cercles d\'Intention — MUKTI',
  description: 'Rejoins ou crée un cercle d\'intention. 14 catégories de soin collectif. Rotation collective, 8 modes de guidage.',
}

export const dynamic = 'force-dynamic'

export default async function CerclesHome() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/cercles')

  // Fetch counts par catégorie (open/live) en une seule requête via service client
  const service = createServiceClient()
  const { data: circles } = await service
    .from('circles')
    .select('category, status')
    .in('status', ['open', 'live'])

  const counts: Record<string, { open: number; live: number }> = {}
  CIRCLE_CATEGORIES.forEach((c) => {
    counts[c.id] = { open: 0, live: 0 }
  })
  ;(circles ?? []).forEach((row: { category: string; status: string }) => {
    if (!counts[row.category]) return
    if (row.status === 'open') counts[row.category].open += 1
    else if (row.status === 'live') counts[row.category].live += 1
  })

  const totalOpen = Object.values(counts).reduce((s, c) => s + c.open + c.live, 0)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cyan)]">
            Cercles d&apos;Intention ∞
          </p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight text-white">
            Le soin collectif, à l&apos;infini
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            Tout le groupe se focalise sur une personne, à tour de rôle. Donner et recevoir, sans jugement.
            De 2 à des milliers d&apos;âmes — en audio indestructible, synchronisés par le même souffle.
          </p>
        </div>
        <Link
          href="/dashboard/cercles/create"
          data-testid="cercles-create"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Créer mon cercle
        </Link>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
              Choisis ton intention
            </h2>
            <p className="mt-1 text-xs text-white/45">
              {totalOpen === 0
                ? 'Aucun cercle actif pour le moment — sois le premier à ouvrir la porte.'
                : `${totalOpen} cercle${totalOpen > 1 ? 's' : ''} actif${totalOpen > 1 ? 's' : ''} en ce moment.`}
            </p>
          </div>
        </div>
        <CircleCategoryGrid counts={counts} />
      </section>

      <section className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--purple)]/15 text-xl">
            <Sparkles className="h-5 w-5 text-[var(--purple)]" />
          </span>
          <div>
            <h3 className="text-base font-medium text-white">Comment ça marche</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>
                <span className="text-white/80">Rotation collective.</span> Tout le groupe se focalise sur une
                personne à la fois. Puis on tourne jusqu&apos;à ce que chacun ait reçu.
              </li>
              <li>
                <span className="text-white/80">8 modes de guidage.</span> Voix, respiration, visualisation,
                silence, son, lumière, intention pure — choisis le tien à la création.
              </li>
              <li>
                <span className="text-white/80">Audio indestructible.</span> ≤ 8 personnes → peer-to-peer direct.
                Au-delà → serveur relais scalable (jusqu&apos;à des milliers).
              </li>
              <li>
                <span className="text-white/80">Aucun score, aucun jugement.</span> Après la session, tu peux
                laisser un message bienveillant ou quitter simplement.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
