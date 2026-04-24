import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles, Globe2, TrendingUp } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getMyTimeline, getMyStats } from '@/lib/life-feed'
import { FilDeVieTimeline } from '@/components/life-feed/FilDeVieTimeline'

export const metadata: Metadata = {
  title: 'Fil de Vie — MUKTI',
  description:
    'Ta mémoire vivante MUKTI. Chaque rituel, mission, parrainage, libération inscrite dans ton fil non effaçable.',
}

export const dynamic = 'force-dynamic'

export default async function FilDeViePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/fil-de-vie')

  const [{ entries, nextCursor }, stats] = await Promise.all([
    getMyTimeline(50),
    getMyStats(),
  ])

  const days = stats.first_entry_at
    ? Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(stats.first_entry_at).getTime()) / (1000 * 60 * 60 * 24),
        ),
      )
    : 0

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
          Fil de Vie
        </p>
        <h1 className="mt-2 text-4xl font-semibold leading-tight text-white">
          Ta mémoire non effaçable
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Tout ce que tu vis ici reste. Même en pause, ton fil te reconnaît quand tu reviens.
          Chaque pas compte.
        </p>
      </header>

      <section
        aria-labelledby="stats-title"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <h2 id="stats-title" className="sr-only">
          Résumé de ton impact
        </h2>
        <StatCard label="Moments vécus" value={stats.total_entries} />
        <StatCard label="Jours actifs" value={days} />
        <StatCard
          label="Contributions"
          value={`${(stats.total_value_cents / 100).toFixed(0)}€`}
        />
        <StatCard
          label="Catégories"
          value={Object.keys(stats.by_kind).length}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/fil-de-vie/carte"
          data-testid="life-feed-cta-map"
          className="group flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-purple-400/40"
        >
          <Globe2 className="h-6 w-6 text-cyan-300" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold text-white">Carte mondiale</h3>
            <p className="text-xs text-white/50">Ton impact + celui du monde MUKTI</p>
          </div>
        </Link>
        <Link
          href="/dashboard/fil-de-vie/projection"
          data-testid="life-feed-cta-projection"
          className="group flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-purple-400/40"
        >
          <TrendingUp className="h-6 w-6 text-emerald-300" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold text-white">Projection 5 / 10 / 20 ans</h3>
            <p className="text-xs text-white/50">Impact cumulé si tu continues</p>
          </div>
        </Link>
      </section>

      <section aria-labelledby="timeline-title">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-300" aria-hidden="true" />
          <h2 id="timeline-title" className="text-2xl font-semibold text-white">
            Ton fil
          </h2>
        </div>
        <div className="mt-6">
          <FilDeVieTimeline initialEntries={entries} initialCursor={nextCursor} />
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}
