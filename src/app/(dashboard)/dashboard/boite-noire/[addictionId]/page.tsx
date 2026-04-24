import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, BookLock } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAddictionById } from '@/lib/addictions'
import { listEntries, computeAggregates } from '@/lib/boite-noire'
import { ADDICTION_TYPES } from '@/lib/constants'
import BoiteNoireAddictionClient from '@/components/boite-noire/BoiteNoireAddictionClient'

export const metadata: Metadata = {
  title: 'Boîte Noire · détail — MUKTI',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

function getTypeMeta(type: string) {
  return ADDICTION_TYPES.find(t => t.id === type)
}

export default async function BoiteNoireAddictionPage({
  params,
}: {
  params: Promise<{ addictionId: string }>
}) {
  const { addictionId } = await params

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/boite-noire/${addictionId}`)

  const addiction = await getAddictionById(addictionId)
  if (!addiction) notFound()

  const { entries } = await listEntries({ addictionId, limit: 20 })
  const agg = computeAggregates(entries)

  const meta = getTypeMeta(addiction.type)
  const displayName = addiction.custom_label || meta?.name || addiction.type
  const emoji = meta?.icon ?? '•'

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/dashboard/boite-noire"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Boîte Noire
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-8 max-w-4xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/50">
          <BookLock className="h-3.5 w-3.5 text-[#A855F7]" />
          <span>Capture · Déclencheurs · Schéma</span>
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <span className="text-3xl">{emoji}</span>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">{displayName}</h1>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-widest text-white/60">
            Sévérité {addiction.severity}/5
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Entrées totales" value={String(agg.total_entries)} />
          <MiniStat
            label="Taux résistance"
            value={`${Math.round(agg.resist_rate * 100)}%`}
            highlight={agg.resist_rate >= 0.5}
          />
          <MiniStat
            label="Créneau dominant"
            value={agg.top_hour_window ?? '—'}
          />
        </div>
      </section>

      <BoiteNoireAddictionClient
        addictionId={addiction.id}
        addictionName={displayName}
        initialEntries={entries}
      />
    </main>
  )
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border bg-white/[0.03] p-4 backdrop-blur-xl ${
        highlight ? 'border-emerald-400/30' : 'border-white/10'
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-white/45">{label}</div>
      <div className={`mt-1 text-2xl font-light ${highlight ? 'text-emerald-200' : 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}
