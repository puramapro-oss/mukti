import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Moon, CheckCircle2, History, Sparkles } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { computeExorcismeStats } from '@/lib/exorcisme'

export const metadata: Metadata = {
  title: 'Exorcisme de l\'Addiction — MUKTI',
  description:
    'Séance immersive : nomme ce qui te possède, détruis-le symboliquement, intègre la reprogrammation, scelle la libération.',
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

export default async function ExorcismePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/exorcisme')

  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const profileRow = profile as { id: string } | null
  const stats = profileRow?.id
    ? await computeExorcismeStats(profileRow.id)
    : { total: 0, today_count: 0, sealed_count: 0, recent: [] }

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
          <Moon className="h-3.5 w-3.5 text-[#A855F7]" />
          <span>Mode 10 · Exorcisme de l&apos;Addiction</span>
        </div>
        <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">
          Nomme.{' '}
          <span className="bg-gradient-to-r from-[#A855F7] via-[#7C3AED] to-[#FFD700] bg-clip-text text-transparent">
            Détruis. Reprogramme. Scelle.
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
          Une séance immersive, dark et cathartique. Cinq phases pour libérer ce qui s&apos;est
          enraciné. Prévois 3 à 5 minutes au calme, casque si tu peux.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<Sparkles className="h-4 w-4 text-[#A855F7]" />}
            label="Séances"
            value={String(stats.total)}
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4 text-[#FFD700]" />}
            label="Scellées"
            value={String(stats.sealed_count)}
          />
          <StatCard
            icon={<History className="h-4 w-4 text-white/50" />}
            label="Aujourd'hui"
            value={String(stats.today_count)}
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/exorcisme/seance"
            className="inline-flex items-center gap-3 rounded-full border border-[#A855F7]/50 bg-gradient-to-r from-[#7C3AED]/30 to-[#A855F7]/30 px-7 py-3 text-sm font-medium text-white shadow-[0_0_40px_rgba(168,85,247,0.2)] transition-all hover:from-[#7C3AED]/50 hover:to-[#A855F7]/50"
            data-testid="exorcisme-start"
          >
            <Moon className="h-4 w-4 text-[#DDD6FE]" />
            Démarrer une séance
          </Link>
          <span className="text-xs text-white/40">
            ~3 min · active-le seulement quand tu es au calme
          </span>
        </div>
      </section>

      {/* 5 phases */}
      <section className="mx-auto mt-14 max-w-4xl px-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
          5 phases
        </h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {[
            { title: '1 · Invocation', body: '10 s. Tu poses le téléphone, tu arrives.' },
            { title: '2 · Révélation', body: 'Tu nommes ce qui te possède (80 c. max).' },
            { title: '3 · Destruction', body: 'Tu frappes 4 fois — le mot se brise.' },
            { title: '4 · Reprogrammation', body: 'Une affirmation contextuelle remplace.' },
            { title: '5 · Scellement', body: 'Flash doré. Séance scellée.' },
          ].map(p => (
            <div
              key={p.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
            >
              <div className="text-xs font-medium uppercase tracking-wider text-[#C4B5FD]">
                {p.title}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/60">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Historique */}
      {stats.recent.length > 0 && (
        <section className="mx-auto mt-14 max-w-4xl px-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
            10 dernières séances
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
                      r.sealed
                        ? 'bg-[#FFD700]/15 text-[#FFD700]'
                        : r.outcome === 'completed'
                          ? 'bg-[#A855F7]/15 text-[#C4B5FD]'
                          : 'bg-white/[0.06] text-white/50'
                    }`}
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-white/80">{formatDate(r.started_at)}</span>
                  {r.possession_text && (
                    <span className="hidden max-w-[14rem] truncate text-xs italic text-white/45 sm:inline">
                      « {r.possession_text} »
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  {r.duration_sec !== null && (
                    <span className="font-mono">{r.duration_sec}s</span>
                  )}
                  {r.sealed && (
                    <span className="rounded-full border border-[#FFD700]/40 bg-[#FFD700]/10 px-2 py-0.5 uppercase tracking-widest text-[#FFD700]">
                      Scellée
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.recent.length === 0 && (
        <section className="mx-auto mt-14 max-w-4xl px-6">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#7C3AED]/10 to-transparent p-6 text-center backdrop-blur-xl">
            <p className="text-sm text-white/70">
              Aucune séance pour l&apos;instant. La première est souvent la plus intense — prends
              ton temps.
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
