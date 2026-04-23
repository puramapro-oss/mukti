import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, EyeOff, Timer, History, Flame, Users } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { computeBoucleUrgenceStats } from '@/lib/boucle-urgence'
import BoucleUrgencePageLauncher from '@/components/boucle-urgence/BoucleUrgencePageLauncher'

export const metadata: Metadata = {
  title: 'Boucle Urgence Invisible — MUKTI',
  description:
    'Le mode camouflé : micro-vibrations, mini-respiration et mots doux pendant qu\'autour tu restes normal·e. Personne ne remarque.',
}

export const dynamic = 'force-dynamic'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m} min` : `${m} min ${s}s`
}

function formatTrigger(t: string | null): string {
  if (t === 'shortcut') return 'Raccourci'
  if (t === 'page') return 'Page'
  return '—'
}

export default async function BoucleUrgencePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/boucle-urgence')

  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const profileRow = profile as { id: string } | null
  const stats = profileRow?.id
    ? await computeBoucleUrgenceStats(profileRow.id)
    : {
        total: 0,
        today_count: 0,
        avg_duration_sec: 0,
        best_streak_days: 0,
        current_streak_days: 0,
        recent: [],
      }

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto mt-10 max-w-4xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/50">
          <EyeOff className="h-3.5 w-3.5 text-[#06B6D4]" />
          <span>Mode 9 · Boucle Urgence Invisible</span>
        </div>
        <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">
          En société,{' '}
          <span className="bg-gradient-to-r from-[#06B6D4] to-[#0891B2] bg-clip-text text-transparent">
            personne ne remarque
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
          Repas, réunion, transport, famille. Tu actives la boucle : l&apos;écran ressemble à
          des notes, ton téléphone vibre doucement dans ta poche, des mots calmes apparaissent,
          tu respires — et la pulsion passe sans que personne s&apos;en rende compte.
        </p>

        {/* Stats */}
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Flame className="h-4 w-4 text-[#06B6D4]" />}
            label="Streak"
            value={`${stats.current_streak_days}j`}
          />
          <StatCard
            icon={<Users className="h-4 w-4 text-[#06B6D4]" />}
            label="Aujourd'hui"
            value={String(stats.today_count)}
          />
          <StatCard
            icon={<Timer className="h-4 w-4 text-[#06B6D4]" />}
            label="Durée moy."
            value={formatDuration(stats.avg_duration_sec || null)}
          />
          <StatCard
            icon={<History className="h-4 w-4 text-white/50" />}
            label="Total"
            value={String(stats.total)}
          />
        </div>

        <div className="mt-10">
          <BoucleUrgencePageLauncher />
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="mx-auto mt-14 max-w-4xl px-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
          3 couches invisibles
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <HowCard
            title="Micro-vibrations"
            body="Deux petites vibrations toutes les 6 secondes. Ton téléphone reste dans ta poche, personne ne voit."
          />
          <HowCard
            title="Mini-respiration"
            body="Un cercle discret en bas-droite, à peine 48 px, qui guide ta respiration 4/3. Invisible aux autres."
          />
          <HowCard
            title="Mots calmes"
            body="Un mot doux apparaît toutes les 5 s en bas-gauche. Si quelqu'un jette un œil, c'est une note."
          />
        </div>
      </section>

      {/* Historique */}
      {stats.recent.length > 0 && (
        <section className="mx-auto mt-14 max-w-4xl px-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
            10 dernières boucles
          </h2>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
            {stats.recent.map((r, idx) => (
              <div
                key={r.id}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5 ${
                  idx > 0 ? 'border-t border-white/[0.04]' : ''
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      r.outcome === 'completed'
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                        : 'bg-white/[0.06] text-white/50'
                    }`}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-white/80">{formatDate(r.started_at)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/60">
                  <span className="font-mono">{formatDuration(r.duration_sec)}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 uppercase tracking-widest">
                    {formatTrigger(r.trigger)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.recent.length === 0 && (
        <section className="mx-auto mt-14 max-w-4xl px-6">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#06B6D4]/10 to-transparent p-6 text-center backdrop-blur-xl">
            <p className="text-sm text-white/70">
              Aucune boucle pour l&apos;instant. La prochaine fois que tu sens monter l&apos;envie
              en public — active le camouflage.
            </p>
          </div>
        </section>
      )}
    </main>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/50">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-light">{value}</div>
    </div>
  )
}

function HowCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="text-sm font-medium text-white">{title}</div>
      <p className="mt-2 text-xs leading-relaxed text-white/60">{body}</p>
    </div>
  )
}
