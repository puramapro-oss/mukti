import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles, Plus, HeartCrack } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ADDICTION_TYPES, MAX_ACTIVE_ADDICTIONS } from '@/lib/constants'
import type { Addiction } from '@/lib/addictions'

export const metadata: Metadata = {
  title: 'Libération — MUKTI',
  description:
    'Ton espace de libération des addictions. Programme 90 jours personnalisé, modes anti-pulsion, suivi de ta série.',
}

export const dynamic = 'force-dynamic'

export default async function LiberationPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/liberation')

  const { data: rows } = await sb
    .from('addictions')
    .select('*')
    .order('declared_at', { ascending: false })

  const all = (rows ?? []) as Addiction[]
  const active = all.filter(a => a.status === 'active')
  const archived = all.filter(a => a.status !== 'active')
  const params = await searchParams
  const justDeclared = params.new ? active.find(a => a.id === params.new) : undefined

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cyan)]">
            Libération
          </p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight text-[var(--text-primary)]">
            Ton chemin vers toi-même
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {active.length === 0
              ? 'Nomme ta première libération pour déclencher un programme 90 jours Opus 4.7.'
              : `${active.length} libération${active.length > 1 ? 's' : ''} en cours — continue, je t'accompagne.`}
          </p>
        </div>
        {active.length < MAX_ACTIVE_ADDICTIONS && (
          <Link
            href="/dashboard/liberation/declare"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            data-testid="nav-declare"
          >
            <Plus className="h-4 w-4" /> Déclarer une libération
          </Link>
        )}
      </header>

      {justDeclared && (
        <div
          className="rounded-3xl border border-[var(--cyan)]/30 bg-gradient-to-br from-[var(--cyan)]/10 to-[var(--purple)]/10 p-6"
          role="status"
        >
          <p className="text-sm font-semibold text-[var(--cyan)]">
            <Sparkles className="mr-1 inline h-4 w-4" /> Ta libération a commencé
          </p>
          <p className="mt-2 text-[var(--text-primary)]">
            {getTypeLabel(justDeclared.type)} — jour 1. Ton programme personnalisé arrive bientôt.
          </p>
        </div>
      )}

      {active.length === 0 ? (
        <section className="flex flex-col items-center gap-6 rounded-3xl border border-[var(--border)] bg-white/5 p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--cyan)]/30 to-[var(--purple)]/30 text-4xl">
            🦋
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Le premier pas est le plus précieux</h2>
            <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
              Choisis parmi 13 types d&apos;addictions reconnues — ou déclare la tienne. MUKTI génère un
              programme 90 jours avec micro-méditations, rituels, déclencheurs et affirmations ciblées.
            </p>
          </div>
          <Link
            href="/dashboard/liberation/declare"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Commencer
          </Link>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2">
          {active.map(a => (
            <AddictionCard key={a.id} addiction={a} />
          ))}
        </section>
      )}

      {archived.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Archivées & libérations passées
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {archived.map(a => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white/[0.02] p-4 text-sm text-[var(--text-secondary)]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl" aria-hidden>
                    {getTypeIcon(a.type)}
                  </span>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{getTypeLabel(a.type)}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {a.status === 'liberated' ? 'Libéré·e 🎉' : a.status === 'paused' ? 'En pause' : 'Archivée'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AddictionCard({ addiction }: { addiction: Addiction }) {
  const meta = ADDICTION_TYPES.find(t => t.id === addiction.type)
  const label = addiction.custom_label || meta?.name || addiction.type
  return (
    <Link
      href={`/dashboard/liberation/${addiction.id}`}
      className="group flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-white/5 p-6 transition-all hover:border-[var(--cyan)]/60 hover:bg-white/10"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden>
            {meta?.icon ?? '✨'}
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Libération</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)]">{label}</h3>
          </div>
        </div>
        <span className="rounded-full bg-[var(--cyan)]/10 px-3 py-1 text-xs font-medium text-[var(--cyan)]">
          Actif
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
        <span>Sévérité {addiction.severity}/5</span>
        <span className="text-[var(--text-muted)]">·</span>
        <span>Objectif&nbsp;{addiction.goal === 'stop' ? 'arrêt' : 'réduction'}</span>
        {addiction.triggers.length > 0 && (
          <>
            <span className="text-[var(--text-muted)]">·</span>
            <span>
              {addiction.triggers.length} déclencheur{addiction.triggers.length > 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-white/5 pt-4 text-sm">
        <span className="text-[var(--text-secondary)]">Voir le programme & suivi</span>
        <HeartCrack className="h-4 w-4 text-[var(--purple)] transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  )
}

function getTypeLabel(id: string): string {
  return ADDICTION_TYPES.find(t => t.id === id)?.name ?? id
}

function getTypeIcon(id: string): string {
  return ADDICTION_TYPES.find(t => t.id === id)?.icon ?? '✨'
}
