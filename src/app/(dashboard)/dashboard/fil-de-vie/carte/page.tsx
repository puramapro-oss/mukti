import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getWorldImpactAggregated } from '@/lib/life-feed'
import { MapboxWorldImpact } from '@/components/life-feed/MapboxWorldImpact'

export const metadata: Metadata = {
  title: 'Carte mondiale — Fil de Vie — MUKTI',
  description: 'Ton impact sur la carte du monde — rejoint celui des autres utilisateurs MUKTI.',
}

export const dynamic = 'force-dynamic'

export default async function CarteImpactPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/fil-de-vie/carte')

  const aggregates = await getWorldImpactAggregated()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard/fil-de-vie"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Retour au Fil de Vie
        </Link>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Carte mondiale
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-white">
          {aggregates.length === 0
            ? 'Le monde MUKTI commence ici'
            : `${aggregates.length} pays touchés`}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          Chaque point est une action réelle réalisée par un·e utilisateur·trice MUKTI. Points anonymisés.
        </p>
      </header>

      <MapboxWorldImpact aggregates={aggregates} />

      <p className="text-xs text-white/40">
        Données agrégées par pays. Aucune coordonnée individuelle n'est exposée.
      </p>
    </div>
  )
}
