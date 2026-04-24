import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getMyStats } from '@/lib/life-feed'
import { ProjectionChart } from '@/components/life-feed/ProjectionChart'

export const metadata: Metadata = {
  title: 'Projection futur — Fil de Vie — MUKTI',
  description: 'Impact cumulé projeté à 5, 10 ou 20 ans — basé sur ton rythme actuel.',
}

export const dynamic = 'force-dynamic'

export default async function ProjectionPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/fil-de-vie/projection')

  const stats = await getMyStats()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Projection futur
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-white">
          Si tu continues, voici ton avenir
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          Projection basée sur ton rythme actuel. Aucune garantie — juste un miroir motivant.
        </p>
      </header>

      <ProjectionChart hasHistory={stats.total_entries > 0} />

      <p className="text-xs text-white/40">
        La projection est une estimation. Elle ne remplace ni conseil médical ni décision financière.
      </p>
    </div>
  )
}
