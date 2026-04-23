import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Users } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { listCeremonies, type ArCeremonyWithCount } from '@/lib/ar-ceremony'

export const metadata: Metadata = {
  title: 'Cérémonies Moment Z — MUKTI',
  description: 'Synchronise-toi à la seconde près avec d\'autres humains au Moment Z. Soin Planète, Faune Sauvage, Paix Universelle.',
}

export const dynamic = 'force-dynamic'

export default async function ArCeremonyListPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/ar/ceremony')

  const ceremonies = await listCeremonies('all')
  const upcoming = ceremonies.filter((c) => c.status === 'upcoming')
  const live = ceremonies.filter((c) => c.status === 'live')
  const finished = ceremonies.filter((c) => c.status === 'finished').slice(0, 5)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        href="/dashboard/ar"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour au miroir
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Moment Z · collectif
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Cérémonies synchronisées</h1>
        <p className="mt-1 max-w-xl text-sm text-white/55">
          À la seconde près, plusieurs humains se retrouvent dans le miroir. 10 minutes de présence partagée —
          rien d&apos;autre à faire qu&apos;être là.
        </p>
      </header>

      {live.length > 0 && (
        <Section title="En direct" accent="var(--accent)" testid="section-live">
          {live.map((c) => (
            <CeremonyCard key={c.id} ceremony={c} badge="live" />
          ))}
        </Section>
      )}

      <Section title="Prochainement" accent="var(--cyan)" testid="section-upcoming">
        {upcoming.length === 0 ? (
          <EmptyState text="Aucune cérémonie à venir pour l'instant." />
        ) : (
          upcoming.map((c) => <CeremonyCard key={c.id} ceremony={c} badge="upcoming" />)
        )}
      </Section>

      {finished.length > 0 && (
        <Section title="Récemment" accent="#6b7280" testid="section-finished">
          {finished.map((c) => (
            <CeremonyCard key={c.id} ceremony={c} badge="finished" />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({
  title,
  accent,
  children,
  testid,
}: {
  title: string
  accent: string
  children: React.ReactNode
  testid?: string
}) {
  return (
    <section className="flex flex-col gap-3" data-testid={testid}>
      <h2
        className="text-sm font-semibold uppercase tracking-[0.18em]"
        style={{ color: accent }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function CeremonyCard({
  ceremony,
  badge,
}: {
  ceremony: ArCeremonyWithCount
  badge: 'upcoming' | 'live' | 'finished'
}) {
  const date = new Date(ceremony.scheduled_at)
  const dateLabel = date.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  const minutes = Math.floor(ceremony.duration_sec / 60)

  return (
    <Link
      href={`/dashboard/ar/ceremony/${ceremony.id}`}
      data-testid={`ceremony-card-${ceremony.id}`}
      className={`group flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all ${
        badge === 'live'
          ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-medium text-white">{ceremony.title}</h3>
          {badge === 'live' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
              live
            </span>
          )}
        </div>
        <p className="text-xs text-white/55">
          {dateLabel} · {minutes} min
        </p>
        {ceremony.description && (
          <p className="mt-1 line-clamp-2 text-xs text-white/55">{ceremony.description}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1 text-xs text-white/65">
          <Users className="h-3.5 w-3.5" /> {ceremony.participants_count}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-white/40 transition-colors group-hover:text-white/70">
          Ouvrir →
        </span>
      </div>
    </Link>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center text-xs text-white/55">
      {text}
    </div>
  )
}
