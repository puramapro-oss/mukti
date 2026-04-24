import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Globe2, Plus } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { listEvents } from '@/lib/core-events'
import COREEventCard from '@/components/core/COREEventCard'
import type { CoreFormat } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'C.O.R.E. Events — MUKTI',
  description:
    'Collective Omni-Resonance Events : événements mondiaux de soin collectif synchronisés. Humains + animaux + planète.',
}

export const dynamic = 'force-dynamic'

export default async function COREPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/core')

  const [scheduled, live, finished] = await Promise.all([
    listEvents({ status: 'scheduled', limit: 12 }),
    listEvents({ status: 'live', limit: 6 }),
    listEvents({ status: 'finished', limit: 8 }),
  ])

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour
          </Link>
          <Link
            href="/dashboard/core/create"
            data-testid="core-create-cta"
            className="inline-flex items-center gap-2 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-[#DDD6FE] transition-colors hover:bg-[#7c3aed]/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Créer
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-5xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/50">
          <Globe2 className="h-3.5 w-3.5 text-[#06b6d4]" />
          <span>Collective Omni-Resonance Events</span>
        </div>
        <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">
          Quand le monde{' '}
          <span className="bg-gradient-to-r from-[#7c3aed] to-[#06b6d4] bg-clip-text text-transparent">
            s&apos;aligne
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
          Événements mondiaux synchronisés — humains, animaux, planète au même Moment Z. Une
          intention unique, un souffle partagé, 5M+ capacité grâce à l&apos;architecture 3 couches.
        </p>
      </section>

      {live.length > 0 && (
        <section className="mx-auto mt-10 max-w-5xl px-6" data-testid="core-section-live">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-rose-300">
            ● En direct ({live.length})
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map(ev => (
              <COREEventCard
                key={ev.id}
                id={ev.id}
                format={ev.format as CoreFormat}
                title={ev.title_fr}
                intention={ev.intention_fr}
                region={ev.region}
                severity={ev.severity}
                momentZ={new Date(ev.moment_z_at)}
                participantsCount={ev.participants_count}
                status="live"
              />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-10 max-w-5xl px-6" data-testid="core-section-upcoming">
        <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[#DDD6FE]">
          À venir ({scheduled.length})
        </h2>
        {scheduled.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/60">
            Aucun événement programmé pour l&apos;instant. Sois le premier·e à en créer.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scheduled.map(ev => (
              <COREEventCard
                key={ev.id}
                id={ev.id}
                format={ev.format as CoreFormat}
                title={ev.title_fr}
                intention={ev.intention_fr}
                region={ev.region}
                severity={ev.severity}
                momentZ={new Date(ev.moment_z_at)}
                participantsCount={ev.participants_count}
                status="scheduled"
              />
            ))}
          </div>
        )}
      </section>

      {finished.length > 0 && (
        <section className="mx-auto mt-10 max-w-5xl px-6" data-testid="core-section-finished">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-white/45">
            Récents ({finished.length})
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {finished.map(ev => (
              <COREEventCard
                key={ev.id}
                id={ev.id}
                format={ev.format as CoreFormat}
                title={ev.title_fr}
                intention={ev.intention_fr}
                region={ev.region}
                severity={ev.severity}
                momentZ={new Date(ev.moment_z_at)}
                participantsCount={ev.participants_count}
                status="finished"
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
