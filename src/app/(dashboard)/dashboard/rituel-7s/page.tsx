import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Zap, Flame, Target, History } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { computeRituel7sStreak, RITUEL_7S_PHASES } from '@/lib/rituel-7s'
import Rituel7sPageLauncher from '@/components/rituel7s/Rituel7sPageLauncher'

export const metadata: Metadata = {
  title: 'Rituel 7 Secondes — MUKTI',
  description:
    'Le micro-rituel universel : 7 secondes pour couper n\'importe quelle envie. Utilisable partout, toujours le même.',
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

export default async function Rituel7sPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/rituel-7s')

  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const profileRow = profile as { id: string } | null
  const streak = profileRow?.id
    ? await computeRituel7sStreak(profileRow.id)
    : { current_days: 0, best_days: 0, today_count: 0, total: 0, recent: [] }

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
          <Zap className="h-3.5 w-3.5 text-[#F59E0B]" />
          <span>Mode 15 · Rituel 7 Secondes</span>
        </div>
        <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">
          Sept secondes pour{' '}
          <span className="bg-gradient-to-r from-[#F59E0B] to-[#F97316] bg-clip-text text-transparent">
            revenir à toi
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
          Toujours le même geste, toujours la même durée. Partout, pendant n&apos;importe quelle envie.
          Plus tu le répètes, plus ton corps l&apos;apprend comme un réflexe.
        </p>

        {/* Stats + CTA */}
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Flame className="h-4 w-4 text-[#F59E0B]" />}
            label="Streak"
            value={`${streak.current_days}j`}
          />
          <StatCard
            icon={<Target className="h-4 w-4 text-[#06B6D4]" />}
            label="Record"
            value={`${streak.best_days}j`}
          />
          <StatCard
            icon={<Zap className="h-4 w-4 text-[#F59E0B]" />}
            label="Aujourd'hui"
            value={String(streak.today_count)}
          />
          <StatCard
            icon={<History className="h-4 w-4 text-white/50" />}
            label="Total"
            value={String(streak.total)}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Rituel7sPageLauncher />
          <span className="text-xs text-white/50">
            ou presse <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono">R</kbd>{' '}
            deux fois partout dans l&apos;app
          </span>
        </div>
      </section>

      {/* 4 phases */}
      <section className="mx-auto mt-14 max-w-4xl px-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
          4 phases · 7 secondes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {RITUEL_7S_PHASES.map((phase, idx) => {
            const duration = (phase.end_ms - phase.start_ms) / 1000
            return (
              <div
                key={phase.name}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-white/50">
                    Phase {idx + 1}
                  </span>
                  <span className="text-xs font-mono text-[#F59E0B]">{duration}s</span>
                </div>
                <div className="mt-3 text-xl font-light text-white">{phase.label_fr}</div>
                <div className="mt-1 text-xs text-white/60">{phase.hint_fr}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Historique */}
      {streak.recent.length > 0 && (
        <section className="mx-auto mt-14 max-w-4xl px-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
            10 derniers rituels
          </h2>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
            {streak.recent.map((r, idx) => (
              <div
                key={r.id}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5 ${
                  idx > 0 ? 'border-t border-white/[0.04]' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      r.outcome === 'completed'
                        ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                        : 'bg-white/[0.06] text-white/50'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-white/80">{formatDate(r.started_at)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/60">
                  {r.duration_sec !== null && (
                    <span className="font-mono">{r.duration_sec}s</span>
                  )}
                  {r.trigger && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 uppercase tracking-widest">
                      {r.trigger === 'button' ? 'Bouton' : r.trigger === 'shortcut' ? 'Raccourci' : 'Page'}
                    </span>
                  )}
                  {r.affirmation_text && (
                    <span className="hidden max-w-[16rem] truncate text-white/50 italic sm:inline">
                      « {r.affirmation_text} »
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {streak.recent.length === 0 && (
        <section className="mx-auto mt-14 max-w-4xl px-6">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#F59E0B]/10 to-transparent p-6 text-center backdrop-blur-xl">
            <p className="text-sm text-white/70">
              Aucun rituel pour l&apos;instant. Lance le premier — ça prend 7 secondes.
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
